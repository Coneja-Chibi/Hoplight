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

  /**
   * A WHOLE DOCUMENT KEEPS ITS DESIGN.
   *
   * Every drawing an agent writes is a whole document with its styles in the head, and DOMPurify
   * returns the parsed BODY, so the head went in the bin with the style block: the page drew every
   * word and none of its design. A <style> written inside <body> survived, which made it look like
   * a fault in the HTML rather than in the boundary.
   */
  test("a document's head styles survive into the frame", () => {
    const page = "<!doctype html><html><head><style>:root{--ink:#eef4ff}"
      + "body{background:#070a13}h1{font:600 32px Georgia}</style></head>"
      + "<body><h1 class=\"title\">Observatory</h1></body></html>";
    const srcdoc = buildBackdropSrcDoc(page);
    expect(srcdoc).toContain("--ink:#eef4ff");
    expect(srcdoc).toContain("font:600 32px Georgia");
    expect(srcdoc).toContain("<h1 class=\"title\">Observatory</h1>");
    // Hoisted, not left where it sat: the rules must be inside the frame's own style element.
    expect(srcdoc.split("</style>")[0]).toContain("background:#070a13");
  });

  test("a style block inside the body is hoisted too, so one page has one behaviour", () => {
    const srcdoc = buildBackdropSrcDoc("<body><style>p{color:#0f0}</style><p>x</p></body>");
    expect(srcdoc).toContain("p{color:#0f0}");
    // Once, not twice: hoisted AND left in place would apply the same rules through two elements.
    expect(srcdoc.match(/<style>/g)?.length).toBe(1);
  });

  test("a drawing cut off mid-style still draws the part that arrived", () => {
    // The 200k cap can truncate a document anywhere. A dropped rule set is a page with no design.
    const srcdoc = buildBackdropSrcDoc("<html><head><style>body{color:#abc}h1{margin:0");
    expect(srcdoc).toContain("body{color:#abc}");
  });

  test("hoisted document CSS goes through the same sanitizer as author CSS", () => {
    const hostile = "<html><head><style>@import url(\"https://evil.test/x.css\");"
      + "body{background:url(\"https://evil.test/a.png\")}</style></head><body><p>x</p></body>";
    const srcdoc = buildBackdropSrcDoc(hostile);
    expect(srcdoc).not.toContain("evil.test");
    expect(srcdoc).not.toContain("@import");
  });

  /**
   * WHICH LAYER HOLDS WHAT, stated rather than assumed - hoisting styles must not quietly move a
   * guarantee from one to the other.
   *
   * A `</style>` written in a DOCUMENT is not a breakout: it is where the parser ends the element,
   * and the hoist ends the block at exactly the same place. What follows is ordinary markup, and a
   * remote reference in ordinary markup has always survived DOMPurify and been stopped by the CSP -
   * that is the sealed frame's design, not a gap this opened. The css PROP is the string that can
   * carry a literal `</style>`, and sanitizeBackdropCss neutralizes it there (tested above).
   */
  test("a remote reference after a style block is markup, and the CSP is what stops it", () => {
    const srcdoc = buildBackdropSrcDoc(
      "<html><head><style>body{color:#abc}</style></head>"
      + "<body><img src=\"https://evil.test/x.png\"><p>x</p></body></html>",
    );
    // The rules were hoisted, and the element ended where the parser would have ended it.
    expect(srcdoc.split("</style>")[0]).toContain("body{color:#abc}");
    expect(srcdoc.split("</style>")[0]).not.toContain("evil.test");
    // The img survives sanitizing, exactly as it did before, and cannot load.
    expect(SEALED_PREVIEW_CSP).toContain("img-src data: blob:");
    expect(SEALED_PREVIEW_CSP).not.toMatch(/img-src[^;]*https/);
  });

  /**
   * FAIL CLOSED WITH NO DOM. DOMPurify's unsupported build returns its input UNCHANGED, so a caller
   * without a window would receive untouched untrusted markup while everything here still called it
   * sanitized. Refusing is the only honest answer; nothing legitimate builds a preview headlessly.
   */
  test("no window is a refusal, never a pass-through", () => {
    const saved = g.window;
    delete g.window;
    try {
      expect(() => buildBackdropSrcDoc("<script>alert(1)</script><p>x</p>")).toThrow(/without a DOM/);
    } finally {
      g.window = saved;
    }
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
