/**
 * Shared Ctrl+S, window-close, autosave, and shell dirty-state wiring for every Workbench editor.
 *
 * AUTOSAVE LIVES HERE because every editor already calls this - preset, lorebook, regex, persona,
 * pack, character. Adding it per editor would mean six debounces to keep in step, and the first one
 * somebody forgot would be a room that quietly does not autosave while the setting says it does.
 */
import { useEffect, useRef, useState } from "react";
import { AUTOSAVE_PREF, AUTOSAVE_TRIES, retryDelayMs, shouldAutosave } from "./autosave-core";
import type { AppContext, StudioEntitySummary } from "../../app-contract";

/** What autosave is doing, for an editor that wants to say so on screen. */
export interface AutosaveStatus {
  /** Autosave has used up its tries and is waiting for a person. */
  readonly stalled: boolean;
  /** Give it its tries back - after a conflict has been resolved one way or the other. */
  retry: () => void;
}

export function useEditorGuards(
  ctx: AppContext,
  piece: StudioEntitySummary,
  dirty: boolean,
  /**
   * FALSE MEANS THE SAVE FAILED. An editor that catches its own error and reports it through
   * `setStatus` resolves either way, so without an answer the retry counter below counts saves
   * rather than failures - and stands autosave down in the middle of ordinary successful typing.
   * `void` reads as success, so an editor with nothing to say passes nothing.
   */
  save: () => Promise<boolean | void>,
  /**
   * Whether this piece can be saved at all right now - a preset with no name cannot. Optional so an
   * editor with no such condition passes nothing and autosaves whenever it is dirty.
   */
  savable = true,
): AutosaveStatus {
  /**
   * AUTOSAVE, AFTER YOU STOP. The timer restarts on every change, so it fires when somebody pauses
   * rather than on a schedule that writes mid sentence. Off by default and read from settings, so
   * this does nothing at all until it is turned on.
   */
  const autosave = ctx.prefs.get(AUTOSAVE_PREF) === true;
  const saveRef = useRef(save);
  saveRef.current = save;

  /**
   * How many times this piece's autosave has run without clearing `dirty`.
   *
   * IT IS A DEPENDENCY ON PURPOSE. The effect used to key on `dirty` alone, so a save that failed
   * left dirty true, nothing changed, and no timer was ever armed again - autosave was not paused
   * for that piece, it was dead, silently. Counting attempts gives the effect something that DOES
   * change after a failure, which is what re-arms it.
   */
  const [attempts, setAttempts] = useState(0);
  // A fresh piece starts with a clean slate; the count is about this editor, not about the app.
  useEffect(() => { setAttempts(0); }, [piece.id, piece.kind]);

  useEffect(() => {
    if (!shouldAutosave({ enabled: autosave, dirty, saving: false, savable })) return;
    if (attempts >= AUTOSAVE_TRIES) return; // stood down; the conflict notice carries it from here
    const timer = setTimeout(() => {
      /**
       * COUNTED ON FAILURE ONLY. A failed save leaves `dirty` true, so bumping the count is the one
       * thing that re-arms this effect - and counting successes too would stand autosave down after
       * three ordinary saves, which is the same silent death from the other direction.
       */
      void Promise.resolve(saveRef.current()).then(
        (ok) => { if (ok === false) setAttempts((n) => n + 1); },
        () => { setAttempts((n) => n + 1); },
      );
    }, retryDelayMs(attempts));
    // Cleared on every change, which is what makes this a pause detector rather than a metronome.
    return () => { clearTimeout(timer); };
  }, [autosave, dirty, savable, attempts, piece.id, piece.kind]);

  // A save that lands resets the budget, so the next edit gets its full three tries.
  useEffect(() => { if (!dirty) setAttempts(0); }, [dirty]);

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

  return { stalled: attempts >= AUTOSAVE_TRIES, retry: () => setAttempts(0) };
}
