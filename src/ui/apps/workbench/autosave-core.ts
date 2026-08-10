/**
 * When an editor saves itself.
 *
 * THE RULE IS "AFTER YOU STOP", NOT "EVERY SO OFTEN". A timer that fires on a schedule writes mid
 * sentence and mid thought; a debounce that resets on every keystroke writes when somebody pauses,
 * which is the moment their text is a coherent thing rather than a fragment of one. The delay is
 * short enough that a pause to think already commits, and long enough that ordinary typing rhythm
 * never triggers it.
 *
 * Pure, because the interesting parts are the refusals - and a refusal that fires when it should
 * not is a write nobody asked for, on somebody's file.
 */

/**
 * Where the setting lives.
 *
 * ctx.prefs rather than a new settings field: prefs already persist into the studio own settings
 * record, so this survives a restart and travels with the studio rather than the machine - which is
 * the same property the Workbench follow-prompt and the deck choice already rely on.
 */
export const AUTOSAVE_PREF = "workbench.autosave";

/** How long a pause counts as "stopped". */
export const AUTOSAVE_QUIET_MS = 500;

export interface AutosaveState {
  /** The setting. Off means this whole file does nothing. */
  readonly enabled: boolean;
  /** Are there unsaved edits? */
  readonly dirty: boolean;
  /** Is a save already in flight? */
  readonly saving: boolean;
  /** Does the piece pass its own checks - a preset with no name cannot be saved at all. */
  readonly savable: boolean;
}

/**
 * Should a quiet period end in a save?
 *
 * NOT WHILE ONE IS IN FLIGHT. Two overlapping saves race on the revision: the second carries the
 * revision the first is about to replace, so it loses the conflict check and either fails
 * confusingly or overwrites. The debounce restarts after a save finishes, so nothing is dropped -
 * it is deferred by one round trip.
 *
 * NOT WHEN THE PIECE CANNOT BE SAVED. An editor mid-way through clearing a name is not an error to
 * report every half second; the manual save already says so once, when somebody asks for it.
 */
export function shouldAutosave(state: AutosaveState): boolean {
  return state.enabled && state.dirty && !state.saving && state.savable;
}

/**
 * How many times a failing autosave tries again before it stands down.
 *
 * A SAVE THAT FAILS MUST NOT SILENTLY END AUTOSAVE, which is what happened: the timer was armed in
 * an effect keyed on `dirty`, so a refused save left `dirty` true, nothing changed, and no timer was
 * ever armed again. Autosave was not paused - it was dead for that piece, and the only word about it
 * was one line in the status bar.
 *
 * BUT NOT FOREVER EITHER. The refusal that matters here is a revision conflict, and retrying that
 * cannot succeed however long it goes on: the file changed underneath and no amount of trying makes
 * an old revision current. So it tries a few times for the transient cases - a busy disk, a server
 * still coming up - and then says so and waits for a person.
 */
export const AUTOSAVE_TRIES = 3;

/** Backs off, so three tries span a few seconds rather than firing on top of each other. */
export const retryDelayMs = (attempt: number): number =>
  AUTOSAVE_QUIET_MS * Math.pow(3, Math.max(0, attempt));

/**
 * What to say when autosave has stopped trying.
 *
 * NAMED, because "autosave is on" beside an editor that stopped saving four minutes ago is the
 * quiet lie this whole file exists to prevent.
 */
export const autosaveStoppedNote = (attempts: number): string | null =>
  attempts >= AUTOSAVE_TRIES
    ? "autosave stopped after a failed save - this piece may have changed on disk"
    : null;

/**
 * The reason autosave is not running, in words, or null when it is.
 *
 * SHOWN RATHER THAN GUESSED AT. "Autosave is on" beside an editor that has not saved for a minute
 * is the kind of quiet lie that loses work: somebody stops pressing ctrl+s because a label told
 * them they did not have to.
 */
export function autosaveNote(state: AutosaveState): string | null {
  if (!state.enabled) return null;
  if (!state.savable) return "autosave is waiting: this piece cannot be saved yet";
  return null;
}
