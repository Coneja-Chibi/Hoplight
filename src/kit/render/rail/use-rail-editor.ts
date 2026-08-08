/**
 * Typing into the rail: renaming a block or the preset, rewriting a block, leaving a note.
 *
 * ONE EDITOR, FOUR TARGETS, because they are the same gesture. Four separate inputs would be four
 * places to learn, four sets of keys, and four chances for one of them to behave differently from
 * the others for no reason a reader could name.
 *
 * IT WRITES NOTHING. An edit sits on the rail exactly like a reorder does, counted in the pending
 * badge, and Enter stages the lot as one ordinary draft that pauses at the same Gate a model's draft
 * meets. That is what keeps "the rail is a write surface however it was opened" true rather than a
 * claim - there is no second path to storage here.
 */
import { useCallback, useState } from "react";

/** What is being typed into. */
export type EditTarget =
  /** The preset's own name. */
  | { kind: "preset-name" }
  /** A block's name. */
  | { kind: "block-name"; id: string }
  /** A block's content. */
  | { kind: "block-content"; id: string }
  /** A note on the piece, which lives on the envelope rather than in the body. */
  | { kind: "note" };

export interface RailEditor {
  /** What is open for editing, or null when the rail is in its ordinary mode. */
  readonly target: EditTarget | null;
  /** The text being typed. */
  readonly draft: string;
  /** Begin editing something, seeded with what it currently says. */
  open: (target: EditTarget, initial: string) => void;
  setDraft: (text: string) => void;
  /** Keep the typed value and close the editor. Returns what was typed, or null if nothing was open. */
  commit: () => { target: EditTarget; text: string } | null;
  /** Throw the typing away. */
  cancel: () => void;
}

export function useRailEditor(): RailEditor {
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState("");

  const open = useCallback((next: EditTarget, initial: string) => {
    setTarget(next);
    // SEEDED WITH THE CURRENT VALUE, not blank. Renaming is usually a small change to what is there,
    // and an empty box makes somebody retype a name they only wanted to fix one letter of.
    setDraft(initial);
  }, []);

  const commit = useCallback((): { target: EditTarget; text: string } | null => {
    if (!target) return null;
    const result = { target, text: draft };
    setTarget(null);
    setDraft("");
    return result;
  }, [target, draft]);

  const cancel = useCallback(() => {
    setTarget(null);
    setDraft("");
  }, []);

  return { target, draft, open, setDraft, commit, cancel };
}

/** What the editor's own chrome says it is doing. */
export function editorLabel(target: EditTarget): string {
  switch (target.kind) {
    case "preset-name": return "rename this preset";
    case "block-name": return "rename this block";
    case "block-content": return "rewrite this block";
    case "note": return "leave a note on this piece";
  }
}
