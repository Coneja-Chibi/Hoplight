/**
 * Streaming bounded ZIP reader: ZIP64 sizes and offsets, data descriptors, STORED and DEFLATE
 * streaming fidelity, and the budgets. The budget tests matter most: the central directory is
 * attacker-controlled, so a forged uncompressed size must still be stopped partway through the
 * stream rather than believed.
 */
import { describe, expect, test } from "bun:test";
import { strToU8, unzipSync } from "fflate";
import { ArchiveLimitError, isArchiveLimitError, type UnzipBounds } from "./archive";
import {
  ArchiveFormatError,
  METHOD_DEFLATE,
  METHOD_STORED,
  bytesSource,
  isArchiveFormatError,
  listZipEntriesBounded,
  openZipEntryStream,
  type AggregateBudget,
  type RandomAccessSource,
  type ZipEntry,
} from "./archive-stream";
import {
  ZIP_DEFLATE,
  ZIP_STORED,
  writeZip64,
} from "../formats/_fixtures/lumiverse-archive/zip64-writer";
import { buildMinimalLvbak } from "../formats/_fixtures/lumiverse-archive/build-lvbak";

const BOUNDS: UnzipBounds = {
  maxArchiveBytes: 64 * 1024 * 1024,
  maxEntries: 4096,
  maxEntryCompressed: 32 * 1024 * 1024,
  maxEntryOriginal: 32 * 1024 * 1024,
  maxAggregateOriginal: 64 * 1024 * 1024,
};

const collect = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    total += step.value.byteLength;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
};

/** Drain a stream expecting it to blow up, reporting how much got through first. */
const drainExpectingError = async (
  stream: ReadableStream<Uint8Array>,
): Promise<{ received: number; error: unknown }> => {
  const reader = stream.getReader();
  let received = 0;
  try {
    for (;;) {
      const step = await reader.read();
      if (step.done) return { received, error: null };
      received += step.value.byteLength;
    }
  } catch (error) {
    return { received, error };
  }
};

const find = (entries: ZipEntry[], name: string): ZipEntry => {
  const hit = entries.find((e) => e.name === name);
  if (!hit) throw new Error(`no entry named ${name}`);
  return hit;
};

/** A source that records every range it served, for proving what was never read. */
const countingSource = (
  bytes: Uint8Array,
): { source: RandomAccessSource; reads: Array<{ offset: number; length: number }> } => {
  const inner = bytesSource(bytes);
  const reads: Array<{ offset: number; length: number }> = [];
  return {
    reads,
    source: {
      size: () => inner.size(),
      read: (offset, length) => {
        reads.push({ offset, length });
        return inner.read(offset, length);
      },
    },
  };
};

/** Walk our own writer's fixed trailer to the central directory: EOCD, locator, ZIP64 record. */
const centralDirectoryOffset = (bytes: Uint8Array): number => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const locator = bytes.byteLength - 22 - 20;
  const record = Number(view.getBigUint64(locator + 8, true));
  return Number(view.getBigUint64(record + 48, true));
};

describe("listZipEntriesBounded", () => {
  test("honors ZIP64 sizes and offsets that the 32 bit fields saturate", async () => {
    const payload = strToU8("x".repeat(500));
    const zip = writeZip64([
      { name: "first.bin", data: new Uint8Array([1, 2, 3]), method: ZIP_STORED },
      { name: "second.txt", data: payload, method: ZIP_DEFLATE, level: 3 },
    ]);
    const entries = await listZipEntriesBounded(bytesSource(zip), BOUNDS);

    expect(entries.map((e) => e.name)).toEqual(["first.bin", "second.txt"]);
    expect(entries[0]!.headerOffset).toBe(0);
    expect(entries[0]!.compression).toBe(METHOD_STORED);
    expect(entries[0]!.originalSize).toBe(3);
    expect(entries[1]!.compression).toBe(METHOD_DEFLATE);
    expect(entries[1]!.originalSize).toBe(500);
    expect(entries[1]!.compressedSize).toBeLessThan(500);

    // the offset is only correct because it came out of the ZIP64 extra field
    expect(entries[1]!.headerOffset).toBeGreaterThan(0);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(entries[1]!.headerOffset, true)).toBe(0x04034b50);

    // the central directory really did saturate all three 32 bit fields
    const cd = centralDirectoryOffset(zip);
    expect(view.getUint32(cd + 20, true)).toBe(0xffffffff);
    expect(view.getUint32(cd + 24, true)).toBe(0xffffffff);
    expect(view.getUint32(cd + 42, true)).toBe(0xffffffff);
  });

  test("lists the minimal .lvbak fixture in archive order", async () => {
    const entries = await listZipEntriesBounded(bytesSource(buildMinimalLvbak()), BOUNDS);
    expect(entries[0]!.name).toBe("manifest.json");
    expect(entries[entries.length - 1]!.name).toBe("manifest-stats.json");
    expect(entries.some((e) => e.name.startsWith("files/") && e.compression === METHOD_STORED)).toBe(
      true,
    );
  });

  test("rejects an archive larger than the bound using size() alone", async () => {
    const zip = writeZip64([{ name: "a.txt", data: strToU8("hello") }]);
    const { source, reads } = countingSource(zip);
    await expect(
      listZipEntriesBounded(source, { ...BOUNDS, maxArchiveBytes: 32 }),
    ).rejects.toBeInstanceOf(ArchiveLimitError);
    expect(reads).toHaveLength(0);
  });

  test("rejects an entry-count bomb before the central directory is even parsed", async () => {
    const many = Array.from({ length: 64 }, (_, i) => ({
      name: `entry-${i}.txt`,
      data: strToU8(`row ${i}`),
    }));
    const zip = writeZip64(many);
    // corrupt the central directory: whoever reads it first is the one who reports the failure
    const cd = centralDirectoryOffset(zip);
    zip.fill(0xff, cd, cd + 16);

    await expect(
      listZipEntriesBounded(bytesSource(zip), { ...BOUNDS, maxEntries: 8 }),
    ).rejects.toBeInstanceOf(ArchiveLimitError);
    // with room for all 64 the corrupt directory is what fails, proving the count check ran first
    await expect(listZipEntriesBounded(bytesSource(zip), BOUNDS)).rejects.toBeInstanceOf(
      ArchiveFormatError,
    );
  });

  test("rejects bytes that are not a ZIP", async () => {
    const junk = new Uint8Array(200).fill(0x41);
    const error = await listZipEntriesBounded(bytesSource(junk), BOUNDS).catch((e: unknown) => e);
    expect(isArchiveFormatError(error)).toBe(true);
    expect(isArchiveLimitError(error)).toBe(false);
  });
});

describe("openZipEntryStream", () => {
  const stored = strToU8("stored payload, never compressed");
  const deflated = strToU8("deflate payload ".repeat(4096));
  const zip = writeZip64([
    { name: "stored.bin", data: stored, method: ZIP_STORED },
    { name: "deflated.txt", data: deflated, method: ZIP_DEFLATE, level: 3 },
    {
      name: "streamed.txt",
      data: strToU8("written with a data descriptor"),
      method: ZIP_DEFLATE,
      level: 3,
      dataDescriptor: true,
    },
    { name: "empty.bin", data: new Uint8Array(0), method: ZIP_STORED },
  ]);

  test("streams STORED and DEFLATE entries byte for byte", async () => {
    const source = bytesSource(zip);
    const entries = await listZipEntriesBounded(source, BOUNDS);
    const reference = unzipSync(zip);

    for (const name of ["stored.bin", "deflated.txt", "empty.bin"]) {
      const out = await collect(await openZipEntryStream(source, find(entries, name), { bounds: BOUNDS }));
      expect([name, out]).toEqual([name, reference[name]!]);
    }
  });

  test("data descriptor entries need no special casing, sizes come from the directory", async () => {
    const source = bytesSource(zip);
    const entry = find(await listZipEntriesBounded(source, BOUNDS), "streamed.txt");
    expect(entry.originalSize).toBe(30);
    const out = await collect(await openZipEntryStream(source, entry, { bounds: BOUNDS }));
    expect(new TextDecoder().decode(out)).toBe("written with a data descriptor");
  });

  test("a declared oversize entry is refused before any read of its body", async () => {
    const { source, reads } = countingSource(zip);
    const entry = find(await listZipEntriesBounded(source, BOUNDS), "deflated.txt");
    const before = reads.length;
    await expect(
      openZipEntryStream(source, entry, { bounds: { ...BOUNDS, maxEntryOriginal: 64 } }),
    ).rejects.toBeInstanceOf(ArchiveLimitError);
    expect(reads).toHaveLength(before);
  });

  test("aggregate budget refuses the entry that would push the running total over", async () => {
    const source = bytesSource(zip);
    const entries = await listZipEntriesBounded(source, BOUNDS);
    const aggregate: AggregateBudget = { used: 0, max: deflated.byteLength + 8 };

    const first = find(entries, "deflated.txt");
    await collect(await openZipEntryStream(source, first, { bounds: BOUNDS, aggregate }));
    expect(aggregate.used).toBe(deflated.byteLength);

    await expect(
      openZipEntryStream(source, find(entries, "stored.bin"), { bounds: BOUNDS, aggregate }),
    ).rejects.toBeInstanceOf(ArchiveLimitError);
  });

  test("unsupported compression methods are a format failure, not a limit failure", async () => {
    const source = bytesSource(zip);
    const entry = { ...find(await listZipEntriesBounded(source, BOUNDS), "stored.bin"), compression: 12 };
    const error = await openZipEntryStream(source, entry, { bounds: BOUNDS }).catch((e: unknown) => e);
    expect(isArchiveFormatError(error)).toBe(true);
  });
});

describe("openZipEntryStream against a lying central directory", () => {
  /** Well mixed bytes, so DEFLATE cannot shrink them and the body spans many read chunks. */
  const noisy = (n: number): Uint8Array => {
    const out = new Uint8Array(n);
    let s = 0x9e3779b9;
    for (let i = 0; i < n; i += 1) {
      s = (s ^ (s << 13)) >>> 0;
      s ^= s >>> 17;
      s = (s ^ (s << 5)) >>> 0;
      out[i] = (s ^ (s >>> 8) ^ (s >>> 16) ^ (s >>> 24)) & 0xff;
    }
    return out;
  };

  const PAYLOAD = 512 * 1024;
  const CAP = 128 * 1024;
  const zip = writeZip64([
    { name: "stored.bin", data: noisy(PAYLOAD), method: ZIP_STORED, forgeOriginalSize: 1024 },
    {
      name: "spread.bin",
      data: noisy(PAYLOAD),
      method: ZIP_DEFLATE,
      level: 3,
      forgeOriginalSize: 1024,
    },
    {
      name: "ratio.txt",
      data: strToU8("bomb payload ".repeat(40_000)),
      method: ZIP_DEFLATE,
      level: 3,
      forgeOriginalSize: 1024,
    },
  ]);

  const entryFor = async (name: string): Promise<[RandomAccessSource, ZipEntry]> => {
    const source = bytesSource(zip);
    return [source, find(await listZipEntriesBounded(source, BOUNDS), name)];
  };

  test("a forged size passes the pre-check, so only mid-stream accounting can catch it", async () => {
    const [source, entry] = await entryFor("stored.bin");
    expect(entry.originalSize).toBe(1024);

    const { received, error } = await drainExpectingError(
      await openZipEntryStream(source, entry, { bounds: { ...BOUNDS, maxEntryOriginal: CAP } }),
    );
    expect(isArchiveLimitError(error)).toBe(true);
    // bytes really did reach the consumer before the breach, which is what "as bytes flow" means
    expect(received).toBeGreaterThan(0);
    expect(received).toBeLessThanOrEqual(CAP);
  });

  test("the inflate path enforces mid-stream too, across many read chunks", async () => {
    const [source, entry] = await entryFor("spread.bin");
    // incompressible, so the body is far larger than one 64 KiB read chunk
    expect(entry.compressedSize).toBeGreaterThan(256 * 1024);

    const { received, error } = await drainExpectingError(
      await openZipEntryStream(source, entry, { bounds: { ...BOUNDS, maxEntryOriginal: CAP } }),
    );
    expect(isArchiveLimitError(error)).toBe(true);
    expect(received).toBeGreaterThan(0);
    expect(received).toBeLessThanOrEqual(CAP);
  });

  test("a high ratio entry is refused, and its payload never reaches the consumer", async () => {
    const [source, entry] = await entryFor("ratio.txt");
    // one read chunk inflates the whole body, so the breach lands before anything is handed out
    const { received, error } = await drainExpectingError(
      await openZipEntryStream(source, entry, { bounds: { ...BOUNDS, maxEntryOriginal: CAP } }),
    );
    expect(isArchiveLimitError(error)).toBe(true);
    expect(received).toBe(0);
  });

  test("the aggregate total is enforced mid-stream too", async () => {
    const [source, entry] = await entryFor("stored.bin");
    const aggregate: AggregateBudget = { used: 0, max: 64 * 1024 };

    const { received, error } = await drainExpectingError(
      await openZipEntryStream(source, entry, { bounds: BOUNDS, aggregate }),
    );
    expect(isArchiveLimitError(error)).toBe(true);
    expect(received).toBeGreaterThan(0);
    expect(aggregate.used).toBeGreaterThan(aggregate.max);
  });
});
