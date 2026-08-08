/**
 * Streaming bounded ZIP reader for archives too large to hold in memory. The sibling of
 * archive.ts's unzipBounded: same budget vocabulary (UnzipBounds, ArchiveLimitError), but entries
 * are listed from the central directory and inflated through fflate's streaming Inflate, so a
 * decompression bomb is stopped as bytes flow instead of after a whole entry has been buffered.
 *
 * ZIP64 aware, because the archives that need this reader are written with forceZip64: sizes and
 * offsets are read from the 0x0001 extra fields whenever the 32 bit fields are saturated.
 *
 * Sizes always come from the central directory, so entries written with a streaming data descriptor
 * need no special casing here.
 *
 * Bun-independent core helper: no Bun APIs and no top-level await, so it survives the Node gate.
 */
import { Inflate } from "fflate";
import { ArchiveLimitError, type UnzipBounds } from "./archive";

/** Structural failure: the bytes are not a ZIP we can walk. Distinct from a budget breach. */
export class ArchiveFormatError extends Error {
  readonly code = "archive_format" as const;
  constructor(message = "archive is not a readable ZIP") {
    super(message);
    this.name = "ArchiveFormatError";
  }
}

export const isArchiveFormatError = (e: unknown): e is ArchiveFormatError =>
  e instanceof ArchiveFormatError ||
  (typeof e === "object" && e !== null && (e as { name?: string }).name === "ArchiveFormatError");

/**
 * The only thing this reader needs from a container: how big it is, and the bytes in a range. A
 * file handle, an HTTP range request, or an in-memory buffer all satisfy it. Reads may come back
 * short at the end of the source; every caller here checks the length it got.
 */
export interface RandomAccessSource {
  size(): Promise<number>;
  read(offset: number, length: number): Promise<Uint8Array>;
}

/** One entry as the central directory describes it. */
export interface ZipEntry {
  name: string;
  compressedSize: number;
  originalSize: number;
  /** METHOD_STORED or METHOD_DEFLATE. */
  compression: number;
  /** Absolute offset of this entry's local file header. */
  headerOffset: number;
}

/**
 * A decompressed-byte total the caller carries across entries, so one archive cannot smuggle a
 * bomb past per-entry limits by splitting it. Mutated in place as bytes flow.
 */
export interface AggregateBudget {
  used: number;
  max: number;
}

export interface StreamBudget {
  bounds: UnzipBounds;
  aggregate?: AggregateBudget;
}

export const METHOD_STORED = 0;
export const METHOD_DEFLATE = 8;

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_EOCD = 0x06054b50;

const LOCAL_MIN = 30;
const CENTRAL_MIN = 46;
const EOCD_MIN = 22;
const ZIP64_LOCATOR_BYTES = 20;
const ZIP64_EOCD_BYTES = 56;
/** An EOCD plus the largest archive comment that can follow it. */
const EOCD_SEARCH_MAX = EOCD_MIN + 0xffff;

const U32_MAX = 0xffffffff;
const FLAG_UTF8 = 0x800;
const READ_CHUNK = 64 * 1024;
const EMPTY = new Uint8Array(0);

const u16 = (d: Uint8Array, o: number): number => d[o]! | (d[o + 1]! << 8);
const u32 = (d: Uint8Array, o: number): number =>
  (d[o]! | (d[o + 1]! << 8) | (d[o + 2]! << 16) | (d[o + 3]! << 24)) >>> 0;
const u64 = (d: Uint8Array, o: number): number => u32(d, o) + u32(d, o + 4) * 0x100000000;

const need = (d: Uint8Array, offset: number, length: number, what: string): void => {
  if (offset < 0 || offset + length > d.length) {
    throw new ArchiveFormatError(`archive ended inside ${what}`);
  }
};

const utf8Decoder = new TextDecoder();

const decodeName = (bytes: Uint8Array, isUtf8: boolean): string => {
  if (isUtf8) return utf8Decoder.decode(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]!);
  return out;
};

/** Hands out independent copies, so a consumer that mutates a chunk cannot corrupt the source. */
export function bytesSource(bytes: Uint8Array): RandomAccessSource {
  return {
    size: () => Promise.resolve(bytes.byteLength),
    read: (offset, length) => {
      const start = Math.max(0, Math.min(offset, bytes.byteLength));
      const end = Math.max(start, Math.min(offset + length, bytes.byteLength));
      return Promise.resolve(bytes.slice(start, end));
    },
  };
}

async function readExact(
  source: RandomAccessSource,
  offset: number,
  length: number,
  what: string,
): Promise<Uint8Array> {
  if (length === 0) return EMPTY;
  const out = await source.read(offset, length);
  if (out.byteLength !== length) throw new ArchiveFormatError(`archive ended inside ${what}`);
  return out;
}

interface EndRecord {
  entryCount: number;
  cdOffset: number;
  cdSize: number;
}

/** Locate the central directory, preferring the ZIP64 record whenever a locator sits before EOCD. */
async function readEndRecord(source: RandomAccessSource, total: number): Promise<EndRecord> {
  if (total < EOCD_MIN) throw new ArchiveFormatError("archive is too short to be a ZIP");
  const window = Math.min(total, EOCD_SEARCH_MAX);
  const tail = await readExact(source, total - window, window, "the end of central directory record");

  let at = -1;
  for (let i = tail.length - EOCD_MIN; i >= 0; i -= 1) {
    if (u32(tail, i) === SIG_EOCD) {
      at = i;
      break;
    }
  }
  if (at < 0) throw new ArchiveFormatError("archive has no end of central directory record");

  let entryCount = u16(tail, at + 10);
  let cdSize = u32(tail, at + 12);
  let cdOffset = u32(tail, at + 16);

  if (at >= ZIP64_LOCATOR_BYTES && u32(tail, at - ZIP64_LOCATOR_BYTES) === SIG_ZIP64_LOCATOR) {
    const recordOffset = u64(tail, at - ZIP64_LOCATOR_BYTES + 8);
    const record = await readExact(
      source,
      recordOffset,
      ZIP64_EOCD_BYTES,
      "the ZIP64 end of central directory record",
    );
    if (u32(record, 0) !== SIG_ZIP64_EOCD) {
      throw new ArchiveFormatError("ZIP64 locator points at no ZIP64 record");
    }
    entryCount = u64(record, 32);
    cdSize = u64(record, 40);
    cdOffset = u64(record, 48);
  }

  if (cdOffset + cdSize > total) {
    throw new ArchiveFormatError("central directory runs past the end of the archive");
  }
  return { entryCount, cdSize, cdOffset };
}

interface Zip64Sizes {
  compressedSize: number;
  originalSize: number;
  headerOffset: number;
}

/**
 * Replace whichever of the three fields the 32 bit record saturated. The extra field packs them in
 * a fixed order (uncompressed, compressed, local header offset) and omits the ones that fit, so the
 * read positions depend on which fields were saturated.
 */
function applyZip64Extra(
  cd: Uint8Array,
  start: number,
  length: number,
  base: Zip64Sizes,
): Zip64Sizes {
  const wantOriginal = base.originalSize === U32_MAX;
  const wantCompressed = base.compressedSize === U32_MAX;
  const wantOffset = base.headerOffset === U32_MAX;
  if (!wantOriginal && !wantCompressed && !wantOffset) return base;

  const end = start + length;
  for (let p = start; p + 4 <= end; ) {
    const id = u16(cd, p);
    const size = u16(cd, p + 2);
    const body = p + 4;
    if (body + size > end) break;
    if (id === 0x0001) {
      const out = { ...base };
      let at = body;
      const take = (): number => {
        if (at + 8 > body + size) throw new ArchiveFormatError("ZIP64 extra field is truncated");
        const value = u64(cd, at);
        at += 8;
        return value;
      };
      if (wantOriginal) out.originalSize = take();
      if (wantCompressed) out.compressedSize = take();
      if (wantOffset) out.headerOffset = take();
      return out;
    }
    p = body + size;
  }
  throw new ArchiveFormatError("entry declares ZIP64 sizes but carries no usable ZIP64 extra field");
}

/**
 * List every entry from the central directory. The archive size and the entry count are checked
 * before a single byte is inflated, which is what makes an entry-count bomb cheap to reject.
 * Per-entry and aggregate decompressed budgets belong to openZipEntryStream, so a caller can list
 * an archive containing one oversized entry and still read the rest.
 */
export async function listZipEntriesBounded(
  source: RandomAccessSource,
  bounds: UnzipBounds,
): Promise<ZipEntry[]> {
  const total = await source.size();
  if (total > bounds.maxArchiveBytes) {
    throw new ArchiveLimitError("archive exceeds safety limits");
  }

  const end = await readEndRecord(source, total);
  if (end.entryCount > bounds.maxEntries) {
    throw new ArchiveLimitError("archive has too many entries");
  }

  const cd = await readExact(source, end.cdOffset, end.cdSize, "the central directory");
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < end.entryCount; i += 1) {
    need(cd, p, CENTRAL_MIN, "a central directory header");
    if (u32(cd, p) !== SIG_CENTRAL) {
      throw new ArchiveFormatError("central directory header is malformed");
    }
    const flags = u16(cd, p + 8);
    const compression = u16(cd, p + 10);
    const nameLength = u16(cd, p + 28);
    const extraLength = u16(cd, p + 30);
    const commentLength = u16(cd, p + 32);
    need(cd, p, CENTRAL_MIN + nameLength + extraLength + commentLength, "a central directory header");

    const sizes = applyZip64Extra(cd, p + CENTRAL_MIN + nameLength, extraLength, {
      compressedSize: u32(cd, p + 20),
      originalSize: u32(cd, p + 24),
      headerOffset: u32(cd, p + 42),
    });
    entries.push({
      name: decodeName(
        cd.subarray(p + CENTRAL_MIN, p + CENTRAL_MIN + nameLength),
        (flags & FLAG_UTF8) !== 0,
      ),
      compression,
      compressedSize: sizes.compressedSize,
      originalSize: sizes.originalSize,
      headerOffset: sizes.headerOffset,
    });
    p += CENTRAL_MIN + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * Stream one entry's decompressed bytes. Declared sizes are checked up front, then every byte that
 * actually comes out is counted against the same budgets, because the central directory is
 * attacker-controlled and can understate a bomb. A breach errors the stream with ArchiveLimitError
 * partway through rather than after the fact.
 *
 * Enforcement granularity is one READ_CHUNK of COMPRESSED input, not one output byte: fflate hands
 * back everything a push produced in a single callback. So the decompressed bytes held at once are
 * bounded by what 64 KiB of compressed input expands to, never by the entry's full size. A high
 * ratio entry can therefore overshoot the budget within one chunk, which is caught and thrown, but
 * that chunk did exist in memory first. Shrink READ_CHUNK if a caller needs a tighter ceiling.
 */
export async function openZipEntryStream(
  source: RandomAccessSource,
  entry: ZipEntry,
  budget: StreamBudget,
): Promise<ReadableStream<Uint8Array>> {
  const { bounds, aggregate } = budget;
  if (entry.compression !== METHOD_STORED && entry.compression !== METHOD_DEFLATE) {
    throw new ArchiveFormatError(`unsupported compression method ${entry.compression}`);
  }
  if (
    entry.compressedSize > bounds.maxEntryCompressed ||
    entry.originalSize > bounds.maxEntryOriginal
  ) {
    throw new ArchiveLimitError("archive entry exceeds safety limits");
  }
  if (aggregate && aggregate.used + entry.originalSize > aggregate.max) {
    throw new ArchiveLimitError("archive aggregate size exceeds safety limits");
  }

  const header = await readExact(source, entry.headerOffset, LOCAL_MIN, "a local file header");
  if (u32(header, 0) !== SIG_LOCAL) {
    throw new ArchiveFormatError("local file header is malformed");
  }
  const dataOffset = entry.headerOffset + LOCAL_MIN + u16(header, 26) + u16(header, 28);

  let offset = dataOffset;
  let remaining = entry.compressedSize;
  let produced = 0;
  let done = false;

  const account = (chunk: Uint8Array): void => {
    produced += chunk.byteLength;
    if (produced > bounds.maxEntryOriginal) {
      throw new ArchiveLimitError("archive entry exceeds safety limits");
    }
    if (aggregate) {
      aggregate.used += chunk.byteLength;
      if (aggregate.used > aggregate.max) {
        throw new ArchiveLimitError("archive aggregate size exceeds safety limits");
      }
    }
  };

  const ready: Uint8Array[] = [];
  const inflate =
    entry.compression === METHOD_DEFLATE
      ? new Inflate((chunk) => {
          account(chunk);
          ready.push(chunk);
        })
      : null;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (done) {
        controller.close();
        return;
      }
      const take = Math.min(READ_CHUNK, remaining);
      const chunk =
        take > 0 ? await readExact(source, offset, take, `the body of ${entry.name}`) : EMPTY;
      offset += take;
      remaining -= take;
      const final = remaining === 0;

      if (inflate === null) {
        if (take > 0) {
          account(chunk);
          controller.enqueue(chunk);
        }
      } else if (entry.compressedSize > 0) {
        inflate.push(chunk, final);
        for (const out of ready) controller.enqueue(out);
        ready.length = 0;
      }

      if (final) {
        done = true;
        controller.close();
      }
    },
  });
}
