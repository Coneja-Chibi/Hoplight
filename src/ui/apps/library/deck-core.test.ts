/**
 * deck-core + view-contract tests - the shelves' pure math: per-kind counts and the size dial's
 * fail-closed clamp.
 */
import { describe, expect, test } from "bun:test";
import type { StudioEntitySummary } from "../../app-contract";
import { deckCounts } from "./deck-core";
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
