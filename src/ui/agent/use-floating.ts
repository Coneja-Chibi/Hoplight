/**
 * Moving and resizing the agent panel, and remembering where it was left.
 *
 * WHY THE PANEL FLOATS AT ALL. The shell mounts one app into one slot, so opening the agent as a
 * dock app HIDES the screen it exists to describe. The whole feature fights itself: to give the
 * agent context you navigate away, and navigating away is what closes it. Orison solved this by not
 * being a page - its panel is fixed, dragged by its header, and stays up while you work.
 *
 * The arithmetic lives in dock-position.ts and is tested there. This is the part that needs a
 * component: pointer capture, the grab offset, and writing the geometry down.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampSize, clampSpot, defaultSpot, dragTo, resizeFrame, restoreSpot,
  type Edge, type Frame, type Size, type Spot,
} from "./dock-position";

const KEY = "hoplight.agent.panel";

/** What a panel opens at before anybody has moved or sized it. */
const DEFAULT_SIZE: Size = { width: 440, height: 560 };

/**
 * The window's size, or something usable when it will not say.
 *
 * CHECKING THE NUMBERS, NOT JUST THAT `window` EXISTS. The first version guarded on
 * `typeof window === "undefined"` alone, which is the usual server-rendering check and is not
 * enough: an environment where `window` is present but `innerWidth` is not - a partial DOM shim, a
 * bare webview - produced NaN, and every measurement downstream inherited it. The panel then
 * rendered `left:NaNpx`, which browsers DROP, so the fixed positioning silently vanished and the
 * panel landed wherever document flow put it. A lost panel with no error anywhere.
 */
const usable = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;

const viewport = (): Size => ({
  width: usable(typeof window === "undefined" ? undefined : window.innerWidth, 1280),
  height: usable(typeof window === "undefined" ? undefined : window.innerHeight, 800),
});

function remembered(): { spot?: unknown; size?: unknown } {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== "object" || parsed === null) return {};
    /**
     * The older format stored a bare {x, y} with no size. Read as a position rather than discarded,
     * so somebody who had already placed the panel does not find it back in the corner after an
     * update - the kind of small loss that reads as the app forgetting things.
     */
    if ("x" in parsed) return { spot: parsed };
    return parsed as { spot?: unknown; size?: unknown };
  } catch {
    return {};
  }
}

const readSize = (stored: unknown, view: Size): Size => {
  if (
    typeof stored !== "object" || stored === null
    || typeof (stored as Size).width !== "number" || typeof (stored as Size).height !== "number"
  ) {
    return clampSize(DEFAULT_SIZE, view);
  }
  return clampSize(stored as Size, view);
};

export interface FloatingPanel {
  readonly spot: Spot;
  readonly size: Size;
  readonly dragging: boolean;
  readonly resizing: boolean;
  /** Put on the header. Everything else is handled from there. */
  onGrab: (event: PointerLike) => void;
  /** Put on each resize handle. */
  onResize: (edge: Edge, event: PointerLike) => void;
}

interface PointerLike {
  clientX: number;
  clientY: number;
  currentTarget: Element;
  preventDefault?: () => void;
}

export function useFloatingPanel(): FloatingPanel {
  const [frame, setFrame] = useState<Frame>(() => {
    const view = viewport();
    const stored = remembered();
    const size = readSize(stored.size, view);
    return { size, spot: restoreSpot(stored.spot, size, view) };
  });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  /** Offset from the panel's own corner to where the pointer went down. */
  const grab = useRef<Spot>({ x: 0, y: 0 });

  /**
   * A window that shrank can leave the panel off screen or larger than the viewport, and either
   * looks like the panel failed to open. Re-fitted on resize rather than only on load, because
   * undocking a laptop changes the window without reloading the page.
   */
  useEffect(() => {
    const onResizeWindow = (): void => {
      setFrame((current) => {
        const view = viewport();
        const size = clampSize(current.size, view);
        return { size, spot: clampSpot(current.spot, size, view) };
      });
    };
    window.addEventListener("resize", onResizeWindow);
    return () => { window.removeEventListener("resize", onResizeWindow); };
  }, []);

  /** Written on release rather than on every move: a drag is hundreds of frames. */
  const remember = useCallback((next: Frame) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  }, []);

  /**
   * Track a pointer to its end, whatever happens to it.
   *
   * LISTENERS ON THE WINDOW, not on the handle. A drag that only tracked the handle would stop the
   * instant the pointer outran it, which happens on every fast drag and reads as the panel
   * sticking. They come off on release, including when the pointer is lost entirely.
   */
  const track = useCallback((
    move: (at: Spot) => Frame,
    done: () => void,
  ) => {
    const onMove = (e: PointerEvent): void => { setFrame(move({ x: e.clientX, y: e.clientY })); };
    const onUp = (e: PointerEvent): void => {
      done();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      remember(move({ x: e.clientX, y: e.clientY }));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [remember]);

  const onGrab = useCallback((event: PointerLike) => {
    const panel = event.currentTarget.closest("[data-agent-panel]");
    const rect = panel?.getBoundingClientRect();
    grab.current = rect
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : { x: 0, y: 0 };
    setDragging(true);

    // The size at grab time, so a resize landing mid-drag cannot change what is being moved.
    let held: Frame | null = null;
    setFrame((current) => { held = current; return current; });
    track(
      (at) => {
        const size = held?.size ?? DEFAULT_SIZE;
        return { size, spot: dragTo(at, grab.current, size, viewport()) };
      },
      () => { setDragging(false); },
    );
  }, [track]);

  const onResize = useCallback((edge: Edge, event: PointerLike) => {
    // Stops the header's own grab from also firing on a handle sitting inside it.
    event.preventDefault?.();
    setResizing(true);

    /**
     * The frame AS IT WAS when the pointer went down, held for the whole drag. Recomputing from the
     * live frame each move compounds its own rounding, and a slow drag visibly walks away from the
     * pointer - see the note on resizeFrame.
     */
    let start: Frame | null = null;
    setFrame((current) => { start = current; return current; });

    track(
      (at) => (start ? resizeFrame(edge, at, start, viewport()) : { spot: { x: 24, y: 24 }, size: DEFAULT_SIZE }),
      () => { setResizing(false); },
    );
  }, [track]);

  return { spot: frame.spot, size: frame.size, dragging, resizing, onGrab, onResize };
}

/** Where a fresh panel opens, exported so the shell can show it without a stored position. */
export const openingSpot = (): Spot => defaultSpot(DEFAULT_SIZE, viewport());
