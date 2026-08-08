/**
 * The cases that make a step key look dead.
 *
 * Every one of these was reachable in a real studio and none is visible by eye: the rail just does
 * not move, which is indistinguishable from a key that never arrived.
 */
import { describe, expect, test } from "bun:test";
import { nextPreset } from "./next-preset";

const shelf = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("nextPreset", () => {
  test("steps forward and back", () => {
    expect(nextPreset(shelf, "a", 1)).toBe("b");
    expect(nextPreset(shelf, "b", -1)).toBe("a");
  });

  test("wraps at both ends", () => {
    expect(nextPreset(shelf, "c", 1)).toBe("a");
    expect(nextPreset(shelf, "a", -1)).toBe("c");
  });

  test("a missing id still honours the direction", () => {
    // The bug: this used to pin to index 0 whichever way you pressed, so on a rail already showing
    // the first preset both arrows re-opened what was already there and the key read as dead.
    expect(nextPreset(shelf, "gone", 1)).toBe("a");
    expect(nextPreset(shelf, "gone", -1)).toBe("c");
  });

  test("a shelf of one has nowhere to go, and says so rather than reopening itself", () => {
    expect(nextPreset([{ id: "only" }], "only", 1)).toBeNull();
  });

  test("an empty shelf is null, not a crash", () => {
    expect(nextPreset([], "a", 1)).toBeNull();
    expect(nextPreset([], null, -1)).toBeNull();
  });

  test("no preset open yet enters from the near end", () => {
    expect(nextPreset(shelf, null, 1)).toBe("a");
    expect(nextPreset(shelf, null, -1)).toBe("c");
  });
});
