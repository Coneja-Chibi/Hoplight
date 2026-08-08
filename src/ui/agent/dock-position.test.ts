/**
 * Where the floating panel is allowed to be.
 *
 * Every test here is a way somebody loses the panel and cannot get it back without clearing their
 * session storage, which is not a thing anybody will guess to do.
 */
import { describe, expect, test } from "bun:test";
import { clampSize, clampSpot, defaultSpot, dragTo, resizeFrame, restoreSpot } from "./dock-position";

const PANEL = { width: 420, height: 520 };
const VIEW = { width: 1440, height: 900 };

describe("clampSpot", () => {
  test("A PANEL CAN NEVER BE DRAGGED FULLY OFF SCREEN", () => {
    /**
     * The header is the only grab handle. Push it past the right edge and there is nothing left to
     * take hold of, and no visible affordance saying the panel exists at all.
     */
    const far = clampSpot({ x: 99_999, y: 99_999 }, PANEL, VIEW);
    expect(far.x).toBeLessThan(VIEW.width);
    expect(far.y).toBeLessThan(VIEW.height);
  });

  test("it may hang off the LEFT, but never so far that the header is gone", () => {
    // A wide panel on a narrow window should be able to slide left so its right side stays usable.
    const left = clampSpot({ x: -99_999, y: 100 }, PANEL, VIEW);
    expect(left.x).toBeLessThan(0);
    expect(left.x + PANEL.width).toBeGreaterThanOrEqual(80);
  });

  test("NEVER ABOVE THE TOP", () => {
    // Above zero puts the header under the window chrome, which is the one direction with no
    // recovery: you cannot grab what is not painted.
    expect(clampSpot({ x: 100, y: -500 }, PANEL, VIEW).y).toBe(0);
  });

  test("a position already on screen is left alone", () => {
    expect(clampSpot({ x: 300, y: 200 }, PANEL, VIEW)).toEqual({ x: 300, y: 200 });
  });
});

describe("dragTo", () => {
  test("THE GRAB OFFSET IS KEPT, so the panel moves instead of jumping", () => {
    /**
     * Without it the panel's corner snaps to the cursor the moment a drag begins, which reads as
     * the window being snatched out from under the pointer rather than dragged.
     */
    const grab = { x: 60, y: 12 };
    const moved = dragTo({ x: 500, y: 300 }, grab, PANEL, VIEW);
    expect(moved).toEqual({ x: 440, y: 288 });
  });

  test("a drag toward the edge still clamps", () => {
    const moved = dragTo({ x: 5000, y: 5000 }, { x: 0, y: 0 }, PANEL, VIEW);
    expect(moved.x).toBeLessThan(VIEW.width);
  });
});

describe("restoreSpot", () => {
  test("A POSITION FROM A BIGGER MONITOR IS PULLED BACK ONTO THIS ONE", () => {
    /**
     * Drag the panel to the right of a wide external display, undock the laptop, reopen. The stored
     * x is past the new viewport entirely, so the panel would open invisible - and nothing on screen
     * would explain why clicking the tile did nothing at all.
     */
    const small = { width: 1280, height: 720 };
    const restored = restoreSpot({ x: 3400, y: 1300 }, PANEL, small);
    expect(restored.x).toBeLessThan(small.width);
    expect(restored.y).toBeLessThan(small.height);
  });

  test("nothing remembered opens somewhere sensible", () => {
    const spot = restoreSpot(undefined, PANEL, VIEW);
    // Lower right, clear of the dock on the left.
    expect(spot.x).toBeGreaterThan(VIEW.width / 2);
    expect(spot.y).toBeGreaterThan(0);
  });

  test("rubbish in storage is ignored rather than trusted", () => {
    for (const junk of [null, "left", 42, { x: "1", y: 2 }, { x: NaN, y: 0 }, {}]) {
      const spot = restoreSpot(junk, PANEL, VIEW);
      expect(Number.isFinite(spot.x)).toBe(true);
      expect(Number.isFinite(spot.y)).toBe(true);
    }
  });
});

describe("clampSize", () => {
  test("never bigger than the window it is floating over", () => {
    const sized = clampSize({ width: 9000, height: 9000 }, { width: 800, height: 600 });
    expect(sized.width).toBeLessThanOrEqual(800);
    expect(sized.height).toBeLessThanOrEqual(600);
  });

  test("NEVER SMALLER THAN USABLE, even on a tiny window", () => {
    // The panel shows diffs somebody is authorising a write from. Squeezed to nothing it is not a
    // small panel, it is a panel that cannot be read at the exact moment reading matters.
    const sized = clampSize({ width: 10, height: 10 }, { width: 200, height: 200 });
    expect(sized.width).toBeGreaterThanOrEqual(320);
    expect(sized.height).toBeGreaterThanOrEqual(240);
  });
});

describe("NaN never reaches the DOM", () => {
  test("A NaN MEASUREMENT LANDS THE PANEL SOMEWHERE, not nowhere", () => {
    /**
     * `left:NaNpx` is DISCARDED by browsers, and it takes the fixed positioning with it - so the
     * panel falls into the page flow, unstyled and unfindable, with nothing logged. It reached the
     * real markup once: the viewport guard checked that `window` existed but not that `innerWidth`
     * was a number, which is exactly what a partial DOM shim or a bare webview provides.
     */
    const views = [
      { width: NaN, height: 900 },
      { width: 1440, height: NaN },
      { width: undefined as unknown as number, height: 900 },
    ];
    for (const view of views) {
      const spot = clampSpot({ x: 100, y: 100 }, PANEL, view);
      expect(Number.isFinite(spot.x)).toBe(true);
      expect(Number.isFinite(spot.y)).toBe(true);
    }
    // And a NaN position with a good viewport is equally unacceptable.
    const bad = clampSpot({ x: NaN, y: 0 }, PANEL, VIEW);
    expect(Number.isFinite(bad.x)).toBe(true);
  });

  test("dragTo and restoreSpot inherit the same protection", () => {
    const dragged = dragTo({ x: NaN, y: 10 }, { x: 0, y: 0 }, PANEL, VIEW);
    expect(Number.isFinite(dragged.x)).toBe(true);
    const restored = restoreSpot({ x: 10, y: 10 }, PANEL, { width: NaN, height: NaN });
    expect(Number.isFinite(restored.x)).toBe(true);
  });
});

describe("resizeFrame", () => {
  const START = { spot: { x: 400, y: 200 }, size: { width: 440, height: 560 } };

  test("pulling the east edge grows the width and leaves the corner alone", () => {
    const out = resizeFrame("e", { x: 900, y: 0 }, START, VIEW);
    expect(out.size.width).toBe(500);
    expect(out.spot).toEqual(START.spot);
  });

  test("THE OPPOSITE EDGE HOLDS STILL when you pull the left one", () => {
    /**
     * The whole difficulty. Changing only the width leaves the right edge sliding along with the
     * pointer, so the panel appears to run away from the hand dragging it. The right edge is the
     * thing that must not move, so x moves with the width.
     */
    const right = START.spot.x + START.size.width;
    const out = resizeFrame("w", { x: 300, y: 0 }, START, VIEW);

    expect(out.spot.x).toBe(300);
    expect(out.spot.x + out.size.width).toBe(right);
  });

  test("the same for the top edge and the bottom", () => {
    const bottom = START.spot.y + START.size.height;
    const out = resizeFrame("n", { x: 0, y: 300 }, START, VIEW);
    expect(out.spot.y).toBe(300);
    expect(out.spot.y + out.size.height).toBe(bottom);
  });

  test("a corner moves both axes at once", () => {
    const out = resizeFrame("se", { x: 1000, y: 900 }, START, VIEW);
    expect(out.size.width).toBe(600);
    expect(out.size.height).toBeGreaterThan(START.size.height);
  });

  test("PULLING PAST THE MINIMUM STOPS THE EDGE, it does not invert the panel", () => {
    /**
     * Drag the left handle far past the right edge. Without clamping the size before deriving the
     * position, the width goes negative and the panel flips inside out and walks off with the
     * pointer - a state there is no way to drag back from.
     */
    const out = resizeFrame("w", { x: 5000, y: 0 }, START, VIEW);
    expect(out.size.width).toBeGreaterThanOrEqual(320);
    expect(out.spot.x).toBeLessThan(START.spot.x + START.size.width);
  });

  test("it never grows past the window", () => {
    const out = resizeFrame("se", { x: 99_999, y: 99_999 }, START, VIEW);
    expect(out.size.width).toBeLessThanOrEqual(VIEW.width);
    expect(out.size.height).toBeLessThanOrEqual(VIEW.height);
  });

  test("a NaN pointer does not produce a NaN frame", () => {
    // Same reason as clampSpot: NaN reaches the DOM as a dropped style, and the panel loses its
    // positioning with nothing logged.
    const out = resizeFrame("se", { x: NaN, y: NaN }, START, VIEW);
    expect(Number.isFinite(out.spot.x)).toBe(true);
    expect(Number.isFinite(out.size.width)).toBe(true);
  });
});
