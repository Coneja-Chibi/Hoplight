/**
 * Sealed preview pure checks: backdrop CSS sanitizer + generated srcdoc CSP / sandbox contract.
 * DOMPurify needs a window for buildBackdropSrcDoc; jsdom is installed only for that describe.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { BACKDROP_CSS_CAP, sanitizeBackdropCss } from "./backdrop-css";

describe("sanitizeBackdropCss", () => {
  test("strips @import and remote url()", () => {
    const raw = `@import url("https://evil.test/x.css"); body{background:url("https://evil.test/a.png");color:red}`;
    const out = sanitizeBackdropCss(raw);
    expect(out).not.toContain("@import");
    expect(out).not.toContain("https://evil.test");
    expect(out).toContain("color:red");
  });

  test("strips expression and behavior", () => {
    const out = sanitizeBackdropCss("div{width:expression(alert(1));behavior:url(x.htc)}");
    expect(out.toLowerCase()).not.toContain("expression(alert");
    expect(out.toLowerCase()).not.toContain("behavior:url");
  });

  test("neutralizes closing-style breakout payloads", () => {
    const payloads = [
      "</style><img src=https://evil.test/x.png>",
      "</Style><img src=https://evil.test/y.png>",
      "< / style ><img src=https://evil.test/z.png>",
      "</STYLE\n><img src=https://evil.test/w.png>",
    ];
    for (const raw of payloads) {
      const out = sanitizeBackdropCss(raw);
      expect(out.toLowerCase()).not.toContain("</style");
      expect(out).not.toContain("evil.test");
      expect(out).toContain("blocked-close-style");
    }
  });

  test("caps oversized CSS input", () => {
    const raw = `a{color:red}` + "x".repeat(BACKDROP_CSS_CAP + 500);
    const out = sanitizeBackdropCss(raw);
    expect(out.length).toBeLessThan(raw.length);
    expect(out.length).toBeLessThanOrEqual(BACKDROP_CSS_CAP + 80);
  });
});

describe("buildBackdropSrcDoc", () => {
  let buildBackdropSrcDoc: (html: string, css?: string) => string;
  let SEALED_PREVIEW_CSP: string;
  const g = globalThis as unknown as { window?: unknown; document?: unknown };

  beforeAll(async () => {
    const dom = new JSDOM("");
    g.window = dom.window;
    g.document = dom.window.document;
    ({ buildBackdropSrcDoc, SEALED_PREVIEW_CSP } = await import("./index"));
  });

  afterAll(() => {
    delete g.window;
    delete g.document;
  });

  test("CSP allows only data/blob images and media, never http/https", () => {
    const srcdoc = buildBackdropSrcDoc("<p>hi</p>", "body{color:red}");
    expect(srcdoc).toContain(SEALED_PREVIEW_CSP);
    expect(SEALED_PREVIEW_CSP).toContain("img-src data: blob:");
    expect(SEALED_PREVIEW_CSP).toContain("media-src data: blob:");
    expect(SEALED_PREVIEW_CSP).toContain("connect-src 'none'");
    expect(SEALED_PREVIEW_CSP).not.toMatch(/img-src[^;]*https/);
    expect(SEALED_PREVIEW_CSP).not.toMatch(/img-src[^;]*http:/);
    expect(SEALED_PREVIEW_CSP).not.toMatch(/media-src[^;]*https/);
    expect(srcdoc).not.toContain("https:");
    expect(srcdoc).not.toContain("http:");
  });

  test("closing-style payload cannot leave a remote origin in the srcdoc style block", () => {
    const srcdoc = buildBackdropSrcDoc(
      "<p>ok</p>",
      "</style><img src=https://evil.test/x.png><style>body{color:red}",
    );
    expect(srcdoc).not.toContain("evil.test");
    expect(srcdoc.toLowerCase().split("<style>")[1] ?? "").not.toMatch(/<\/style>\s*<img/);
  });
});
