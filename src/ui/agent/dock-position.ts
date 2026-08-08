/**
 * Where the floating agent panel sits, and how it survives a window that changed size.
 *
 * ORISON'S SHAPE. Vaudeville's panel is `position: fixed`, dragged by its header, and remembered
 * between visits - and the reason it works is not the dragging. It is that the agent stays on screen
 * WHILE you use the thing you are asking about. A dock app cannot do that: the shell swaps one app
 * into one slot, so opening the agent hides the screen it is describing.
 *
 * Pure, because every bug in a draggable panel is arithmetic. A panel dragged mostly off screen and
 * then unreachable, a remembered position from a 4K monitor restoring onto a laptop, a drag that
 * jumps because the grab offset was not kept: all of them are this file getting it wrong, and none
 * of them need a browser to catch.
 */

export interface Spot {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * How much of the panel must remain on screen.
 *
 * Enough to grab the header back. A panel that can be dragged fully off is a panel somebody has to
 * clear their session storage to recover, and they will not know that is what to do.
 */
const KEEP_VISIBLE = 80;
/** The header is the grab handle, so its band is what must never go above the top edge. */
const HEADER = 34;

/** Put a position inside a viewport, keeping enough of the panel reachable. */
export function clampSpot(spot: Spot, panel: Size, view: Size): Spot {
  /**
   * A BELT AGAINST NaN, because one NaN anywhere upstream reaches the DOM as `left:NaNpx` - which
   * browsers discard, taking the fixed positioning with it and leaving the panel somewhere in the
   * page flow with no error to explain it. Callers should hand over real numbers; when they do not,
   * the corner is a much better answer than nowhere.
   */
  if (![spot.x, spot.y, panel.width, panel.height, view.width, view.height].every(Number.isFinite)) {
    return { x: 24, y: 24 };
  }
  const maxX = view.width - KEEP_VISIBLE;
  const maxY = view.height - HEADER;
  /**
   * The left bound allows a NEGATIVE x, on purpose: a wide panel on a narrow window should be able
   * to hang off the left so its right-hand side stays usable. What it may not do is go so far that
   * the header is unreachable.
   */
  const minX = KEEP_VISIBLE - panel.width;
  return {
    x: Math.min(maxX, Math.max(minX, spot.x)),
    // Never above the top: the header would go under the window chrome with nothing to grab.
    y: Math.min(maxY, Math.max(0, spot.y)),
  };
}

/**
 * Where a drag puts the panel.
 *
 * `grab` is the offset from the panel's own top-left to where the pointer went down, and keeping it
 * is the whole trick: without it the panel jumps so its corner meets the cursor the instant a drag
 * starts, which feels like the panel was snatched rather than moved.
 */
export function dragTo(pointer: Spot, grab: Spot, panel: Size, view: Size): Spot {
  return clampSpot({ x: pointer.x - grab.x, y: pointer.y - grab.y }, panel, view);
}

/** Where a panel opens when nothing is remembered: lower right, clear of the dock on the left. */
export function defaultSpot(panel: Size, view: Size): Spot {
  return clampSpot({ x: view.width - panel.width - 24, y: view.height - panel.height - 48 }, panel, view);
}

/**
 * Restore a remembered position onto whatever window exists now.
 *
 * REMEMBERED POSITIONS OUTLIVE MONITORS. Somebody drags the panel to the far right of a wide
 * external display, undocks the laptop, and the stored x is beyond the new viewport entirely. The
 * panel would be invisible, and nothing on screen would explain why opening it did nothing.
 */
export function restoreSpot(stored: unknown, panel: Size, view: Size): Spot {
  if (
    typeof stored !== "object" || stored === null
    || typeof (stored as Spot).x !== "number" || typeof (stored as Spot).y !== "number"
    || !Number.isFinite((stored as Spot).x) || !Number.isFinite((stored as Spot).y)
  ) {
    return defaultSpot(panel, view);
  }
  return clampSpot(stored as Spot, panel, view);
}

/** The smallest a panel showing a diff somebody is authorising may be squeezed. */
const MIN_W = 320;
const MIN_H = 240;

/**
 * Keep a size usable: big enough to read a diff in, never bigger than the window.
 *
 * NaN GUARDED, like clampSpot. `Math.max(320, NaN)` is NaN, so a single bad measurement anywhere
 * upstream propagated straight through to `width:NaNpx` - which the browser discards, collapsing
 * the panel to its content with no error. The minimum is the right answer when the numbers are not
 * numbers, because a small panel can be resized and an unstyled one cannot.
 */
export function clampSize(size: Size, view: Size): Size {
  const w = Number.isFinite(size.width) ? size.width : MIN_W;
  const h = Number.isFinite(size.height) ? size.height : MIN_H;
  const roomW = Number.isFinite(view.width) ? view.width - 16 : MIN_W;
  const roomH = Number.isFinite(view.height) ? view.height - 16 : MIN_H;
  return {
    width: Math.min(Math.max(MIN_W, w), Math.max(MIN_W, roomW)),
    height: Math.min(Math.max(MIN_H, h), Math.max(MIN_H, roomH)),
  };
}

/** Which handle is being pulled. */
export type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** A panel's whole geometry: where it is and how big. */
export interface Frame {
  readonly spot: Spot;
  readonly size: Size;
}

/**
 * Where a resize drag leaves the panel.
 *
 * THE OPPOSITE EDGE MUST NOT MOVE. Pulling the left edge changes the width AND the x, because the
 * right edge is supposed to stay exactly where it was; computing only the width makes the panel
 * appear to slide away from the pointer. The same for the top edge and y. That is the entire
 * difficulty here, and it is why this is a function with tests rather than four lines in a handler.
 *
 * `start` is the frame as it was when the pointer went down, not the live one. Reading the live
 * frame each move compounds its own rounding, and a slow drag visibly drifts.
 */
export function resizeFrame(edge: Edge, pointer: Spot, start: Frame, view: Size): Frame {
  const right = start.spot.x + start.size.width;
  const bottom = start.spot.y + start.size.height;

  let { x, y } = start.spot;
  let { width, height } = start.size;

  if (edge.includes("e")) width = pointer.x - start.spot.x;
  if (edge.includes("s")) height = pointer.y - start.spot.y;
  if (edge.includes("w")) width = right - pointer.x;
  if (edge.includes("n")) height = bottom - pointer.y;

  // Clamped BEFORE the position is derived, so a pull past the minimum stops the edge dead rather
  // than letting it cross over and drag the panel backwards with it.
  const size = clampSize({ width, height }, view);
  if (edge.includes("w")) x = right - size.width;
  if (edge.includes("n")) y = bottom - size.height;

  return { spot: clampSpot({ x, y }, size, view), size };
}
