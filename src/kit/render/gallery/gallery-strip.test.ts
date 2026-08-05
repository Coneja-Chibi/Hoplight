/**
 * The window maths, which is the part that can be wrong without looking wrong.
 *
 * A strip that scrolls a card too early or too late still draws faces, so the failure is invisible
 * in a screenshot and only shows as the cursor vanishing off an edge while you arrow through. These
 * are the cases that produce that: the ends, where centring has to stop, and a shelf smaller than
 * the window, where an off-by-one leaves a gap.
 */
import { describe, expect, test } from "bun:test";
import { windowFor } from "./gallery-strip";

describe("windowFor", () => {
  test("an empty shelf asks for nothing", () => {
    expect(windowFor(0, 0, 5)).toEqual({ start: 0, end: 0 });
  });

  test("a shelf smaller than the window shows all of it", () => {
    expect(windowFor(3, 1, 8)).toEqual({ start: 0, end: 3 });
  });

  test("the cursor sits in the middle when there is room on both sides", () => {
    const { start, end } = windowFor(20, 10, 5);
    expect(start).toBe(8);
    expect(end).toBe(13);
    expect(10).toBeGreaterThanOrEqual(start);
    expect(10).toBeLessThan(end);
  });

  test("the first page is full rather than half empty", () => {
    // Centring on index 0 would ask for a negative start; clamping must not shrink the window.
    expect(windowFor(20, 0, 5)).toEqual({ start: 0, end: 5 });
  });

  test("the last page is full rather than half empty", () => {
    expect(windowFor(20, 19, 5)).toEqual({ start: 15, end: 20 });
  });

  test("the cursor is inside the window at every index", () => {
    // The property that actually matters, checked across the whole shelf rather than at three spots.
    for (let i = 0; i < 40; i++) {
      const { start, end } = windowFor(40, i, 7);
      expect(i).toBeGreaterThanOrEqual(start);
      expect(i).toBeLessThan(end);
      expect(end - start).toBe(7);
    }
  });
});
