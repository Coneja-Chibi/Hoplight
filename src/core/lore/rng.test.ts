import { describe, expect, test } from "bun:test";
import { cryptoUnit, freshSeed, mulberry32 } from "./rng";

describe("rng", () => {
  test("cryptoUnit is in [0, 1)", () => {
    for (let i = 0; i < 20; i++) {
      const u = cryptoUnit();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  test("mulberry32 is deterministic and not constant", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBeGreaterThan(1);
    for (const u of seqA) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  test("different seeds diverge", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  test("freshSeed is a finite uint-ish number", () => {
    const s = freshSeed();
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});
