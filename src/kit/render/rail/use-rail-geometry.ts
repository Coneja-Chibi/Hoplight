/**
 * How wide the rail is and how tightly it packs, which belong to the person rather than the layout.
 *
 * Separate because the bounds are a real constraint rather than taste, and because two doors set the
 * width - the keys and the draggable edge - and both must be bounded the same way. A drag that could
 * exceed the ceiling would leave the transcript narrower than the rail beside it.
 */
import { useCallback, useState } from "react";

/** Below the floor a block name is unreadable; above the ceiling the rail outgrows the transcript. */
const MIN_RAIL_WIDTH = 24;
const MAX_RAIL_WIDTH = 72;
const DEFAULT_RAIL_WIDTH = 38;

/** Two cells per press, so a keyed resize is felt without being coarse. */
export const RAIL_RESIZE_STEP = 2;

/** Clamp any proposed width into the rail's bounds. Both doors go through this. */
export const boundRailWidth = (columns: number): number =>
  Math.max(MIN_RAIL_WIDTH, Math.min(MAX_RAIL_WIDTH, Math.round(columns)));

export interface RailGeometry {
  readonly width: number;
  /** Nudge by whole cells, for the keys. */
  readonly widen: (by: number) => void;
  /** Set outright, for a pointer already on the column it wants. */
  readonly resizeTo: (columns: number) => void;
  readonly dense: boolean;
  readonly toggleDense: () => void;
}

export function useRailGeometry(): RailGeometry {
  const [width, setWidth] = useState(DEFAULT_RAIL_WIDTH);
  const [dense, setDense] = useState(false);
  const widen = useCallback((by: number) => { setWidth((w) => boundRailWidth(w + by)); }, []);
  const resizeTo = useCallback((columns: number) => { setWidth(boundRailWidth(columns)); }, []);
  const toggleDense = useCallback(() => { setDense((on) => !on); }, []);
  return { width, widen, resizeTo, dense, toggleDense };
}
