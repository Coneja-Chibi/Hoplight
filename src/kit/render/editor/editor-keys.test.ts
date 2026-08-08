/**
 * What a key does inside the block editor.
 *
 * The two that matter most are opposites of how the old editor worked: ENTER IS A PARAGRAPH BREAK,
 * not a commit, and NOTHING FALLS THROUGH to the rail behind the card.
 */
import { describe, expect, test } from "bun:test";
import { editorAction } from "./editor-keys";

describe("editorAction", () => {
  test("ENTER IS A NEWLINE, not a commit", () => {
    /**
     * The old editor spent Enter on "commit", which is exactly why a paragraph break was not a
     * character anybody could type into a 3.8k block.
     */
    expect(editorAction({ name: "return" })).toEqual({ kind: "newline" });
  });

  test("ctrl+s saves and escape cancels", () => {
    expect(editorAction({ name: "s", ctrl: true })).toEqual({ kind: "save" });
    expect(editorAction({ name: "escape" })).toEqual({ kind: "cancel" });
    // ctrl+c is COPY here, so leaving has escape and ctrl+q. It was cancel back when nothing could
    // be selected and there was nothing for it to copy.
    expect(editorAction({ name: "q", ctrl: true })).toEqual({ kind: "cancel" });
  });

  test("THE CLIPBOARD CHORDS EVERYBODY ALREADY KNOWS", () => {
    /**
     * Copy, cut, paste and select-all are the same on every platform and in every text box. An
     * editor that made you learn its own would be the thing this file exists to stop.
     */
    expect(editorAction({ name: "c", ctrl: true })).toEqual({ kind: "copy" });
    expect(editorAction({ name: "x", ctrl: true })).toEqual({ kind: "cut" });
    expect(editorAction({ name: "v", ctrl: true })).toEqual({ kind: "paste" });
    expect(editorAction({ name: "a", ctrl: true })).toEqual({ kind: "select-all" });
  });

  test("shift and an arrow extends the selection", () => {
    // How a selection is made with a keyboard everywhere.
    expect(editorAction({ name: "right", shift: true })).toEqual({ kind: "extend", how: "right" });
    expect(editorAction({ name: "down", shift: true })).toEqual({ kind: "extend", how: "down" });
    expect(editorAction({ name: "home", shift: true })).toEqual({ kind: "extend", how: "home" });
  });

  test("a printable character is typed", () => {
    expect(editorAction({ name: "x", sequence: "x" })).toEqual({ kind: "insert", char: "x" });
  });

  test("a space is a space, not the word", () => {
    // `name` reports it as "space". The rail's editor learned this one the hard way.
    expect(editorAction({ name: "space", sequence: " " })).toEqual({ kind: "insert", char: " " });
  });

  test("deleting, both directions", () => {
    expect(editorAction({ name: "backspace" })).toEqual({ kind: "backspace" });
    expect(editorAction({ name: "delete" })).toEqual({ kind: "delete" });
  });

  test("the arrows and the line ends move the cursor", () => {
    for (const [name, how] of [["left", "left"], ["right", "right"], ["up", "up"], ["down", "down"],
      ["home", "home"], ["end", "end"]] as const) {
      expect(editorAction({ name })).toEqual({ kind: "move", how });
    }
  });

  test("ctrl+home and ctrl+end reach the ends of the document", () => {
    expect(editorAction({ name: "home", ctrl: true })).toEqual({ kind: "move", how: "top" });
    expect(editorAction({ name: "end", ctrl: true })).toEqual({ kind: "move", how: "bottom" });
  });

  test("THE LETTERS THAT DRIVE THE RAIL ARE JUST LETTERS IN HERE", () => {
    /**
     * Behind this card, `r` renames, `e` rewrites, `n` notes and space toggles a block. A key that
     * fell through would edit the preset while somebody typed a sentence about it.
     */
    for (const ch of ["r", "e", "n", "d", "a", "y", " "]) {
      expect(editorAction({ name: ch === " " ? "space" : ch, sequence: ch }))
        .toEqual({ kind: "insert", char: ch });
    }
  });

  test("an unrecognised key is ignored, never passed on", () => {
    // Ignore, not fall-through: while this card is up it owns the keyboard completely.
    expect(editorAction({ name: "f5" })).toEqual({ kind: "ignore" });
    expect(editorAction({ name: "z", ctrl: true })).toEqual({ kind: "ignore" });
    expect(editorAction({ name: "?", sequence: "[A" })).toEqual({ kind: "ignore" });
  });
});
