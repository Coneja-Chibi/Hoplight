/**
 * External-url tests - this is the enforcement primitive, so the battery is adversarial: only http/https
 * normalize through, and every injection/other-scheme shape is refused. safeExternalUrl is what the
 * /api/open route spawns, so a gap here is an OS-open gap. externalLinkInfo's mismatch flag is the
 * phishing tell the gate warns on.
 */
import { describe, expect, test } from "bun:test";
import { externalLinkInfo, safeExternalUrl } from "./external-url";

describe("safeExternalUrl", () => {
  test("normalizes http and https", () => {
    expect(safeExternalUrl("https://example.com")).toBe("https://example.com/");
    expect(safeExternalUrl("  http://example.com/path?q=1 ")).toBe("http://example.com/path?q=1");
  });

  test("refuses non-navigational and dangerous schemes", () => {
    for (const bad of [
      "javascript:alert(1)",
      "file:///c:/windows/system32/calc.exe",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "chrome://settings",
      "ftp://example.com",
      "mailto:a@b.com",
    ]) {
      expect(safeExternalUrl(bad)).toBeNull();
    }
  });

  test("refuses garbage and injection-shaped input", () => {
    for (const bad of [
      "",
      "not a url",
      "http://exa mple.com",
      'https://example.com" & calc.exe',
      "https://example.com\n\r rm -rf",
    ]) {
      expect(safeExternalUrl(bad)).toBeNull();
    }
  });

  test("strips control whitespace to a clean host, so the spawned href carries no injection", () => {
    // WHATWG URL removes tabs/newlines before parsing; the OUTPUT is clean, which is the safety point
    expect(safeExternalUrl("https://exa\tmple.com")).toBe("https://example.com/");
  });

  test("normalizes IDN hosts to punycode (still http, still allowed)", () => {
    const got = safeExternalUrl("http://münchen.de");
    expect(got).toBe("http://xn--mnchen-3ya.de/");
  });

  test("a localhost /api/open url is still just an http url (route re-checks; not special-cased)", () => {
    // the guard against self-trigger is POST-only + no auto-fetch in rendered content, not a host block
    expect(safeExternalUrl("http://localhost:8321/api/open")).toBe("http://localhost:8321/api/open");
  });
});

describe("externalLinkInfo", () => {
  test("returns host for a safe link, no mismatch when text is not host-like", () => {
    const info = externalLinkInfo("https://janitorai.com/profiles/abc", "click here");
    expect(info?.host).toBe("janitorai.com");
    expect(info?.mismatch).toBe(false);
  });

  test("flags a mismatch when the text advertises a different host", () => {
    const info = externalLinkInfo("https://evil.example/login", "paypal.com");
    expect(info?.mismatch).toBe(true);
  });

  test("no mismatch when text host equals real host", () => {
    const info = externalLinkInfo("https://github.com/x", "github.com");
    expect(info?.mismatch).toBe(false);
  });

  test("returns null for an unsafe href (nothing to open)", () => {
    expect(externalLinkInfo("javascript:alert(1)", "x")).toBeNull();
  });
});
