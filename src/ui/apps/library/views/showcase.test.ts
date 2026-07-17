/**
 * Showcase index clamping. Regression for the audit's LOGIC-001: clamping the lower bound FIRST
 * (`Math.min(Math.max(raw, 0), len - 1)`) returns -1 for an empty deck, which indexed to undefined
 * and crashed the whole Library - with no error boundary and both the view and deck persisted, that
 * white-screened the studio on every launch until prefs were cleared.
 */
import { describe, expect, test } from "bun:test";
import { clampIndex } from "./showcase";

describe("clampIndex", () => {
  test("never returns a negative index, whatever the length", () => {
    for (const len of [0, 1, 2, 10]) {
      for (const raw of [-5, -1, 0, 1, 3, 99]) {
        expect(clampIndex(raw, len)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("an empty deck clamps to 0, not -1 (the crash)", () => {
    expect(clampIndex(0, 0)).toBe(0);
    expect(clampIndex(7, 0)).toBe(0);
    expect(clampIndex(-3, 0)).toBe(0);
  });

  test("stays in range for a populated deck", () => {
    expect(clampIndex(0, 3)).toBe(0);
    expect(clampIndex(2, 3)).toBe(2);
    expect(clampIndex(9, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
  });

  test("single-item deck always resolves to its only index", () => {
    for (const raw of [-2, 0, 1, 50]) expect(clampIndex(raw, 1)).toBe(0);
  });
});
