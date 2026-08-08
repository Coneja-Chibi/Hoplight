/**
 * Two panes and a divider you can drag.
 *
 * A GRID WITH A REMEMBERED RATIO, not two absolutely-positioned boxes. The panes keep their own
 * scrolling and their own min-height:0, which is the thing that actually makes a fixed-height
 * two-column editor work; a rewrite into absolute positioning would break that for the sake of
 * making the divider easier to place.
 *
 * POINTER EVENTS AND CAPTURE, not mousemove on the window. Capture is what keeps the drag attached
 * when the pointer crosses an iframe, a scrollbar, or leaves the window entirely - all of which
 * happen constantly at exactly the moment somebody is dragging toward an edge.
 *
 * THE DIVIDER IS FOCUSABLE AND ANSWERS ARROW KEYS. A control that only exists for a mouse is a
 * control some people simply do not have, and `separator` is a real ARIA role with real semantics.
 */
import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { clampSplit, nudgeSplit, parseSplit, splitFromPointer } from "./split-core";
import styles from "./split-pane.module.css";

export function SplitPane({
  left,
  right,
  /** Fraction of the width the RIGHT pane takes. */
  defaultSplit = 0.28,
  /** Read and written so the ratio survives a reload. Omit for an unremembered split. */
  stored,
  onSplit,
  label = "Resize panels",
}: {
  left: ReactNode;
  right: ReactNode;
  defaultSplit?: number;
  stored?: unknown;
  onSplit?: (split: number) => void;
  label?: string;
}): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(() => parseSplit(stored) ?? defaultSplit);
  const [dragging, setDragging] = useState(false);

  const commit = useCallback((next: number) => {
    setSplit(next);
    onSplit?.(next);
  }, [onSplit]);

  /**
   * A window that shrank can leave a remembered ratio with one pane below its floor, so the split is
   * re-clamped against the real width rather than trusted from storage.
   */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const width = host.getBoundingClientRect().width;
      setSplit((current) => clampSplit(current, width));
    });
    observer.observe(host);
    return () => { observer.disconnect(); };
  }, []);

  const onMove = (event: { clientX: number }): void => {
    const host = hostRef.current;
    if (!host) return;
    commit(splitFromPointer(event.clientX, host.getBoundingClientRect()));
  };

  return (
    <div ref={hostRef} className={styles.host} style={{ gridTemplateColumns: `minmax(0, 1fr) auto minmax(0, ${String(split)}fr)` }}>
      <div className={styles.pane}>{left}</div>
      <div
        className={dragging ? `${styles.grip} ${styles.gripOn}` : styles.grip}
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={Math.round(split * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          // Capture, so the drag survives the pointer leaving the divider, the pane, or the window.
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => { if (dragging) onMove(e); }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => { setDragging(false); }}
        // Double-click resets, which is the convention everywhere and the fastest way out of a
        // layout somebody dragged into a corner.
        onDoubleClick={() => { commit(defaultSplit); }}
        onKeyDown={(e) => {
          const host = hostRef.current;
          if (!host) return;
          const width = host.getBoundingClientRect().width;
          if (e.key === "ArrowLeft") { e.preventDefault(); commit(nudgeSplit(split, "left", width)); }
          else if (e.key === "ArrowRight") { e.preventDefault(); commit(nudgeSplit(split, "right", width)); }
          else if (e.key === "Home") { e.preventDefault(); commit(defaultSplit); }
        }}
      />
      <div className={styles.pane}>{right}</div>
    </div>
  );
}
