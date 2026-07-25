/**
 * Bounded unzip budgets (pre-inflate originalSize / count / aggregate).
 */
import { describe, expect, test } from "bun:test";
import { zipSync, strToU8 } from "fflate";
import {
  ArchiveLimitError,
  CARD_ARCHIVE_BOUNDS,
  PACK_ARCHIVE_BOUNDS,
  unzipBounded,
} from "./archive";

const zipOf = (files: Record<string, string | Uint8Array>): Uint8Array => {
  const rec: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) {
    rec[k] = typeof v === "string" ? strToU8(v) : v;
  }
  return zipSync(rec);
};

describe("unzipBounded", () => {
  test("extracts small valid archive", () => {
    const z = zipOf({ "card.json": '{"ok":true}', "a.txt": "hi" });
    const out = unzipBounded(z);
    expect(Object.keys(out).sort()).toEqual(["a.txt", "card.json"]);
    expect(new TextDecoder().decode(out["a.txt"]!)).toBe("hi");
  });

  test("only mode skips other entries", () => {
    const z = zipOf({ "card.json": "{}", "big.bin": "x".repeat(100) });
    const out = unzipBounded(z, { only: "card.json" });
    expect(Object.keys(out)).toEqual(["card.json"]);
  });

  test("only mode counts skipped entries toward the archive cap", () => {
    const z = zipOf({ "card.json": "{}", a: "", b: "", c: "" });
    expect(() =>
      unzipBounded(z, {
        bounds: { ...CARD_ARCHIVE_BOUNDS, maxEntries: 3 },
        only: "card.json",
      }),
    ).toThrow(ArchiveLimitError);
  });

  test("rejects archive over maxArchiveBytes", () => {
    const z = zipOf({ "a.txt": "hello" });
    expect(() =>
      unzipBounded(z, { bounds: { ...CARD_ARCHIVE_BOUNDS, maxArchiveBytes: 4 } }),
    ).toThrow(ArchiveLimitError);
  });

  test("rejects entry over maxEntryOriginal via tiny bound", () => {
    const z = zipOf({ "card.json": "x".repeat(200) });
    expect(() =>
      unzipBounded(z, {
        bounds: {
          ...CARD_ARCHIVE_BOUNDS,
          maxEntryOriginal: 50,
          maxEntryCompressed: 50,
          maxAggregateOriginal: 10_000,
        },
      }),
    ).toThrow(ArchiveLimitError);
  });

  test("rejects too many entries", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 5; i++) files[`f${i}.txt`] = "a";
    const z = zipOf(files);
    expect(() =>
      unzipBounded(z, { bounds: { ...PACK_ARCHIVE_BOUNDS, maxEntries: 3 } }),
    ).toThrow(ArchiveLimitError);
  });

  test("rejects aggregate overflow", () => {
    const z = zipOf({
      a: "x".repeat(40),
      b: "y".repeat(40),
    });
    expect(() =>
      unzipBounded(z, {
        bounds: {
          ...CARD_ARCHIVE_BOUNDS,
          maxEntryOriginal: 100,
          maxEntryCompressed: 100,
          maxAggregateOriginal: 50,
        },
      }),
    ).toThrow(ArchiveLimitError);
  });

  test("custom filter still applies after bounds", () => {
    const z = zipOf({ "keep.png": "png", "skip.txt": "txt" });
    const out = unzipBounded(z, {
      filter: (f) => f.name.endsWith(".png"),
    });
    expect(Object.keys(out)).toEqual(["keep.png"]);
  });

  test("custom filter counts rejected entries toward the archive cap", () => {
    const z = zipOf({ "keep.png": "png", a: "", b: "", c: "" });
    expect(() =>
      unzipBounded(z, {
        bounds: { ...PACK_ARCHIVE_BOUNDS, maxEntries: 3 },
        filter: (f) => f.name.endsWith(".png"),
      }),
    ).toThrow(ArchiveLimitError);
  });
});
