/**
 * Taking a freshly re-read piece into an editor that is already open.
 *
 * THE HALF THE RELOAD WAS MISSING. The Workbench re-reads a piece when its file changes underneath,
 * which was the visible half of "live update". It was not enough: every editor seeds its working
 * state with `useState(() => structuredClone(initBody))`, and a state initializer runs ONCE. So the
 * new entity arrived, the editor ignored it, and the bench went on showing what it mounted with -
 * a reload that worked perfectly and changed nothing on screen.
 *
 * NEVER OVER UNSAVED WORK, the same rule the re-read itself follows. Re-seeding a dirty editor
 * would throw away somebody's edits to show them a fresher copy, which is the trade nobody wants.
 * The conflict that leaves behind belongs to the editor, which owns the save that discovers it.
 */
import { useEffect, useRef, useState } from "react";

/**
 * Re-seed when the piece is genuinely a new read.
 *
 * KEYED ON THE REVISION, not on the entity object. Every render of the room hands down a rebuilt
 * entity, so identity would re-seed continuously and wipe the editor as fast as somebody typed.
 * The revision changes exactly when the file did, which is the question being asked.
 */
export function useReseedOnReread(
  revision: string,
  dirty: boolean,
  reseed: () => void,
): void {
  /**
   * STATE, NOT A REF, so that marking a revision seen re-runs the effect below rather than changing
   * silently underneath it.
   */
  const [seen, setSeen] = useState(revision);
  const reseedRef = useRef(reseed);
  reseedRef.current = reseed;

  useEffect(() => {
    if (revision === seen) return;
    /**
     * A dirty editor keeps its edits AND keeps the old revision, so this fires the moment those
     * edits are saved or discarded rather than being lost. Marking it seen here would swallow the
     * change permanently, leaving the editor stale with nothing left to trigger it.
     *
     * WHICH IS WHY `dirty` IS A DEPENDENCY. Keyed on the revision alone, "the moment those edits
     * are saved" never arrived - the effect had nothing left to re-run it, so a held read waited
     * for a SECOND change to the same file that might never come. The hold was documented as
     * temporary and was in fact permanent, which is the whole bug this file warns about, one layer
     * down.
     */
    if (dirty) return;
    setSeen(revision);
    reseedRef.current();
  }, [revision, seen, dirty]);
}
