/**
 * RPack byte codec - the fixed 1-to-1 substitution both ways, through the reconstructed table. This is the
 * whole of "RPack" as a transform: no compression, no key, just a permutation. Language-agnostic by
 * construction - it moves bytes, it does not care what text they spell. Nothing here executes anything.
 */
import { DECODE, ENCODE } from "./table";

/** Substitute every byte through a 256-entry table into a fresh buffer (input untouched). */
const substitute = (bytes: Uint8Array, table: readonly number[]): Uint8Array => {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = table[bytes[i]!]!;
  return out;
};

/** Cipher -> plain (a .risum block back to its original bytes). */
export const rpackDecode = (bytes: Uint8Array): Uint8Array => substitute(bytes, DECODE);

/** Plain -> cipher (re-pack for byte-safe export). Inverse of rpackDecode. */
export const rpackEncode = (bytes: Uint8Array): Uint8Array => substitute(bytes, ENCODE);
