/**
 * Where the divider lands. The drag itself is a pointer gesture this suite cannot fire, so the
 * arithmetic under it is proven directly - that is the part that can put a pane at zero width.
 */
import { describe, expect, test } from "bun:test";
import {
  clampSplit,
  readSplit,
  splitFromKey,
  splitFromPointer,
  SPLIT_DEFAULT,
  SPLIT_MAX,
  SPLIT_MIN,
} from "./htmldoc-split";

describe("clampSplit", () => {
  test("neither pane can be dragged out of existence", () => {
    expect(clampSplit(0)).toBe(SPLIT_MIN);
    expect(clampSplit(-40)).toBe(SPLIT_MIN);
    expect(clampSplit(100)).toBe(SPLIT_MAX);
    expect(clampSplit(50)).toBe(50);
  });

  test("a value that is not a number is the default, never NaN in a style string", () => {
    expect(clampSplit(Number.NaN)).toBe(SPLIT_DEFAULT);
    expect(clampSplit(Number.POSITIVE_INFINITY)).toBe(SPLIT_DEFAULT);
  });
});

describe("readSplit", () => {
  test("anything unusable in settings opens at the default rather than collapsed", () => {
    for (const stored of [undefined, null, "60", {}, [], true]) {
      expect(readSplit(stored)).toBe(SPLIT_DEFAULT);
    }
    expect(readSplit(72)).toBe(72);
    // A number saved by an older build outside the current bounds is pulled back in.
    expect(readSplit(4)).toBe(SPLIT_MIN);
  });
});

describe("splitFromPointer", () => {
  test("the divider follows the pointer across the room", () => {
    expect(splitFromPointer(300, 100, 800, 50)).toBe(25);
    expect(splitFromPointer(500, 100, 800, 50)).toBe(50);
    expect(splitFromPointer(700, 100, 800, 50)).toBe(75);
  });

  test("dragging past either edge stops at the bound", () => {
    expect(splitFromPointer(0, 100, 800, 50)).toBe(SPLIT_MIN);
    expect(splitFromPointer(5000, 100, 800, 50)).toBe(SPLIT_MAX);
  });

  test("a room with no width yet leaves the split where it was", () => {
    // First paint, or a hidden tab: dividing by zero here would write NaN into the grid.
    expect(splitFromPointer(300, 0, 0, 62)).toBe(62);
  });
});

describe("splitFromKey", () => {
  test("arrows nudge, Home and End go to the bounds", () => {
    expect(splitFromKey("ArrowLeft", 50)).toBe(46);
    expect(splitFromKey("ArrowRight", 50)).toBe(54);
    expect(splitFromKey("Home", 50)).toBe(SPLIT_MIN);
    expect(splitFromKey("End", 50)).toBe(SPLIT_MAX);
  });

  test("nudging at the bound stays at the bound", () => {
    expect(splitFromKey("ArrowLeft", SPLIT_MIN)).toBe(SPLIT_MIN);
    expect(splitFromKey("ArrowRight", SPLIT_MAX)).toBe(SPLIT_MAX);
  });

  test("a key that is not ours is left alone, so typing elsewhere is never swallowed", () => {
    for (const key of ["a", "Enter", "Tab", " ", "ArrowUp"]) {
      expect(splitFromKey(key, 50)).toBeNull();
    }
  });
});
