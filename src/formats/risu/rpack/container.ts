/**
 * .risum container walk - magic/version/length-prefixed RPack main JSON + optional RPack asset
 * blocks + terminator. Pure bytes in/out; no execution. The main payload is kept as decoded BYTES
 * (not a UTF-8 string) so serialize(parse(x)) can be byte-identical; JSON text is a view on top.
 */
import { rpackDecode, rpackEncode } from "./codec";

export interface RisumParts {
  /** RPack-decoded main block (pretty JSON bytes; may contain non-UTF8 placeholders while the table is WIP). */
  modulePlain: Uint8Array;
  /** Decoded asset payloads (webp bytes etc.), in container order. */
  assets: Uint8Array[];
}

const MAGIC = 111;
const VERSION = 0;
const MARKER_ASSET = 1;
const MARKER_END = 0;

const readU32LE = (bytes: Uint8Array, at: number): number =>
  (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0;

const writeU32LE = (n: number): Uint8Array => {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
};

/** UTF-8 view of the main plain bytes (JSON.parse-tolerant). */
export const modulePlainToText = (plain: Uint8Array): string =>
  new TextDecoder("utf-8", { fatal: false }).decode(plain);

export const textToModulePlain = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * Parse a .risum blob into decoded main plain bytes + decoded asset bytes.
 * Throws on bad magic/version/truncated length (fail closed).
 */
export function parseRisum(bytes: Uint8Array): RisumParts {
  if (bytes.length < 6) throw new Error("risum: container too short");
  if (bytes[0] !== MAGIC) throw new Error(`risum: bad magic ${bytes[0]} (want ${MAGIC})`);
  if (bytes[1] !== VERSION) throw new Error(`risum: bad version ${bytes[1]} (want ${VERSION})`);

  const mainLen = readU32LE(bytes, 2);
  const mainStart = 6;
  const mainEnd = mainStart + mainLen;
  if (mainLen <= 0 || mainEnd > bytes.length) {
    throw new Error(`risum: bad main length ${mainLen}`);
  }

  const modulePlain = rpackDecode(bytes.subarray(mainStart, mainEnd));

  const assets: Uint8Array[] = [];
  let off = mainEnd;
  while (off < bytes.length) {
    const marker = bytes[off]!;
    if (marker === MARKER_END) break;
    if (marker !== MARKER_ASSET) {
      throw new Error(`risum: unexpected marker ${marker} at offset ${off}`);
    }
    if (off + 5 > bytes.length) throw new Error("risum: truncated asset header");
    const assetLen = readU32LE(bytes, off + 1);
    const bodyStart = off + 5;
    const bodyEnd = bodyStart + assetLen;
    if (bodyEnd > bytes.length) {
      throw new Error(`risum: bad asset length ${assetLen} at ${off}`);
    }
    assets.push(rpackDecode(bytes.subarray(bodyStart, bodyEnd)));
    off = bodyEnd;
  }

  return { modulePlain, assets };
}

/**
 * Serialize decoded parts back to a .risum blob.
 * When modulePlain/assets came from parseRisum and the RPack table is a bijection on used bytes,
 * this is byte-identical to the input (including a trailing terminator 0).
 */
export function serializeRisum(parts: RisumParts): Uint8Array {
  const mainCipher = rpackEncode(parts.modulePlain);
  const chunks: Uint8Array[] = [
    new Uint8Array([MAGIC, VERSION]),
    writeU32LE(mainCipher.length),
    mainCipher,
  ];
  for (const asset of parts.assets) {
    const cipher = rpackEncode(asset);
    chunks.push(new Uint8Array([MARKER_ASSET]));
    chunks.push(writeU32LE(cipher.length));
    chunks.push(cipher);
  }
  chunks.push(new Uint8Array([MARKER_END]));

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
