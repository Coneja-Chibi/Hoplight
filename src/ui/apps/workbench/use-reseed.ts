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
 * With autosave on, dirty is a window of about half a second, so this fires almost always; with it
 * off, a stale editor is the honest outcome and the revision check catches the conflict at save.
 */
import { useEffect, useRef } from "react";

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
  const seenRef = useRef(revision);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const reseedRef = useRef(reseed);
  reseedRef.current = reseed;

  useEffect(() => {
    if (revision === seenRef.current) return;
    /**
     * A dirty editor keeps its edits AND keeps the old revision, so this fires the moment those
     * edits are saved or discarded rather than being lost. Marking it seen here would swallow the
     * change permanently, leaving the editor stale with nothing left to trigger it.
     */
    if (dirtyRef.current) return;
    seenRef.current = revision;
    reseedRef.current();
  }, [revision]);
}
