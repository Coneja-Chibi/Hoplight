/**
 * use-scroll-seam: the single impure edge over the scrollbox. The renderable emits no scroll event, so
 * this hook owns its ref and polls scrollTop / scrollHeight / viewport height on an interval, folding
 * them through the pure readScroll into React state, and setting state only when the metrics actually
 * change. It exposes snapToBottom (End / pill click) and scrollLineIntoView (search snap-to-match),
 * both of which drive the renderable's own clamping setters, so calling them when already at the edge
 * is safe. The poll guards a null ref, clears on unmount, and runs only while active (never under an
 * overlay). snap-to-latest and transcript search both consume this one seam.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { readScroll, type ScrollMetrics } from "./scroll-seam";

const POLL_MS = 120;

const AT_REST: ScrollMetrics = { atBottom: true, maxScrollTop: 0, distanceRows: 0, scrollable: false };

const same = (a: ScrollMetrics, b: ScrollMetrics): boolean =>
  a.atBottom === b.atBottom
  && a.maxScrollTop === b.maxScrollTop
  && a.distanceRows === b.distanceRows
  && a.scrollable === b.scrollable;

export interface ScrollSeam {
  readonly ref: React.RefObject<ScrollBoxRenderable | null>;
  readonly metrics: ScrollMetrics;
  /** End / pill click: pin the newest line. */
  readonly snapToBottom: () => void;
  /** Home: jump to the oldest line. */
  readonly snapToTop: () => void;
  /** PgUp (-1) / PgDn (+1): page by the viewport height, one row of overlap. */
  readonly pageBy: (direction: -1 | 1) => void;
  /** Search snap-to-match: pull a tagged transcript line into view. */
  readonly scrollLineIntoView: (lineIndex: number) => void;
}

/** Poll the scrollbox metrics while active. Pass false (e.g. under an overlay) to idle the interval. */
export function useScrollSeam(active: boolean): ScrollSeam {
  const ref = useRef<ScrollBoxRenderable | null>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>(AT_REST);
  const lastRef = useRef<ScrollMetrics>(AT_REST);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const box = ref.current;
      if (!box) return;
      const next = readScroll({
        scrollTop: box.scrollTop,
        scrollHeight: box.scrollHeight,
        viewportHeight: box.viewport.height,
      });
      if (same(next, lastRef.current)) return; // avoid a set (and re-render) when nothing moved
      lastRef.current = next;
      setMetrics(next);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [active]);

  const snapToBottom = useCallback((): void => {
    const box = ref.current;
    if (box) box.scrollTop = box.scrollHeight; // the setter clamps to the real max internally
  }, []);

  const snapToTop = useCallback((): void => {
    const box = ref.current;
    if (box) box.scrollTop = 0;
  }, []);

  const pageBy = useCallback((direction: -1 | 1): void => {
    const box = ref.current;
    if (box) box.scrollBy({ x: 0, y: direction * Math.max(1, box.viewport.height - 1) });
  }, []);

  const scrollLineIntoView = useCallback((lineIndex: number): void => {
    ref.current?.scrollChildIntoView(`ln-${lineIndex}`);
  }, []);

  return { ref, metrics, snapToBottom, snapToTop, pageBy, scrollLineIntoView };
}
