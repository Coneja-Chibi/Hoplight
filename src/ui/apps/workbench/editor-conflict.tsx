/**
 * "This piece changed on disk." The bar that says so, and the two ways out.
 *
 * WHY THERE IS A BAR AT ALL. The pieces of this were each correct on their own and lethal together:
 * the agent applies a change, the file's revision moves, the open editor declines to re-seed over
 * unsaved work, and the next save is refused for carrying a revision that is no longer current. Add
 * autosave and the refusal repeats silently behind a setting that reads "on". What the person saw
 * was an editor that had stopped saving, with no error they had caused and nothing on screen about
 * any of it - and the only exit was closing the tab, which threw their edits away.
 *
 * NEITHER EXIT IS AUTOMATIC. Taking the new version costs unsaved edits; keeping the edits writes
 * over whatever arrived. There is no default that is right for both, so the bar asks rather than
 * picking, and it names the cost of each in the button itself.
 */
import type { JSX } from "react";
import s from "./editor-conflict.module.css";

export interface EditorConflictProps {
  /** What is being fought over, for the sentence. */
  readonly what: string;
  /** Discard the unsaved edits; the ordinary re-read then brings the new version in. */
  onTakeTheirs: () => void;
  /** Write the unsaved edits over the version on disk. */
  onKeepMine: () => void;
}

export function EditorConflict({ what, onTakeTheirs, onKeepMine }: EditorConflictProps): JSX.Element {
  return (
    <div className={s.bar} role="alert">
      <span className={s.text}>
        <strong className={s.title}>Changed on disk</strong>
        This {what} was written by something else - probably the agent - while you had unsaved edits
        open, so your last save was refused rather than overwriting it. Nothing has been lost yet.
      </span>
      <span className={s.actions}>
        <button type="button" className={s.button} onClick={onTakeTheirs}>
          Discard my edits
        </button>
        <button type="button" className={`${s.button} ${s.primary}`} onClick={onKeepMine}>
          Keep mine, overwrite
        </button>
      </span>
    </div>
  );
}
