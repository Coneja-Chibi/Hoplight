/**
 * Deterministic minimal ZIP64 writer for .lvbak fixtures. Lumiverse exports with forceZip64, so
 * every real archive carries a ZIP64 end-of-central-directory record, a locator, and a 0x0001 extra
 * field on every entry even when the archive is tiny. fflate can READ that but cannot WRITE it, so
 * fixtures that pin ZIP64 behavior need this writer.
 *
 * Deterministic by construction: fixed DOS timestamps, no archive comment, entries emitted in the
 * order given, so the same input always produces byte-identical output.
 *
 * Not a general purpose zip writer. No encryption, no comments, no multi-disk, no streaming output,
 * no 32-bit fallback: sizes and offsets always live in the ZIP64 extra fields.
 */
import { deflateSync } from "fflate";

export const ZIP_STORED = 0;
export const ZIP_DEFLATE = 8;

export type DeflateLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Zip64EntryInput {
  /** Entry name, forward slashes, no leading slash. */
  name: string;
  /** Uncompressed content. */
  data: Uint8Array;
  /** ZIP_STORED (default) or ZIP_DEFLATE. Lumiverse stores binaries and deflates NDJSON. */
  method?: typeof ZIP_STORED | typeof ZIP_DEFLATE;
  /** Deflate level when the method is ZIP_DEFLATE. Lumiverse writes level 3. */
  level?: DeflateLevel;
  /**
   * Emit a streaming data descriptor after the payload and zero the local header's crc and sizes,
   * the shape a writer produces when it does not know the sizes up front. The central directory
   * still carries the truth, which is why readers need no special casing.
   */
  dataDescriptor?: boolean;
  /**
   * Test-only escape hatch: write this uncompressed size into the central directory instead of the
   * real one. Forges the lie a decompression bomb tells, so a reader that trusts declared sizes can
   * be proven to still enforce its budget as bytes flow. Leave unset for honest fixtures.
   */
  forgeOriginalSize?: number;
}

const SIG_LOCAL = 0x04034b50;
const SIG_DATA_DESCRIPTOR = 0x08074b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_EOCD = 0x06054b50;

const U16_MAX = 0xffff;
const U32_MAX = 0xffffffff;

/** 45 is the "requires ZIP64" version, the value real forceZip64 writers stamp. */
const VERSION_ZIP64 = 45;
/** Bit 11: the name is UTF-8. Bit 3: crc and sizes follow the payload in a data descriptor. */
const FLAG_UTF8 = 0x800;
const FLAG_DATA_DESCRIPTOR = 0x08;

/** Frozen 2026-01-01 00:00:00 in DOS date/time, so a rebuild never changes a byte. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/** 4 byte header plus uncompressed and compressed size. */
const LOCAL_EXTRA_BYTES = 4 + 16;
/** 4 byte header plus uncompressed size, compressed size, and local header offset. */
const CENTRAL_EXTRA_BYTES = 4 + 24;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export const crc32 = (data: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Growable little-endian byte sink. Kept private: the writer is the only sane caller. */
class ByteWriter {
  private buf = new Uint8Array(4096);
  private len = 0;

  get length(): number {
    return this.len;
  }

  private room(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let next = this.buf.length * 2;
    while (next < this.len + extra) next *= 2;
    const grown = new Uint8Array(next);
    grown.set(this.buf.subarray(0, this.len));
    this.buf = grown;
  }

  u16(v: number): void {
    this.room(2);
    this.buf[this.len] = v & 0xff;
    this.buf[this.len + 1] = (v >>> 8) & 0xff;
    this.len += 2;
  }

  u32(v: number): void {
    this.room(4);
    const n = v >>> 0;
    this.buf[this.len] = n & 0xff;
    this.buf[this.len + 1] = (n >>> 8) & 0xff;
    this.buf[this.len + 2] = (n >>> 16) & 0xff;
    this.buf[this.len + 3] = (n >>> 24) & 0xff;
    this.len += 4;
  }

  /** Values stay under 2^53, which every size in a fixture comfortably is. */
  u64(v: number): void {
    this.u32(v >>> 0);
    this.u32(Math.floor(v / 0x100000000));
  }

  bytes(b: Uint8Array): void {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

interface CentralRecord {
  name: Uint8Array;
  method: number;
  flags: number;
  crc: number;
  compressed: number;
  original: number;
  headerOffset: number;
}

const encoder = new TextEncoder();

/**
 * Build a complete ZIP64 archive from entries, in the order given. Always writes ZIP64 structures,
 * matching Lumiverse's forceZip64 export regardless of how small the payload is.
 */
export function writeZip64(entries: readonly Zip64EntryInput[]): Uint8Array {
  const out = new ByteWriter();
  const central: CentralRecord[] = [];

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const method = entry.method ?? ZIP_STORED;
    const payload =
      method === ZIP_DEFLATE ? deflateSync(entry.data, { level: entry.level ?? 3 }) : entry.data;
    const crc = crc32(entry.data);
    const streaming = entry.dataDescriptor === true;
    const flags = FLAG_UTF8 | (streaming ? FLAG_DATA_DESCRIPTOR : 0);
    const headerOffset = out.length;

    out.u32(SIG_LOCAL);
    out.u16(VERSION_ZIP64);
    out.u16(flags);
    out.u16(method);
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(streaming ? 0 : crc);
    out.u32(U32_MAX);
    out.u32(U32_MAX);
    out.u16(name.length);
    out.u16(LOCAL_EXTRA_BYTES);
    out.bytes(name);
    // ZIP64 extra: uncompressed size first, then compressed, the order the format fixes.
    out.u16(0x0001);
    out.u16(16);
    out.u64(streaming ? 0 : entry.data.length);
    out.u64(streaming ? 0 : payload.length);
    out.bytes(payload);
    if (streaming) {
      out.u32(SIG_DATA_DESCRIPTOR);
      out.u32(crc);
      out.u64(payload.length);
      out.u64(entry.data.length);
    }

    central.push({
      name,
      method,
      flags,
      crc,
      compressed: payload.length,
      original: entry.forgeOriginalSize ?? entry.data.length,
      headerOffset,
    });
  }

  const cdOffset = out.length;
  for (const e of central) {
    out.u32(SIG_CENTRAL);
    out.u16(VERSION_ZIP64);
    out.u16(VERSION_ZIP64);
    out.u16(e.flags);
    out.u16(e.method);
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(e.crc);
    out.u32(U32_MAX);
    out.u32(U32_MAX);
    out.u16(e.name.length);
    out.u16(CENTRAL_EXTRA_BYTES);
    out.u16(0);
    out.u16(0);
    out.u16(0);
    out.u32(0);
    out.u32(U32_MAX);
    out.bytes(e.name);
    out.u16(0x0001);
    out.u16(24);
    out.u64(e.original);
    out.u64(e.compressed);
    out.u64(e.headerOffset);
  }
  const cdSize = out.length - cdOffset;
  const zip64EocdOffset = out.length;

  out.u32(SIG_ZIP64_EOCD);
  out.u64(44); // size of the rest of this record
  out.u16(VERSION_ZIP64);
  out.u16(VERSION_ZIP64);
  out.u32(0);
  out.u32(0);
  out.u64(central.length);
  out.u64(central.length);
  out.u64(cdSize);
  out.u64(cdOffset);

  out.u32(SIG_ZIP64_LOCATOR);
  out.u32(0);
  out.u64(zip64EocdOffset);
  out.u32(1);

  // Every 32-bit field is saturated so a reader must consult the ZIP64 record for the truth.
  out.u32(SIG_EOCD);
  out.u16(U16_MAX);
  out.u16(U16_MAX);
  out.u16(U16_MAX);
  out.u16(U16_MAX);
  out.u32(U32_MAX);
  out.u32(U32_MAX);
  out.u16(0);

  return out.finish();
}
