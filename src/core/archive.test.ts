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
import { buildMinimalLvbak } from "../formats/_fixtures/lumiverse-archive/build-lvbak";
import {
  ZIP_DEFLATE,
  ZIP_STORED,
  writeZip64,
} from "../formats/_fixtures/lumiverse-archive/zip64-writer";

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

/**
 * Lumiverse exports with forceZip64, so even a tiny .lvbak carries a ZIP64 end-of-central-directory
 * record and 0x0001 extra fields. specs/formats/lumiverse-archive.md makes reading that a
 * prerequisite rather than an edge case, so it gets pinned here against the real bounded reader.
 */
describe("unzipBounded on ZIP64 archives", () => {
  test("reads a forced-ZIP64 archive that is far too small to need one", () => {
    const z = writeZip64([
      { name: "manifest.json", data: strToU8('{"producer":"lumiverse"}'), method: ZIP_DEFLATE, level: 3 },
      { name: "database/characters.ndjson", data: strToU8('{"id":"a"}\n'), method: ZIP_DEFLATE, level: 3 },
      { name: "files/avatars/a.png", data: new Uint8Array([1, 2, 3]), method: ZIP_STORED },
      { name: "files/empty.bin", data: new Uint8Array(0), method: ZIP_STORED },
    ]);
    const out = unzipBounded(z);
    expect(Object.keys(out)).toEqual([
      "manifest.json",
      "database/characters.ndjson",
      "files/avatars/a.png",
      "files/empty.bin",
    ]);
    expect(new TextDecoder().decode(out["manifest.json"]!)).toBe('{"producer":"lumiverse"}');
    expect(out["files/avatars/a.png"]!).toEqual(new Uint8Array([1, 2, 3]));
    // zero-length entries are meaningful in this format, not errors
    expect(out["files/empty.bin"]!.byteLength).toBe(0);
  });

  test("reads a ZIP64 entry whose sizes arrived in a data descriptor", () => {
    const z = writeZip64([
      { name: "streamed.ndjson", data: strToU8('{"id":"a"}\n'), method: ZIP_DEFLATE, level: 3, dataDescriptor: true },
    ]);
    expect(new TextDecoder().decode(unzipBounded(z)["streamed.ndjson"]!)).toBe('{"id":"a"}\n');
  });

  test("reads the minimal .lvbak fixture and its NDJSON survives intact", () => {
    const out = unzipBounded(buildMinimalLvbak());
    expect(Object.keys(out)[0]).toBe("manifest.json");
    expect(JSON.parse(new TextDecoder().decode(out["manifest.json"]!)).producer).toBe("lumiverse");
    const line = new TextDecoder().decode(out["database/characters.ndjson"]!).trimEnd();
    expect(JSON.parse(line).name).toBe("Test Character Alpha");
  });

  test("bounds still enforce on ZIP64: entry count", () => {
    const z = writeZip64([
      { name: "a", data: strToU8("a") },
      { name: "b", data: strToU8("b") },
      { name: "c", data: strToU8("c") },
    ]);
    expect(() => unzipBounded(z, { bounds: { ...CARD_ARCHIVE_BOUNDS, maxEntries: 2 } })).toThrow(
      ArchiveLimitError,
    );
  });

  test("bounds still enforce on ZIP64: archive bytes and per-entry original size", () => {
    const z = writeZip64([{ name: "big.txt", data: strToU8("x".repeat(200)) }]);
    expect(() => unzipBounded(z, { bounds: { ...CARD_ARCHIVE_BOUNDS, maxArchiveBytes: 64 } })).toThrow(
      ArchiveLimitError,
    );
    expect(() =>
      unzipBounded(z, {
        bounds: { ...CARD_ARCHIVE_BOUNDS, maxEntryOriginal: 50, maxEntryCompressed: 50 },
      }),
    ).toThrow(ArchiveLimitError);
  });
});
