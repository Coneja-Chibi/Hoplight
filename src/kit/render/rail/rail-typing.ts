/**
 * Typing into the rail, and what the finished text becomes.
 *
 * WHILE THE EDITOR IS OPEN IT OWNS EVERY KEY. That is decided before any other binding looks,
 * because anything else would let a letter typed into a name also toggle a block: the
 * rail-ate-the-composer failure in miniature, avoided the same way, with one owner at a time.
 */
import type { Dispatch, SetStateAction } from "react";
import type { RailState } from "../../../core/preset/rail-edit";
import type { RailEditor } from "./use-rail-editor";

/** Just enough of a key event to type with. */
export interface TypedKey {
  name?: string;
  sequence?: string;
}

/** What a finished edit was, once Enter closed the box. */
export type FinishedEdit = { target: { kind: string; id?: string }; text: string };

/**
 * Feed one key to the open editor. Returns the finished edit when Enter closed it, else null.
 *
 * The SEQUENCE is what was typed. `name` normalises a space to the word "space", so reading it
 * would put that word into somebody's sentence.
 */
export function typeIntoEditor(editor: RailEditor, event: TypedKey): FinishedEdit | null {
  const key = event.name;
  if (key === "escape") { editor.cancel(); return null; }
  if (key === "return") return editor.commit();
  if (key === "backspace") { editor.setDraft(editor.draft.slice(0, -1)); return null; }
  const typed = event.sequence ?? "";
  if (typed.length === 1 && typed >= " ") editor.setDraft(editor.draft + typed);
  return null;
}

/** What the thing being edited currently says, so an edit that changes nothing can be discarded. */
export interface CurrentValues {
  presetName: string;
  blockName: (id: string) => string | undefined;
  blockContent: (id: string) => string | undefined;
}

export interface EditSinks {
  setPendingName: Dispatch<SetStateAction<string | null>>;
  setPendingNote: Dispatch<SetStateAction<string | null>>;
  setState: Dispatch<SetStateAction<RailState>>;
}

/**
 * Put a finished edit where it belongs.
 *
 * AN EDIT THAT CHANGES NOTHING IS NOTHING. Clicking the title opens the editor seeded with the
 * current name - which is right, since renaming is usually fixing one letter - so pressing enter
 * without typing produced a pending edit identical to what was stored. It could never be applied,
 * because the review found no change to show; it could not be dropped, because escape does not do
 * that; and it blocked stepping to another preset, because the rail refuses to walk away from
 * unsaved work. One stray keystroke and the rail was stuck.
 *
 * Nothing here writes. A name or a body lands on the ROW, a title or a note beside it, and Enter
 * later stages the lot as one ordinary draft at the same Gate a model's draft meets.
 */
export function applyTypedEdit(done: FinishedEdit, sinks: EditSinks, current?: CurrentValues): void {
  const text = done.text.trim();
  if (done.target.kind === "preset-name") {
    const unchanged = current !== undefined && text === current.presetName.trim();
    sinks.setPendingName(text && !unchanged ? text : null);
    return;
  }
  if (done.target.kind === "note") { sinks.setPendingNote(text || null); return; }
  const id = done.target.id;
  if (!id) return;
  const isName = done.target.kind === "block-name";
  const before = isName ? current?.blockName(id) : current?.blockContent(id);
  // undefined means the caller could not say what it was, so the edit is kept rather than guessed away.
  const unchanged = before !== undefined && done.text === before;
  sinks.setState((c) => ({
    ...c,
    rows: c.rows.map((row) => {
      if (row.id !== id) return row;
      // Undefined, not the old value: a row carrying an edit equal to what is stored still reads as
      // pending everywhere that only checks whether the field is set.
      const edit = unchanged ? undefined : done.text;
      return isName ? { ...row, editedName: edit } : { ...row, editedContent: edit };
    }),
  }));
}
