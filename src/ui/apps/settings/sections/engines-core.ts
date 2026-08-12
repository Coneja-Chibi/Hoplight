/**
 * What an engine row says about itself - pure, so the field and its note cannot disagree.
 *
 * Four states, and the difference between them is the whole usefulness of the screen: in use, in
 * use because of a variable, saved but no longer there, and never set. Collapsing the middle two
 * into "not found" is what would send somebody to re-check a folder that is not the one being used.
 */

export interface EngineRow {
  id: string;
  label: string;
  install: string;
  rootVar: string;
  /** what the file says, kept visible even when it no longer resolves - that IS the fault */
  saved: string;
  /** the variable this process was launched with, empty when there was none */
  env: string;
  /** what actually answered, empty when nothing did */
  root: string;
  from: "env" | "saved" | null;
}

export interface EngineState {
  readonly note: string;
  readonly ok: boolean;
  /** The saved field is not editable while a variable is deciding the answer. */
  readonly locked: boolean;
}

export function engineState(row: EngineRow): EngineState {
  if (row.from === "env") {
    return { note: `in use, from ${row.rootVar}`, ok: true, locked: true };
  }
  if (row.env) {
    // Set, and naming nothing. "Not found" alone would point at the saved folder, which is not
    // what this run is using.
    return { note: `${row.rootVar} is set but no engine is there`, ok: false, locked: true };
  }
  if (row.from === "saved") return { note: "in use", ok: true, locked: false };
  if (row.saved) return { note: "saved, but nothing is there now", ok: false, locked: false };
  return { note: "not set", ok: false, locked: false };
}
