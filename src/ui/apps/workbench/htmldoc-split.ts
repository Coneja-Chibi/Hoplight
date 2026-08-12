/**
 * Where the divider sits between the source and the drawing - pure, because a drag is not testable
 * here and the arithmetic is the part that can be wrong.
 *
 * A wireframe is judged by looking at it, so the source half is often in the way; the divider moves
 * and the source hides entirely. Both are remembered per person, since somebody who works one way
 * works that way tomorrow.
 */

/** Percent of the room the source pane takes. Bounded so neither pane can be dragged to nothing. */
export const SPLIT_MIN = 15;
export const SPLIT_MAX = 85;
export const SPLIT_DEFAULT = 50;

export const clampSplit = (pct: number): number =>
  Number.isFinite(pct) ? Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(pct))) : SPLIT_DEFAULT;

/** A remembered value, taking anything unusable as the default rather than a collapsed pane. */
export const readSplit = (stored: unknown): number =>
  typeof stored === "number" ? clampSplit(stored) : SPLIT_DEFAULT;

/**
 * The divider's new place from a pointer at `clientX` over a room spanning `left`..`left + width`.
 * Width zero means the room has not been laid out yet, so the current value stands.
 */
export function splitFromPointer(clientX: number, left: number, width: number, current: number): number {
  if (!Number.isFinite(width) || width <= 0) return clampSplit(current);
  return clampSplit(((clientX - left) / width) * 100);
}

/** Arrow keys nudge, Home/End go to the bounds; anything else leaves it alone (null = not ours). */
export function splitFromKey(key: string, current: number, step = 4): number | null {
  if (key === "ArrowLeft") return clampSplit(current - step);
  if (key === "ArrowRight") return clampSplit(current + step);
  if (key === "Home") return SPLIT_MIN;
  if (key === "End") return SPLIT_MAX;
  return null;
}
