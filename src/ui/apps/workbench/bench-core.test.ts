/**
 * bench-core tests - deck grouping, the floated-deck perspective plan, the pack summary line.
 */
import { describe, expect, test } from "bun:test";
import type { StudioEntitySummary } from "../../app-contract";
import { deckCounts, floatPlan, packSummary } from "./bench-core";
import { clampSize, SIZE_RANGE } from "./view-contract";

const e = (kind: string, id: string): StudioEntitySummary => ({ id, kind, name: id });

describe("deckCounts", () => {
  test("counts per kind in the given order, zeros included", () => {
    const out = deckCounts([e("character", "a"), e("character", "b"), e("lorebook", "c")], [
      "character",
      "lorebook",
      "persona",
    ]);
    expect(out).toEqual([
      { kind: "character", count: 2 },
      { kind: "lorebook", count: 1 },
      { kind: "persona", count: 0 },
    ]);
  });
  test("unknown kinds append after the known order (open by design)", () => {
    const out = deckCounts([e("regex", "r")], ["character"]);
    expect(out).toEqual([
      { kind: "character", count: 0 },
      { kind: "regex", count: 1 },
    ]);
  });
});

describe("floatPlan", () => {
  test("center card sits forward, wings tilt away symmetrically (the locked spread)", () => {
    expect(floatPlan(5)).toEqual([
      { tilt: 16, rise: 10 },
      { tilt: 8, rise: 5 },
      { tilt: 0, rise: 0 },
      { tilt: -8, rise: 5 },
      { tilt: -16, rise: 10 },
    ]);
  });
  test("a single card stands square", () => {
    expect(floatPlan(1)).toEqual([{ tilt: 0, rise: 0 }]);
  });
  test("empty deck plans nothing", () => {
    expect(floatPlan(0)).toEqual([]);
  });
});

describe("clampSize", () => {
  test("clamps into the legal range, fails closed to the fallback", () => {
    expect(clampSize(8.5)).toBe(8.5);
    expect(clampSize(0)).toBe(SIZE_RANGE.min);
    expect(clampSize(999)).toBe(SIZE_RANGE.max);
    expect(clampSize("large")).toBe(SIZE_RANGE.fallback);
    expect(clampSize(NaN)).toBe(SIZE_RANGE.fallback);
    expect(clampSize(undefined)).toBe(SIZE_RANGE.fallback);
  });
});

describe("packSummary", () => {
  test("counts pieces and distinct kinds with honest plurals", () => {
    expect(packSummary([])).toBe("0 pieces · 0 kinds");
    expect(packSummary([e("character", "v")])).toBe("1 piece · 1 kind");
    expect(packSummary([e("character", "v"), e("lorebook", "n"), e("preset", "c")])).toBe("3 pieces · 3 kinds");
    expect(packSummary([e("character", "v"), e("character", "a")])).toBe("2 pieces · 1 kind");
  });
});
