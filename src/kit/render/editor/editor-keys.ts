/**
 * What a key does inside the block editor.
 *
 * Pure and separate for the reason every key decision in Kit ended up that way: the editor is a modal
 * surface sitting over a rail and a composer that both want the same keys, and every time that was
 * decided inline it went wrong somewhere nobody looked - arrows that were dead, a letter that
 * answered a confirmation, an escape that did nothing.
 *
 * THE EDITOR CLAIMS EVERY KEY IT IS OFFERED. There is no fall-through: while this card is up it owns
 * the keyboard completely, because the alternative is a keystroke meant for a paragraph reaching the
 * rail and toggling a block behind the card.
 */
import type { Move } from "./text-buffer";

/** Just the parts of a key event this reads. */
export interface EditorKey {
  readonly name?: string | undefined;
  readonly sequence?: string | undefined;
  readonly ctrl?: boolean | undefined;
  readonly shift?: boolean | undefined;
  readonly meta?: boolean | undefined;
  readonly option?: boolean | undefined;
}

export type EditorAction =
  /** Put the clipboard in at the cursor, replacing any selection. */
  | { readonly kind: "paste" }
  /** Put the selection on the clipboard. */
  | { readonly kind: "copy" }
  /** Copy, then remove it. */
  | { readonly kind: "cut" }
  | { readonly kind: "select-all" }
  /** Move, extending the selection from wherever it was anchored. */
  | { readonly kind: "extend"; readonly how: Move }
  /** Keep the text and close, staging it as an ordinary draft. */
  | { readonly kind: "save" }
  /** Close and throw the edit away. */
  | { readonly kind: "cancel" }
  | { readonly kind: "insert"; readonly char: string }
  | { readonly kind: "newline" }
  | { readonly kind: "backspace" }
  | { readonly kind: "delete" }
  | { readonly kind: "move"; readonly how: Move }
  /** Recognised as the editor's, and nothing to do. Still swallowed. */
  | { readonly kind: "ignore" };

const MOVES: Record<string, Move> = {
  left: "left", right: "right", up: "up", down: "down", home: "home", end: "end",
};

/**
 * Decide.
 *
 * CTRL+S SAVES AND ESCAPE CANCELS, rather than Enter doing either. Enter is the single most-typed
 * key in a block of prose, and the old editor spent it on "commit" - which is exactly why a newline
 * could not be typed at all. Here it is a paragraph break and nothing else.
 */
export function editorAction(key: EditorKey): EditorAction {
  const name = key.name ?? "";

  if (key.ctrl === true) {
    /**
     * THE CLIPBOARD CHORDS EVERYBODY ALREADY KNOWS. Copy, cut, paste and select-all are the same
     * on every platform and in every text box, and an editor that made you learn its own would be
     * the thing this whole file exists to stop.
     */
    if (name === "c") return { kind: "copy" };
    if (name === "x") return { kind: "cut" };
    if (name === "v") return { kind: "paste" };
    if (name === "a") return { kind: "select-all" };
    if (name === "s") return { kind: "save" };
    // Ctrl+C is copy here, so leaving is escape or ctrl+q. Cancel had ctrl+c when nothing could
    // be selected and there was nothing for it to copy.
    if (name === "q") return { kind: "cancel" };
    if (name === "home") return { kind: "move", how: "top" };
    if (name === "end") return { kind: "move", how: "bottom" };
    return { kind: "ignore" };
  }

  // SHIFT+ARROW EXTENDS, which is how a selection is made with a keyboard everywhere.
  if (key.shift === true) {
    const extend = MOVES[name];
    if (extend) return { kind: "extend", how: extend };
  }

  if (name === "escape") return { kind: "cancel" };
  if (name === "return") return { kind: "newline" };
  if (name === "backspace") return { kind: "backspace" };
  if (name === "delete") return { kind: "delete" };

  const how = MOVES[name];
  if (how) return { kind: "move", how };

  const typed = key.sequence ?? "";
  // The SEQUENCE, not the name: `name` reports a space as the word "space", which would put that
  // word into somebody's prompt. The rail's editor learned this one the hard way.
  if (typed.length === 1 && typed >= " ") return { kind: "insert", char: typed };

  // Swallowed rather than passed on. A key that fell through would reach the rail behind the card.
  return { kind: "ignore" };
}
