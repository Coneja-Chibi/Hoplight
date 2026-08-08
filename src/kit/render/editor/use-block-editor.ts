/**
 * Who owns the block editor while it is up.
 *
 * The card takes EVERY key, so exactly one thing may be holding the keyboard at a time. This is that
 * thing: the rail hands it a block, it holds the buffer and the selection, and it hands the text back
 * on save. The rail does not learn what a cursor is and the card does not learn what a preset is.
 *
 * SAVING DOES NOT WRITE. The text goes back to the rail as a staged edit on that row, which is the
 * path that already exists and already meets the Gate. A write here would be a second route into the
 * studio, which is the one thing Kit does not have and should not grow.
 */
import { useCallback, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { editorAction } from "./editor-keys";
import {
  backspace, bufferOf, deleteForward, insert, move, newline, textOf, type TextBuffer,
} from "./text-buffer";
import { deleteSelection, insertText, selectedText, type Anchor } from "./selection";
import { readClipboardText } from "../clipboard-read";

/** The block being edited, and where its text goes back to. */
export interface EditorTarget {
  readonly blockId: string;
  readonly title: string;
}

export interface BlockEditorSession {
  /** The block on screen, or null when the card is closed. */
  readonly target: EditorTarget | null;
  readonly buffer: TextBuffer;
  /** Where a selection began, or null when nothing is selected. */
  readonly anchor: Anchor;
  /** Has the text changed since it opened? */
  readonly dirty: boolean;
  open: (target: EditorTarget, text: string) => void;
  close: () => void;
  /** Put the cursor where a click landed, and start a selection there. */
  placeCursor: (row: number, col: number, dragging?: boolean) => void;
  handleKey: (key: Parameters<typeof editorAction>[0]) => boolean;
}

export function useBlockEditor(
  /** Called with the finished text when ctrl+s closes the card. */
  onSave: (blockId: string, text: string) => void,
  /**
   * Put text on the system clipboard.
   *
   * INJECTED, and required. Kit already has one copy path with real failure handling - a terminal
   * that refuses OSC52, a payload too large to send safely - and a second hand-rolled one here would
   * be the copy that silently does nothing on the terminals the first one knows about.
   */
  writeClipboard: (text: string) => void,
): BlockEditorSession {
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [buffer, setBuffer] = useState<TextBuffer>(() => bufferOf(""));
  const [anchor, setAnchor] = useState<Anchor>(null);
  /** What it held when it opened, so "dirty" is a comparison rather than a flag to keep in step. */
  const [origin, setOrigin] = useState("");

  const bufferRef = useRef(buffer);
  bufferRef.current = buffer;
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const targetRef = useRef(target);
  targetRef.current = target;

  const open = useCallback((next: EditorTarget, text: string) => {
    setTarget(next);
    setBuffer(bufferOf(text));
    setAnchor(null);
    setOrigin(text);
  }, []);

  const close = useCallback(() => { setTarget(null); }, []);

  /**
   * A click lands the cursor and starts a selection there; a drag extends it.
   *
   * The anchor is set on the FIRST press and left alone while dragging, which is what makes dragging
   * back past where you started shrink the selection rather than starting a new one.
   */
  const placeCursor = useCallback((row: number, col: number, dragging = false) => {
    setBuffer((b) => ({ ...b, row, col }));
    if (!dragging) setAnchor({ row, col });
  }, []);

  const handleKey = useCallback((key: Parameters<typeof editorAction>[0]): boolean => {
    const open_ = targetRef.current;
    if (!open_) return false;
    const action = editorAction(key);
    const held = anchorRef.current;

    /** Everything that types over a selection removes it first. */
    const overwrite = (next: (b: TextBuffer) => TextBuffer) => {
      setBuffer((b) => next(held ? deleteSelection(b, held) : b));
      setAnchor(null);
    };

    switch (action.kind) {
      case "save":
        onSave(open_.blockId, textOf(bufferRef.current));
        setTarget(null);
        return true;
      case "cancel": setTarget(null); return true;
      case "insert": overwrite((b) => insert(b, action.char)); return true;
      case "newline": overwrite(newline); return true;
      case "backspace":
        // With a selection, backspace removes THAT rather than one character beside it.
        if (held) { setBuffer((b) => deleteSelection(b, held)); setAnchor(null); }
        else setBuffer(backspace);
        return true;
      case "delete":
        if (held) { setBuffer((b) => deleteSelection(b, held)); setAnchor(null); }
        else setBuffer(deleteForward);
        return true;
      case "move":
        // Moving without shift drops the selection, the way it does in every text box.
        setBuffer((b) => move(b, action.how));
        setAnchor(null);
        return true;
      case "extend":
        // The anchor is planted on the first extend and kept, so the selection grows and shrinks.
        setAnchor((current) => current ?? { row: bufferRef.current.row, col: bufferRef.current.col });
        setBuffer((b) => move(b, action.how));
        return true;
      case "select-all": {
        const lines = bufferRef.current.lines;
        setAnchor({ row: 0, col: 0 });
        setBuffer((b) => ({ ...b, row: lines.length - 1, col: (lines[lines.length - 1] ?? "").length }));
        return true;
      }
      case "copy":
        writeClipboard(selectedText(bufferRef.current, held));
        return true;
      case "cut":
        writeClipboard(selectedText(bufferRef.current, held));
        if (held) { setBuffer((b) => deleteSelection(b, held)); setAnchor(null); }
        return true;
      case "paste":
        // Asked of the OPERATING SYSTEM, and only on a key somebody pressed - the same consent the
        // composer's right-click paste carries, and for the same reason: OSC52 read-back is disabled
        // almost everywhere because a program that can read your clipboard can read your password.
        void readClipboardText().then((text) => {
          if (!text) return;
          setBuffer((b) => insertText(b, anchorRef.current, text));
          setAnchor(null);
        });
        return true;
      case "ignore":
        // Claimed anyway: a key that fell through would reach the rail behind the card.
        return true;
    }
  }, [onSave, writeClipboard]);

  /**
   * THE CARD TAKES THE KEYBOARD WHOLE while it is up.
   *
   * preventDefault stops opentui handing the key to the focused renderable, which is what keeps it
   * out of the composer. Everything else that listens has to check whether a block is open and stand
   * down - a key meant for a paragraph reaching the rail would toggle a block behind the card.
   */
  useKeyboard((event: KeyEvent) => {
    if (!targetRef.current) return;
    event.preventDefault();
    handleKey(event);
  });

  return { target, buffer, anchor, dirty: textOf(buffer) !== origin, open, close, placeCursor, handleKey };
}
