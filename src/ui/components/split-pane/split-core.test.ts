/**
 * Where the divider is allowed to be.
 *
 * The failure worth guarding is not "the split is slightly off". It is a pane dragged to nothing,
 * whose handle then sits under the window edge with nothing left to grab - unrecoverable without
 * clearing a preference nobody knows exists.
 */
import { describe, expect, test } from "bun:test";
import { clampSplit, MIN_PANE_PX, nudgeSplit, parseSplit, splitFromPointer } from "./split-core";

const WIDE = 1400;

describe("clampSplit", () => {
  test("NEITHER PANE CAN BE SQUEEZED TO NOTHING", () => {
    const far = clampSplit(0.999, WIDE);
    const near = clampSplit(0.001, WIDE);
    expect(far * WIDE).toBeLessThanOrEqual(WIDE - MIN_PANE_PX);
    expect(near * WIDE).toBeGreaterThanOrEqual(MIN_PANE_PX);
  });

  test("A WINDOW TOO NARROW FOR TWO PANES SPLITS EVENLY", () => {
    /**
     * With no floor for both, min > max and a naive clamp returns whatever it was handed - which on
     * a very narrow window means one pane at zero. Half each is at least coherent.
     */
    expect(clampSplit(0.9, 300)).toBe(0.5);
  });

  test("rubbish falls back to a usable default rather than NaN", () => {
    // A NaN width reaches here on the very first render, before the container has been measured.
    for (const [split, width] of [[NaN, WIDE], [0.3, 0], [0.3, NaN]] as const) {
      expect(Number.isFinite(clampSplit(split, width))).toBe(true);
    }
  });

  test("a sensible split is untouched", () => {
    expect(clampSplit(0.32, WIDE)).toBe(0.32);
  });
});

describe("splitFromPointer", () => {
  test("the divider follows the pointer", () => {
    // Measured from the right edge, because the right pane is the one whose size is being stated.
    const split = splitFromPointer(1000, { left: 0, width: WIDE });
    expect(split).toBeCloseTo((WIDE - 1000) / WIDE, 5);
  });

  test("a container offset from the window edge is accounted for", () => {
    // The pane does not start at x=0: there is a dock to its left. Measured against a container
    // wide enough that the answer is not the floor, or this would pass without proving anything.
    const split = splitFromPointer(900, { left: 200, width: 1000 });
    expect(split).toBeCloseTo(0.3, 5);
  });

  test("DRAGGING PAST THE EDGE STILL LEAVES BOTH PANES USABLE", () => {
    // The pointer leaves the window during a fast drag; the divider must not follow it out.
    const split = splitFromPointer(-500, { left: 0, width: WIDE });
    expect(split * WIDE).toBeLessThanOrEqual(WIDE - MIN_PANE_PX);
  });
});

describe("nudgeSplit", () => {
  test("arrows move the divider the way they point", () => {
    // Left grows the right pane, because left is where the divider goes.
    expect(nudgeSplit(0.3, "left", WIDE)).toBeGreaterThan(0.3);
    expect(nudgeSplit(0.3, "right", WIDE)).toBeLessThan(0.3);
  });

  test("nudging into the wall stops at the wall", () => {
    // Held-down arrow keys are how a keyboard user finds the limit; it must be a limit, not a hole.
    let split = 0.5;
    for (let i = 0; i < 200; i++) split = nudgeSplit(split, "left", WIDE);
    expect(split * WIDE).toBeLessThanOrEqual(WIDE - MIN_PANE_PX);
  });
});

describe("parseSplit", () => {
  test("a stored preference is honoured", () => {
    expect(parseSplit(0.4)).toBe(0.4);
  });

  test("A VALUE OUTSIDE THE RANGE IS NOT A PREFERENCE", () => {
    // It is an older build's format, or a corrupted pref. Restoring it would open the app with one
    // pane collapsed and no obvious cause.
    for (const junk of [0, 1, -0.5, 1.5, "0.4", null, undefined, NaN]) {
      expect(parseSplit(junk)).toBeNull();
    }
  });
});
