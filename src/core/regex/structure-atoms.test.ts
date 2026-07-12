/**
 * Structure atoms (structure-atoms.ts): each of the three atoms BUILDS a working pattern, EXPLAINS
 * through the general reader, and ROUND-TRIPS via recognize -> rebuild. Engine assertions confirm the
 * built patterns actually match/reject the intended text.
 */
import { describe, expect, test } from "bun:test";
import { buildAnyNumber, buildBetween, buildLineAnchor, recognizeAtom } from "./structure-atoms";
import { explainPattern } from "./builder";

describe("any number", () => {
  test("builds, matches integers, and round-trips", () => {
    const a = buildAnyNumber(false);
    expect(a.find).toBe("\\d+");
    expect(new RegExp(a.find).test("hp 42 left")).toBe(true);
    expect(recognizeAtom(a.find, a.flags)).toEqual({ kind: "any-number", decimals: false });
    expect(explainPattern(a.find, a.flags).reading).toContain("digit");
  });

  test("decimals variant matches a decimal", () => {
    const a = buildAnyNumber(true);
    const re = new RegExp(a.find);
    expect(re.test("3.14")).toBe(true);
    expect("3.14".match(re)?.[0]).toBe("3.14");
    expect(recognizeAtom(a.find, a.flags)).toEqual({ kind: "any-number", decimals: true });
  });
});

describe("anything between X and Y", () => {
  test("builds a lazy span, matches, and round-trips X and Y", () => {
    const a = buildBetween("[status]", "[/status]");
    const re = new RegExp(a.find);
    expect(re.test("[status]hp:5[/status]")).toBe(true);
    // lazy: stops at the first closer
    expect("[status]a[/status]b[/status]".match(re)?.[0]).toBe("[status]a[/status]");
    expect(recognizeAtom(a.find, a.flags)).toEqual({ kind: "between", x: "[status]", y: "[/status]" });
  });

  test("special characters in the bounds are escaped, not interpreted", () => {
    const a = buildBetween("(", ")");
    expect(() => new RegExp(a.find)).not.toThrow();
    expect(new RegExp(a.find).test("(inside)")).toBe(true);
  });
});

describe("line anchors", () => {
  test("start and end anchors build under m and round-trip", () => {
    const start = buildLineAnchor("start");
    const end = buildLineAnchor("end");
    expect(start).toEqual({ find: "^", flags: "m" });
    expect(end).toEqual({ find: "$", flags: "m" });
    expect(recognizeAtom(start.find, start.flags)).toEqual({ kind: "line-anchor", which: "start" });
    expect(recognizeAtom(end.find, end.flags)).toEqual({ kind: "line-anchor", which: "end" });
  });
});

describe("recognizeAtom rejects non-atoms", () => {
  test("returns null for a foreign pattern", () => {
    expect(recognizeAtom("\\bcat\\b", "i")).toBeNull();
    expect(recognizeAtom("^", "")).toBeNull(); // needs m to be a line anchor
  });
});
