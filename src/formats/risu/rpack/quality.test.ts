/**
 * Content-quality gates for the RPack path - hermetic only.
 * Machine-local complex-card samples are not a release gate (see plans/008). Self-consistency
 * and safe-block policy live in rpack.test.ts; this file keeps small structural checks that
 * always run in CI.
 */
import { test, expect } from "bun:test";
import { DECODE, ENCODE } from "./table";
import { rpackDecode, rpackEncode } from "./codec";
import { RPACK_EDITED_EXPORT_VERIFIED } from "./index";

test("quality: table domain is a permutation (no holes, no duplicates)", () => {
  const decodeSet = new Set(DECODE);
  const encodeSet = new Set(ENCODE);
  expect(decodeSet.size).toBe(256);
  expect(encodeSet.size).toBe(256);
  for (let i = 0; i < 256; i++) {
    expect(decodeSet.has(i)).toBe(true);
    expect(encodeSet.has(i)).toBe(true);
  }
});

test("quality: flipping one DECODE entry breaks inverse with ENCODE", () => {
  // ENCODE was built from DECODE; if we mutate a local copy of DECODE without rebuilding ENCODE,
  // the public inverse relationship fails for that byte - the independent-fixture failure shape.
  const corrupted = DECODE.slice() as number[];
  const i = 10;
  const j = 20;
  const tmp = corrupted[i]!;
  corrupted[i] = corrupted[j]!;
  corrupted[j] = tmp;
  // ENCODE still maps as if the original table held: for cipher byte i, plain is DECODE[i] originally.
  // After corruption, rpackDecode with corrupted table disagrees with encode-then-original-decode.
  const plain = new Uint8Array([0, 1, 2, 3, 4, 5]);
  const cipher = rpackEncode(plain); // uses real ENCODE
  const viaCorrupted = cipher.map((c) => corrupted[c]!);
  // At least one byte should differ from plain when DECODE is corrupted (bijective swap of two
  // outputs still remaps some cipher bytes' plain values).
  let differs = false;
  for (let k = 0; k < plain.length; k++) {
    if (viaCorrupted[k] !== plain[k]) differs = true;
  }
  // If the plain samples only hit unmapped-affected cells, force a full-range check:
  if (!differs) {
    const full = new Uint8Array(256);
    for (let b = 0; b < 256; b++) full[b] = b;
    const fullCipher = rpackEncode(full);
    for (let b = 0; b < 256; b++) {
      if (corrupted[fullCipher[b]!] !== full[b]) {
        differs = true;
        break;
      }
    }
  }
  expect(differs).toBe(true);
});

test("quality: release mode is safe-block until independent fixtures land", () => {
  expect(RPACK_EDITED_EXPORT_VERIFIED).toBe(false);
});
