/**
 * Render-policy tests - the policy is pure, so these pin the security-relevant decisions directly:
 * which link schemes survive and where the parse cap bites. The DOM sanitizer battery lives in
 * render-markup.test.ts (it needs a DOM); this file guards the half that decides what is even allowed.
 */
import { describe, expect, test } from "bun:test";
import { capInput, isSafeHref, linkifyEscaped, RENDER_INPUT_CAP } from "./render-policy";

describe("isSafeHref", () => {
  test("keeps http, https, and mailto", () => {
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("http://example.com")).toBe(true);
    expect(isSafeHref("mailto:a@b.com")).toBe(true);
  });

  test("keeps in-document and root-relative links", () => {
    expect(isSafeHref("#section")).toBe(true);
    expect(isSafeHref("/library/regex")).toBe(true);
  });

  test("rejects script-bearing and non-navigational schemes", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("  JavaScript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHref("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHref("file:///etc/passwd")).toBe(false);
    expect(isSafeHref("")).toBe(false);
  });
});

describe("linkifyEscaped", () => {
  test("wraps a bare http/https url in an anchor to itself", () => {
    const out = linkifyEscaped("see https://janitorai.com/profiles/abc for more");
    expect(out).toContain('<a href="https://janitorai.com/profiles/abc"');
    expect(out).toContain(">https://janitorai.com/profiles/abc</a>");
  });

  test("escapes surrounding text and never interprets it as markup", () => {
    const out = linkifyEscaped("<b>not bold</b> https://x.com");
    expect(out).toContain("&lt;b&gt;not bold&lt;/b&gt;");
    expect(out).not.toContain("<b>");
  });

  test("leaves trailing sentence punctuation outside the link", () => {
    const out = linkifyEscaped("go to https://x.com.");
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain("</a>.");
  });

  test("plain text with no url is just escaped, no anchors", () => {
    expect(linkifyEscaped("just a version 1.2")).toBe("just a version 1.2");
    expect(linkifyEscaped("a & b < c")).toBe("a &amp; b &lt; c");
  });
});

describe("capInput", () => {
  test("passes through content within the cap unchanged", () => {
    const s = "a".repeat(100);
    expect(capInput(s)).toBe(s);
  });

  test("truncates content above the cap to exactly the cap length", () => {
    const s = "a".repeat(RENDER_INPUT_CAP + 500);
    expect(capInput(s).length).toBe(RENDER_INPUT_CAP);
  });
});
