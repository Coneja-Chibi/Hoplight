/**
 * Where the divider sits between two panes.
 *
 * Pure, because the arithmetic is the part that goes wrong: a drag that inverts when the pointer
 * crosses the handle, a pane that can be dragged to nothing and then cannot be dragged back, a
 * remembered width that is wider than the window somebody opened it on today.
 */

/** How much of the container the RIGHT pane takes, as a fraction. */
export type Split = number;

/**
 * Neither pane may be squeezed below this.
 *
 * A pane dragged to zero looks broken and, worse, is often unrecoverable: the handle ends up under
 * the window edge with nothing left to grab. The floor is in pixels rather than a fraction because
 * "too small to use" is a property of the content, not of the window.
 */
export const MIN_PANE_PX = 220;

/** Keep a split inside what this width can actually hold. */
export function clampSplit(split: Split, width: number): Split {
  if (!Number.isFinite(split) || !Number.isFinite(width) || width <= 0) return 0.32;
  const min = MIN_PANE_PX / width;
  const max = 1 - min;
  /**
   * A container too narrow for two usable panes gets an even split rather than a contradiction.
   * Without this, min > max and the clamp returns whatever it was handed, which on a very narrow
   * window means one pane at zero.
   */
  if (min >= max) return 0.5;
  return Math.min(max, Math.max(min, split));
}

/**
 * The split a pointer at `clientX` implies.
 *
 * Measured from the RIGHT edge, because the right pane is the one whose size is being stated. Doing
 * it from the left and subtracting is the same arithmetic with one more chance to get the sign
 * wrong, which is how a drag ends up moving the divider away from the pointer.
 */
export function splitFromPointer(clientX: number, rect: { left: number; width: number }): Split {
  if (rect.width <= 0) return 0.32;
  const fromRight = rect.left + rect.width - clientX;
  return clampSplit(fromRight / rect.width, rect.width);
}

/** Nudge for keyboard use. Arrow keys move the divider; the handle is focusable. */
export function nudgeSplit(split: Split, direction: "left" | "right", width: number): Split {
  // A visible step. Percent-of-width rather than pixels so it feels the same on any monitor.
  const step = 0.02;
  return clampSplit(direction === "left" ? split + step : split - step, width);
}

/** Read a stored split, ignoring anything that is not one. */
export function parseSplit(stored: unknown): Split | null {
  if (typeof stored !== "number" || !Number.isFinite(stored)) return null;
  // A stored value outside the range is from an older build or a corrupted pref, not a preference.
  if (stored <= 0 || stored >= 1) return null;
  return stored;
}
