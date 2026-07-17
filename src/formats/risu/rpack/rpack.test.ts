/**
 * Hermetic RPack/.risum tests (no machine-local paths). Release confidence does not depend on
 * Downloads samples. Optional local exploratory coverage may live elsewhere; it never gates CI.
 *
 * Completion mode: SAFE-BLOCK (RPACK_EDITED_EXPORT_VERIFIED === false). Unedited export returns
 * original bytes; edited export throws RpackEditedExportBlockedError until independent parity
 * fixtures exist.
 */
import { test, expect } from "bun:test";
import { rpackDecode, rpackEncode } from "./codec";
import { DECODE, ENCODE } from "./table";
import { parseRisum, serializeRisum, modulePlainToText, textToModulePlain } from "./container";
import {
  decodeRisum,
  encodeRisum,
  encodeRisumEdited,
  encodeRisumSmart,
  RPACK_EDITED_EXPORT_VERIFIED,
  RpackEditedExportBlockedError,
} from "./index";
import { modulesStructurallyEqual, type RisuModule } from "./module";

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/** Minimal valid risuModule JSON plain -> full .risum via the public encode path. */
function makeSyntheticRisum(name = "test-mod"): Uint8Array {
  const plain = textToModulePlain(
    JSON.stringify({ type: "risuModule", module: { name, description: "", id: "m1" } }, null, 2),
  );
  return serializeRisum({ modulePlain: plain, assets: [] });
}

test("container rejects bad magic", () => {
  expect(() => parseRisum(new Uint8Array([1, 0, 0, 0, 0, 0]))).toThrow("magic");
});

test("table: DECODE is 256 unique values covering 0..255; ENCODE is inverse", () => {
  expect(DECODE.length).toBe(256);
  expect(ENCODE.length).toBe(256);
  const seen = new Set(DECODE);
  expect(seen.size).toBe(256);
  for (let i = 0; i < 256; i++) {
    expect(seen.has(i)).toBe(true);
    expect(DECODE[ENCODE[i]!]!).toBe(i);
    expect(ENCODE[DECODE[i]!]!).toBe(i);
  }
});

test("rpack encode is inverse of decode on a synthetic block (self-consistency only)", () => {
  const plain = new TextEncoder().encode('{\n  "name": "x"\n}');
  const cipher = rpackEncode(plain);
  expect(bytesEqual(rpackDecode(cipher), plain)).toBe(true);
  expect(bytesEqual(rpackEncode(rpackDecode(cipher)), cipher)).toBe(true);
});

test("self-inverse alone is not parity evidence (any permutation would pass)", () => {
  // Document the trap: a corrupted table that remains bijective still self-inverts.
  const broken = DECODE.slice() as number[];
  // swap two distinct mappings
  const a = broken[0]!;
  const b = broken[1]!;
  broken[0] = b;
  broken[1] = a;
  const brokenEncode = new Array(256).fill(0);
  broken.forEach((p, c) => {
    brokenEncode[p] = c;
  });
  const plain = new Uint8Array([0, 1, 2, 3, 44, 100]);
  const cipher = plain.map((x) => brokenEncode[x]!);
  const round = cipher.map((x) => broken[x]!);
  expect(bytesEqual(round, plain)).toBe(true); // still "passes" without independent fixture
});

test("synthetic container round-trip is byte-identical", () => {
  const m = makeSyntheticRisum();
  const parts = parseRisum(m);
  expect(bytesEqual(serializeRisum(parts), m)).toBe(true);
  const decoded = decodeRisum(m);
  expect(decoded.module.name).toBe("test-mod");
  expect(bytesEqual(encodeRisum(decoded), m)).toBe(true);
});

test("encodeRisumSmart unedited returns the original object/bytes", () => {
  const m = makeSyntheticRisum("unedited");
  const decoded = decodeRisum(m);
  const back = encodeRisumSmart(m, decoded.module);
  expect(back).toBe(m); // same reference when structurally equal
  expect(bytesEqual(back, m)).toBe(true);
});

test("safe-block: encodeRisumSmart refuses a changed module with actionable error", () => {
  expect(RPACK_EDITED_EXPORT_VERIFIED).toBe(false);
  const m = makeSyntheticRisum("base");
  const decoded = decodeRisum(m);
  const edited: RisuModule = { ...decoded.module, name: "edited-name" };
  expect(modulesStructurallyEqual(decoded.module, edited)).toBe(false);
  expect(() => encodeRisumSmart(m, edited)).toThrow(RpackEditedExportBlockedError);
  try {
    encodeRisumSmart(m, edited);
  } catch (e) {
    expect(e).toBeInstanceOf(RpackEditedExportBlockedError);
    expect((e as RpackEditedExportBlockedError).code).toBe("RPACK_EDITED_EXPORT_BLOCKED");
    expect((e as Error).message).toContain("edited module.risum");
    expect((e as Error).message).toContain("not independently verified");
  }
  // never silently returns the old blob after an edit was blocked
  expect(() => encodeRisumSmart(m, edited)).toThrow();
});

test("safe-block: encodeRisumEdited and repackFromModule also refuse", () => {
  const m = makeSyntheticRisum("base");
  const decoded = decodeRisum(m);
  const edited: RisuModule = { ...decoded.module, description: "x" };
  expect(() => encodeRisumEdited(m, edited)).toThrow(RpackEditedExportBlockedError);
  expect(() => encodeRisum({ ...decoded, module: edited, repackFromModule: true })).toThrow(
    RpackEditedExportBlockedError,
  );
  // unedited re-pack path still works
  expect(bytesEqual(encodeRisum(decoded), m)).toBe(true);
});

test("modulePlainToText round-trips utf-8 for the synthetic envelope", () => {
  const m = makeSyntheticRisum("utf8-이름");
  const decoded = decodeRisum(m);
  const text = modulePlainToText(decoded.modulePlain);
  expect(text).toContain("utf8-이름");
  expect(JSON.parse(text).module.name).toBe("utf8-이름");
});
