/**
 * portrait tests - the untrusted-art reader. Entities are imported files, so the mime is an
 * allowlist: hostile payloads (text/html, scripted SVG) must read as "no portrait", never serve.
 */
import { describe, expect, test } from "bun:test";
import type { CanonicalEntity } from "../core/canonical";
import { hasPortrait, portraitBytes } from "./portrait";

type AnyEntity = CanonicalEntity<string, unknown>;
const PNG_B64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString("base64");

const withOriginalMedia = (mime: string): AnyEntity =>
  ({
    schemaVersion: "1",
    kind: "character",
    id: "x",
    body: {},
    original: { sillytavern: { raw: {}, sourceMedia: { b64: PNG_B64, mime } } },
  }) as AnyEntity;

const withPortraitRef = (ref: string): AnyEntity =>
  ({ schemaVersion: "1", kind: "character", id: "x", body: { media: { portrait: { role: "portrait", ref } } } }) as AnyEntity;

describe("portraitBytes", () => {
  test("serves the kept PNG carrier", () => {
    const art = portraitBytes(withOriginalMedia("image/png"));
    expect(art?.mime).toBe("image/png");
    expect(art?.bytes.length).toBeGreaterThan(0);
  });

  test("serves a raster data-URI portrait", () => {
    expect(portraitBytes(withPortraitRef(`data:image/webp;base64,${PNG_B64}`))?.mime).toBe("image/webp");
  });

  test("REFUSES non-image and scriptable mimes everywhere (stored-XSS guard)", () => {
    expect(portraitBytes(withOriginalMedia("text/html"))).toBeNull();
    expect(portraitBytes(withOriginalMedia("image/svg+xml"))).toBeNull();
    expect(portraitBytes(withPortraitRef(`data:text/html;base64,${PNG_B64}`))).toBeNull();
    expect(portraitBytes(withPortraitRef(`data:image/svg+xml;base64,${PNG_B64}`))).toBeNull();
    expect(portraitBytes(withPortraitRef("https://example.com/a.png"))).toBeNull(); // no remote fetch, ever
  });

  test("malformed shapes read as no portrait, never throw", () => {
    expect(hasPortrait({ schemaVersion: "1", kind: "character", id: "x", body: {} } as AnyEntity)).toBe(false);
    expect(portraitBytes(withPortraitRef("data:image/png;base64,%%%not-b64"))).toBeNull();
  });
});
