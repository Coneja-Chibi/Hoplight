/**
 * Dragging a box over the shelf, the way a file manager does.
 *
 * THE MEASURING, AND NOTHING ELSE. Which cards a box touches, whether a drag was a drag, and what
 * the selection becomes are all decided in select-core.ts where they can be tested; this listens to
 * a pointer and reads rectangles off the DOM, which are the two things a test cannot do for you.
 *
 * IT STARTS ON EMPTY SPACE ONLY. A drag that begins on a card is that card's business - it may be a
 * click, or somebody highlighting a name to copy it - and stealing the gesture there would make the
 * names unselectable again the moment the box was added.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { boxOf, isDrag, type Box } from "./select-core";

export interface MarqueeRoom {
  /** Put this on the scrolling container the cards live in. */
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  /** The box to draw right now, in coordinates relative to the container, or null. */
  readonly box: Box | null;
}

/** Every card that offers a key, with its rectangle in page coordinates. */
const cardsIn = (root: HTMLElement): { key: string; box: Box }[] =>
  [...root.querySelectorAll<HTMLElement>("[data-pick]")].map((node) => {
    const r = node.getBoundingClientRect();
    return {
      key: node.dataset["pick"] ?? "",
      box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
    };
  });

export function useMarquee(
  onSweep: (cards: readonly { key: string; box: Box }[], box: Box, additive: boolean) => void,
): MarqueeRoom {
  const [box, setBox] = useState<Box | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const additiveRef = useRef(false);
  const sweepRef = useRef(onSweep);
  sweepRef.current = onSweep;

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    // Left button only, and only on the container itself: a press that landed on a card bubbled up
    // to here, and that press belongs to the card.
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    rootRef.current = event.currentTarget;
    startRef.current = { x: event.clientX, y: event.clientY };
    additiveRef.current = event.shiftKey || event.ctrlKey || event.metaKey;
  }, []);

  /**
   * WINDOW-LEVEL, so a drag that leaves the shelf still finishes. Listening on the container alone
   * loses the pointer the moment it crosses the dock or the status bar, and the box then sticks to
   * the screen with no way to release it.
   */
  useEffect(() => {
    const move = (event: PointerEvent): void => {
      const start = startRef.current;
      if (!start) return;
      const next = boxOf(start, { x: event.clientX, y: event.clientY });
      // Nothing is drawn until the pointer has actually travelled: a plain click on the background
      // should not flash a rectangle.
      setBox(isDrag(next) ? next : null);
    };
    const up = (event: PointerEvent): void => {
      const start = startRef.current;
      const root = rootRef.current;
      startRef.current = null;
      rootRef.current = null;
      setBox(null);
      if (!start || !root) return;
      const finished = boxOf(start, { x: event.clientX, y: event.clientY });
      // A click on empty space is not a sweep. Clearing on it would be defensible, but this shelf
      // has never had a "click away to lose your batch" rule and adding one silently is a way to
      // throw away thirty staged pieces with a stray click.
      if (!isDrag(finished)) return;
      sweepRef.current(cardsIn(root), finished, additiveRef.current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return { onPointerDown, box };
}
