/**
 * Render-policy tests - the policy is pure, so these pin the security-relevant decisions directly:
 * which link schemes survive and where the parse cap bites. The DOM sanitizer battery lives in
 * render-markup.test.ts (it needs a DOM); this file guards the half that decides what is even allowed.
 */
import { describe, expect, test } from "bun:test";
import { capInput, isSafeHref, RENDER_INPUT_CAP } from "./render-policy";

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
