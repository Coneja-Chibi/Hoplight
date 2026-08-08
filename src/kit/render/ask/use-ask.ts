/**
 * Who owns the live question.
 *
 * ONE OWNER, BECAUSE THE COMPOSER HAS THE KEYBOARD. A panel holding its own cursor could not be
 * moved by the keys meant to move it, so the state lives here and the panel is drawn from it. That
 * is the same arrangement the rail uses, and for the same reason.
 *
 * ONLY THE NEWEST UNANSWERED QUESTION IS LIVE. An older one further up the transcript has been
 * answered or abandoned, and letting a number key reach back into it would make the same keystroke
 * mean different things depending on how far somebody had scrolled - which is exactly the rule the
 * composer already applies to offered options.
 */
import { useCallback, useRef, useState } from "react";
import { askMessage, moveCursor, pickableRows, type AskOption, type AskState } from "./ask-core";

/** What the shell needs to draw and drive one question. */
export interface AskSession {
  /** Cursor, typed answer and note for the live question. */
  readonly state: AskState;
  /** Is the write-your-own field open? */
  readonly writing: boolean;
  /** Does a question want the keyboard right now? */
  readonly live: boolean;
  /** Point the panel at a question, or clear it when none is open. */
  follow: (options: readonly AskOption[] | null) => void;
  /** A row was clicked. Selects; never sends. */
  select: (index: number, kind: "option" | "own" | "chat") => void;
  /** Put the cursor in the note field, for a click on it. */
  editNote: () => void;
  /**
   * Offer a key to the panel. Returns true when it was used, so the caller can stop.
   *
   * The caller is the COMPOSER, which only offers keys from an empty draft: an arrow inside a
   * half-written sentence is a cursor move and nothing may take it.
   */
  handleKey: (key: string, sequence?: string) => boolean;
}

export function useAsk(onSend: (message: string) => void): AskSession {
  const [options, setOptions] = useState<readonly AskOption[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [own, setOwn] = useState("");
  const [note, setNote] = useState("");
  const [writing, setWriting] = useState(false);
  /** Which field a printable key lands in: nothing, the written answer, or the note. */
  const [field, setField] = useState<"own" | "note" | null>(null);

  const state: AskState = { options: options ?? [], cursor, own, note };
  const stateRef = useRef(state);
  stateRef.current = state;
  const fieldRef = useRef(field);
  fieldRef.current = field;
  const writingRef = useRef(writing);
  writingRef.current = writing;

  const follow = useCallback((next: readonly AskOption[] | null) => {
    setOptions(next);
    setCursor(0);
    setOwn("");
    setNote("");
    setWriting(false);
    setField(null);
  }, []);

  const select = useCallback((index: number, kind: "option" | "own" | "chat") => {
    setCursor(index);
    if (kind === "own") { setWriting(true); setField("own"); }
    else setField(null);
  }, []);

  const editNote = useCallback(() => { setField("note"); }, []);

  const send = useCallback(() => {
    const message = askMessage(stateRef.current);
    // NULL IS A REAL STATE: write-your-own is selected but empty. Sending nothing would put a blank
    // message in the conversation and make the model guess what was meant.
    if (message === null) return true;
    onSend(message);
    return true;
  }, [onSend]);

  const handleKey = useCallback((key: string, sequence?: string): boolean => {
    if (options === null) return false;
    const current = stateRef.current;
    const picks = pickableRows(current.options);
    if (picks.length === 0) return false;

    if (key === "return") return send();
    if (key === "up" || key === "down") {
      setCursor(moveCursor(current, key === "up" ? -1 : 1));
      return true;
    }
    if (key === "escape") {
      // Backs out of a field first, then out of the panel's grip on the keys.
      if (fieldRef.current !== null) { setField(null); return true; }
      return false;
    }
    if (key === "backspace") {
      if (fieldRef.current === "own") { setOwn((t) => t.slice(0, -1)); return true; }
      if (fieldRef.current === "note") { setNote((t) => t.slice(0, -1)); return true; }
      return false;
    }

    const typed = sequence ?? "";
    const printable = typed.length === 1 && typed >= " ";

    // A DIGIT SELECTS ONLY OUTSIDE A FIELD. Typing "3 blocks" into a note must not jump the cursor.
    if (fieldRef.current === null && /^[1-9]$/.test(key)) {
      const at = Number(key) - 1;
      if (at < picks.length) {
        setCursor(at);
        const kind = picks[at]!.kind;
        if (kind === "own") { setWriting(true); setField("own"); } else setField(null);
      }
      return true;
    }
    /**
     * N OPENS THE NOTE, alongside clicking it.
     *
     * The cost is real and accepted: with a question up and an empty draft, a message beginning with
     * the letter n loses that letter to this. It is one keystroke to recover - escape closes the
     * field and hands the keys back - and the same trade the number keys already make, which have
     * meant "pick option 3" rather than "type a 3" from an empty draft since long before this panel.
     */
    if (fieldRef.current === null && (key === "n" || key === "N")) { setField("note"); return true; }

    if (fieldRef.current !== null && printable) {
      if (fieldRef.current === "own") setOwn((t) => t + typed);
      else setNote((t) => t + typed);
      return true;
    }
    return false;
  }, [options, send]);

  return {
    state,
    writing,
    live: options !== null,
    follow,
    select,
    editNote,
    handleKey,
  };
}
