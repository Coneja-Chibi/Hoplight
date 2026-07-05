/**
 * bench-core tests - the pack summary line.
 */
import { describe, expect, test } from "bun:test";
import type { StudioEntitySummary } from "../../app-contract";
import { packSummary } from "./bench-core";

const e = (kind: string, id: string): StudioEntitySummary => ({ id, kind, name: id });

describe("packSummary", () => {
  test("counts pieces and distinct kinds with honest plurals", () => {
    expect(packSummary([])).toBe("0 pieces · 0 kinds");
    expect(packSummary([e("character", "v")])).toBe("1 piece · 1 kind");
    expect(packSummary([e("character", "v"), e("lorebook", "n"), e("preset", "c")])).toBe("3 pieces · 3 kinds");
    expect(packSummary([e("character", "v"), e("character", "a")])).toBe("2 pieces · 1 kind");
  });
});
