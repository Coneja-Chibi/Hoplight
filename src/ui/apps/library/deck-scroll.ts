/**
 * Library deck-chip wheel handling for reaching horizontally overflowed desktop decks.
 */
import { useRef } from "react";

/**
 * Map wheel input to the horizontal overflow of the Library's deck-chip row.
 */
type HorizontalScrollViewport = Pick<HTMLElement, "clientWidth" | "scrollLeft" | "scrollWidth">;

const DEFAULT_LINE_HEIGHT_PX = 16;
const DELTA_MODE_LINE = 1;
const DELTA_MODE_PAGE = 2;

export function scrollDecksOnWheel(
  row: HorizontalScrollViewport,
  deltaX: number,
  deltaY: number,
  deltaMode = 0,
  lineHeightPx = DEFAULT_LINE_HEIGHT_PX,
): boolean {
  const distance = (deltaX || deltaY) * wheelDeltaScale(row, deltaMode, lineHeightPx);
  const maxScroll = row.scrollWidth - row.clientWidth;
  if (!Number.isFinite(distance) || distance === 0 || maxScroll <= 0) return false;

  const next = Math.max(0, Math.min(maxScroll, row.scrollLeft + distance));
  if (next === row.scrollLeft) return false;
  row.scrollLeft = next;
  return true;
}

function wheelDeltaScale(
  row: HorizontalScrollViewport,
  deltaMode: number,
  lineHeightPx: number,
): number {
  if (deltaMode === DELTA_MODE_LINE) {
    return Number.isFinite(lineHeightPx) && lineHeightPx > 0
      ? lineHeightPx
      : DEFAULT_LINE_HEIGHT_PX;
  }
  return deltaMode === DELTA_MODE_PAGE ? row.clientWidth : 1;
}

export function handleDeckWheel(
  row: HTMLElement,
  event: WheelEvent,
  lineHeightPx = DEFAULT_LINE_HEIGHT_PX,
): void {
  if (event.ctrlKey) return;
  if (scrollDecksOnWheel(row, event.deltaX, event.deltaY, event.deltaMode, lineHeightPx)) {
    event.preventDefault();
  }
}

function computedLineHeight(row: HTMLElement): number {
  const lineHeight = Number.parseFloat(window.getComputedStyle(row).lineHeight);
  return Number.isFinite(lineHeight) && lineHeight > 0
    ? lineHeight
    : DEFAULT_LINE_HEIGHT_PX;
}

export function attachDeckWheelListener(row: HTMLElement): () => void {
  const listener = (event: WheelEvent) => {
    const lineHeightPx = event.deltaMode === DELTA_MODE_LINE
      ? computedLineHeight(row)
      : DEFAULT_LINE_HEIGHT_PX;
    handleDeckWheel(row, event, lineHeightPx);
  };
  row.addEventListener("wheel", listener, { passive: false });
  return () => row.removeEventListener("wheel", listener);
}

export function createDeckWheelRef(): (row: HTMLDivElement | null) => void {
  let detach: (() => void) | null = null;
  return (row) => {
    detach?.();
    detach = row ? attachDeckWheelListener(row) : null;
  };
}

export function useDeckWheelRef() {
  const ref = useRef<((row: HTMLDivElement | null) => void) | null>(null);
  if (!ref.current) ref.current = createDeckWheelRef();
  return ref.current;
}
