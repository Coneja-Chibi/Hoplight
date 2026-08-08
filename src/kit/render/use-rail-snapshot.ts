/**
 * Letting the session answer "what is on screen" without importing render.
 *
 * The direction of dependency is the whole point: the session is built before any React state
 * exists and must never reach into the renderer, so the shell publishes a READER and the session
 * calls it per turn. That keeps the rail a render concern and the snapshot a session one.
 *
 * A REF, READ AT CALL TIME. Handing over a value would freeze the answer at mount, which is exactly
 * the staleness that had Kit naming the wrong preset with total confidence.
 */
import { useEffect, useRef, type MutableRefObject } from "react";
import type { RailSnapshot } from "../tools/tool";
import type { RailSession } from "./rail/use-rail";

/**
 * Publish the reader, and hand back the live ref the shell also needs for its own callbacks.
 *
 * One ref rather than two: a second copy of "the current rail" is a second thing to keep in step,
 * and the first one to fall behind would do it silently.
 */
export function useRailSnapshot<T extends RailSession>(
  rail: T,
  onRail?: (read: () => RailSnapshot | null) => void,
): MutableRefObject<T> {
  const railRef = useRef(rail);
  railRef.current = rail;
  useEffect(() => {
    onRail?.(() => {
      const open = railRef.current;
      // Null means nothing is on screen, which is a different answer from an empty preset.
      if (!open.open || !open.presetId) return null;
      return {
        presetId: open.presetId,
        title: open.title || open.presetId,
        blocks: open.state.rows.length,
        enabled: open.state.rows.filter((row) => row.enabled !== false).length,
        pending: open.pending,
      };
    });
  }, [onRail]);
  return railRef;
}
