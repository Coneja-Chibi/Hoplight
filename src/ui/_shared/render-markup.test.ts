/**
 * Markup-renderer XSS battery. DOMPurify needs a DOM, which `bun test` has none of, so we install a
 * jsdom window as the global BEFORE dynamically importing the renderer (DOMPurify binds to `window` at
 * import). jsdom is used deliberately: it is DOMPurify's officially supported non-browser DOM and runs
 * the sanitizer faithfully, whereas happy-dom serialized every tag away to bare text and would have
 * made this battery assert nothing. The assertions check the SANITIZED OUTPUT STRING - the guarantee
 * is "the dangerous node/attr/scheme is absent from the HTML", never the weaker "it didn't pop an
 * alert in one engine". If any of these regress, the render feature is unsafe and the gate must go red.
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
