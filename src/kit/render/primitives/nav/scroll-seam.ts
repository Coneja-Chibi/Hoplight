/**
 * scroll-seam: the pure core the whole nav cluster stands on. The scrollbox renderable emits no scroll
 * event, so the hook polls its metrics and folds them through here. readScroll mirrors the renderer's
 * OWN threshold exactly (maxScrollTop = scrollHeight - viewportHeight; content is scrollable only when
 * that exceeds 1; at-bottom the instant scrollTop reaches it), so the new-below pill never shows with
 * nothing to scroll and never flickers at the boundary. trackNewBelow counts lines appended while the
 * user is scrolled up and resets to zero the moment they return to the bottom. Total, never throws.
 */
import { cap99 } from "./cap";

/** Where the scrollback sits right now, derived from the renderable's raw numbers. */
export interface ScrollMetrics {
  /** scrollTop has reached the farthest-down position (the newest line is pinned). */
  readonly atBottom: boolean;
  /** The farthest scrollTop can go: max(0, content - viewport). */
  readonly maxScrollTop: number;
  /** How many rows below the viewport remain, 0 when at the bottom. */
  readonly distanceRows: number;
  /** There is more content than fits (the renderer's own maxScrollTop > 1 gate). */
  readonly scrollable: boolean;
}

/** Raw metrics read off the scrollbox ref each poll. */
export interface ScrollReading {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly viewportHeight: number;
}

/** Derive the scroll state from the renderable's numbers, matching its internal thresholds. */
export function readScroll({ scrollTop, scrollHeight, viewportHeight }: ScrollReading): ScrollMetrics {
  const maxScrollTop = Math.max(0, scrollHeight - viewportHeight);
  const scrollable = maxScrollTop > 1;
  const atBottom = scrollTop >= maxScrollTop;
  const distanceRows = Math.max(0, maxScrollTop - scrollTop);
  return { atBottom, maxScrollTop, distanceRows, scrollable };
}

/** How many appended-but-unseen lines there are while scrolled up, and whether to show the pill. */
export interface NewBelowState {
  readonly unseen: number;
  readonly show: boolean;
  /** The line count at the last poll, so the next delta is measured against it. */
  readonly lastCount: number;
}

/** Seed the tracker at mount with the current line count, so the first poll measures no false delta. */
export const initNewBelow = (lineCount: number): NewBelowState => ({
  unseen: 0,
  show: false,
  lastCount: lineCount,
});

/** Fold a poll into the tracker: reset at the bottom, else add the newly appended lines to unseen. */
export function trackNewBelow(
  state: NewBelowState,
  poll: { atBottom: boolean; lineCount: number },
): NewBelowState {
  if (poll.atBottom) return { unseen: 0, show: false, lastCount: poll.lineCount };
  const appended = Math.max(0, poll.lineCount - state.lastCount);
  const unseen = state.unseen + appended;
  return { unseen, show: unseen > 0, lastCount: poll.lineCount };
}

/** The pill copy for a given unseen count, capped for display so it stays one short line. */
export const newBelowLabel = (unseen: number): string => `${cap99(unseen)} new below · End to jump`;
