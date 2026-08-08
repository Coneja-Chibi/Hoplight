/**
 * Shared Ctrl+S, window-close, autosave, and shell dirty-state wiring for every Workbench editor.
 *
 * AUTOSAVE LIVES HERE because every editor already calls this - preset, lorebook, regex, persona,
 * pack, character. Adding it per editor would mean six debounces to keep in step, and the first one
 * somebody forgot would be a room that quietly does not autosave while the setting says it does.
 */
import { useEffect, useRef } from "react";
import { AUTOSAVE_PREF, AUTOSAVE_QUIET_MS, shouldAutosave } from "./autosave-core";
import type { AppContext, StudioEntitySummary } from "../../app-contract";

export function useEditorGuards(
  ctx: AppContext,
  piece: StudioEntitySummary,
  dirty: boolean,
  save: () => Promise<void>,
  /**
   * Whether this piece can be saved at all right now - a preset with no name cannot. Optional so an
   * editor with no such condition passes nothing and autosaves whenever it is dirty.
   */
  savable = true,
): void {
  /**
   * AUTOSAVE, AFTER YOU STOP. The timer restarts on every change, so it fires when somebody pauses
   * rather than on a schedule that writes mid sentence. Off by default and read from settings, so
   * this does nothing at all until it is turned on.
   */
  const autosave = ctx.prefs.get(AUTOSAVE_PREF) === true;
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!shouldAutosave({ enabled: autosave, dirty, saving: false, savable })) return;
    const timer = setTimeout(() => { void saveRef.current(); }, AUTOSAVE_QUIET_MS);
    // Cleared on every change, which is what makes this a pause detector rather than a metronome.
    return () => { clearTimeout(timer); };
  }, [autosave, dirty, savable, piece.id, piece.kind]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty, save]);

  useEffect(() => {
    ctx.workbench.setDirty(piece.id, piece.kind, dirty);
    // ctx is a stable adapter whose identity changes on shell writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, piece.id, piece.kind]);
}
