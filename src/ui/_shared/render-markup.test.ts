/**
 * Markup-renderer XSS + egress battery. DOMPurify needs a DOM, which `bun test` has none of, so we
 * install a jsdom window as the global BEFORE dynamically importing the renderer (DOMPurify binds to
 * `window` at import). jsdom is used deliberately: it is DOMPurify's officially supported non-browser
 * DOM and runs the sanitizer faithfully, whereas happy-dom serialized every tag away to bare text and
 * would have made this battery assert nothing. The assertions check the SANITIZED OUTPUT STRING - the
 * guarantee is "the dangerous node/attr/scheme is absent from the HTML", never the weaker "it didn't
 * pop an alert in one engine". If any of these regress, the render feature is unsafe and the gate
 * must go red.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import type { RenderFormat } from "./render-policy";

let render: (raw: string, format: RenderFormat) => string;
const g = globalThis as unknown as { window?: unknown; document?: unknown };

beforeAll(async () => {
  const dom = new JSDOM("");
  g.window = dom.window;
  g.document = dom.window.document;
  ({ renderMarkup: render } = await import("./render-markup"));
});

afterAll(() => {
  delete g.window;
  delete g.document;
});

const lower = (raw: string, format: RenderFormat = "html"): string => render(raw, format).toLowerCase();

describe("renderMarkup strips active content", () => {
  test("drops <script> entirely", () => {
    expect(lower("<script>alert(1)</script>hi")).not.toContain("<script");
  });

  test("drops inline event handlers", () => {
    const out = lower('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("onerror");
  });

  test("drops svg onload", () => {
    expect(lower("<svg onload=alert(1)></svg>")).not.toContain("onload");
  });

  test("neutralizes javascript: hrefs in HTML", () => {
    expect(lower('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });

  test("neutralizes javascript: links written as markdown", () => {
    expect(lower("[click](javascript:alert(1))", "markdown")).not.toContain("javascript:");
  });

  test("drops iframe / object / embed", () => {
    const out = lower('<iframe src="//e"></iframe><object data="//e"></object><embed src="//e">');
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<object");
    expect(out).not.toContain("<embed");
  });

  test("drops form controls", () => {
    const out = lower("<form><input value=x><button>go</button></form>");
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<input");
    expect(out).not.toContain("<button");
  });

  test("survives a mutation-XSS payload", () => {
    const out = lower("<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<script");
  });
});

describe("renderMarkup blocks auto-fetch egress", () => {
  test("drops remote img elements entirely", () => {
    const out = lower('<p>hi</p><img src="https://evil.test/x.png" alt="x">');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("evil.test");
    expect(out).toContain("hi");
  });

  test("drops picture/source and media elements", () => {
    const out = lower(
      '<picture><source srcset="https://evil.test/a.webp"><img src="https://evil.test/a.png"></picture>' +
        '<video src="https://evil.test/v.mp4" poster="https://evil.test/p.jpg"></video>' +
        '<audio src="https://evil.test/a.mp3"><track src="https://evil.test/t.vtt"></audio>',
    );
    expect(out).not.toContain("<picture");
    expect(out).not.toContain("<source");
    expect(out).not.toContain("<video");
    expect(out).not.toContain("<audio");
    expect(out).not.toContain("<track");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("evil.test");
  });

  test("drops SVG image carriers", () => {
    const out = lower('<svg><image href="https://evil.test/x.png"></image></svg>');
    expect(out).not.toContain("<image");
    expect(out).not.toContain("evil.test");
  });

  test("strips fetch attributes from any surviving element", () => {
    const out = lower('<div src="https://evil.test/x" srcset="https://evil.test/y" poster="https://evil.test/z" ping="https://evil.test/p">ok</div>');
    expect(out).not.toContain("src=");
    expect(out).not.toContain("srcset");
    expect(out).not.toContain("poster");
    expect(out).not.toContain("ping=");
    expect(out).not.toContain("evil.test");
    expect(out).toContain("ok");
  });

  test("markdown images do not retain a remote URL", () => {
    const out = lower("![face](https://evil.test/face.png)", "markdown");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("evil.test");
  });

  test("drops remote url() and image-set from inline styles", () => {
    const out = lower(
      '<p style="background:url(https://evil.test/a.png);color:red">hi</p>' +
        '<span style="background-image: image-set(url(https://evil.test/b.png) 1x)">x</span>',
    );
    expect(out).not.toContain("evil.test");
    expect(out).not.toContain("url(");
    expect(out).not.toContain("image-set");
    expect(out).toContain("hi");
  });

  test("drops custom-property indirection and case-varied URL forms from styles", () => {
    const out = lower(
      '<p style="--x:url(https://evil.test/c.png);background:var(--x)">a</p>' +
        '<p style="background: URL( \'https://evil.test/d.png\' )">b</p>',
    );
    expect(out).not.toContain("evil.test");
    expect(out).not.toContain("var(");
    expect(out).not.toContain("url(");
  });

  test("keeps safe presentation styles", () => {
    const out = lower('<p style="text-align:center; color:#c00; font-weight:bold">hi</p>');
    expect(out).toContain("text-align");
    expect(out).toContain("color");
    expect(out).toContain("font-weight");
    expect(out).toContain("hi");
  });
});

describe("renderMarkup keeps safe content", () => {
  test("renders markdown emphasis", () => {
    expect(lower("**bold**", "markdown")).toContain("<strong>");
  });

  test("keeps authored text-align style on a paragraph", () => {
    expect(lower('<p style="text-align:center">hi</p>')).toContain("text-align");
  });

  test("hardens surviving anchors with noopener", () => {
    const out = lower('<a href="https://example.com">x</a>');
    expect(out).toContain("rel=\"noopener");
    expect(out).toContain("target=\"_blank\"");
  });

  test("plain format escapes markup to literal text", () => {
    const out = render("<b>hi</b>", "plain");
    expect(out).not.toContain("<b>");
    expect(out).toContain("&lt;b&gt;");
  });
});
