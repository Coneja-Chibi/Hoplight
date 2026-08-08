/**
 * Typing into the rail, tested where it can be without a terminal.
 *
 * The property worth pinning is that the editor consumes keys that mean something else outside it:
 * a space typed into a name must not toggle a block, and an "r" must not open another editor.
 */
import { describe, expect, test } from "bun:test";
import { applyTypedEdit, typeIntoEditor, type FinishedEdit } from "./rail-typing";

const editorWith = (draft: string) => {
  let text = draft;
  let cancelled = false;
  return {
    editor: {
      target: { kind: "block-name", id: "a" } as const,
      get draft() { return text; },
      open: () => {},
      setDraft: (next: string) => { text = next; },
      commit: () => ({ target: { kind: "block-name", id: "a" } as const, text }),
      cancel: () => { cancelled = true; },
    },
    read: () => text,
    wasCancelled: () => cancelled,
  };
};

describe("typeIntoEditor", () => {
  test("a printable character is appended, including a space", () => {
    const e = editorWith("Main");
    expect(typeIntoEditor(e.editor as never, { name: "space", sequence: " " })).toBeNull();
    expect(typeIntoEditor(e.editor as never, { name: "p", sequence: "P" })).toBeNull();
    // The sequence is what was typed; reading `name` would have inserted the word "space".
    expect(e.read()).toBe("Main P");
  });

  test("backspace removes one character", () => {
    const e = editorWith("Mainn");
    typeIntoEditor(e.editor as never, { name: "backspace" });
    expect(e.read()).toBe("Main");
  });

  test("escape cancels and finishes nothing", () => {
    const e = editorWith("half typed");
    expect(typeIntoEditor(e.editor as never, { name: "escape" })).toBeNull();
    expect(e.wasCancelled()).toBe(true);
  });

  test("enter finishes and hands back what was typed", () => {
    const e = editorWith("Opening");
    const done = typeIntoEditor(e.editor as never, { name: "return" });
    expect(done?.text).toBe("Opening");
  });
});

describe("applyTypedEdit", () => {
  const sinks = () => {
    let name: string | null = null;
    let note: string | null = null;
    let rows: { id: string; editedName?: string; editedContent?: string }[] = [{ id: "a" }, { id: "b" }];
    return {
      calls: {
        setPendingName: (v: never) => { name = typeof v === "function" ? (v as never) : v; },
        setPendingNote: (v: never) => { note = typeof v === "function" ? (v as never) : v; },
        setState: (fn: never) => { rows = (fn as unknown as (c: unknown) => { rows: typeof rows })({ rows }).rows; },
      },
      read: () => ({ name, note, rows }),
    };
  };

  test("a preset rename lands beside the rows, not in them", () => {
    const s = sinks();
    applyTypedEdit({ target: { kind: "preset-name" }, text: "  New Title  " } as FinishedEdit, s.calls as never);
    expect(s.read().name).toBe("New Title");
  });

  test("emptying a rename clears it rather than staging an empty name", () => {
    const s = sinks();
    applyTypedEdit({ target: { kind: "preset-name" }, text: "   " } as FinishedEdit, s.calls as never);
    expect(s.read().name).toBeNull();
  });

  test("a block edit lands on that row alone", () => {
    const s = sinks();
    applyTypedEdit({ target: { kind: "block-name", id: "a" }, text: "Opening" } as FinishedEdit, s.calls as never);
    expect(s.read().rows[0]?.editedName).toBe("Opening");
    expect(s.read().rows[1]?.editedName).toBeUndefined();
  });

  /**
   * AN EDIT THAT CHANGES NOTHING IS NOTHING.
   *
   * The rename editor opens seeded with the current name, so pressing enter without typing staged an
   * edit identical to what was stored. The rail then held one pending change it could not apply -
   * the review found no difference to write - could not drop, and would not step away from. Reported
   * as "hitting enter won't let me apply, hitting esc does nothing, and the arrow keys still do
   * nothing", which was all one phantom.
   */
  const current = {
    presetName: "Empty Base Bare",
    blockName: (id: string) => (id === "a" ? "Opening" : undefined),
    blockContent: (id: string) => (id === "a" ? "the body" : undefined),
  };

  test("committing the name it already had stages nothing", () => {
    const s = sinks();
    applyTypedEdit(
      { target: { kind: "preset-name" }, text: "Empty Base Bare" } as FinishedEdit,
      s.calls as never,
      current,
    );
    expect(s.read().name).toBeNull();
  });

  test("committing a block name unchanged leaves the row clean", () => {
    const s = sinks();
    applyTypedEdit(
      { target: { kind: "block-name", id: "a" }, text: "Opening" } as FinishedEdit,
      s.calls as never,
      current,
    );
    expect(s.read().rows[0]?.editedName).toBeUndefined();
  });

  test("committing block content unchanged leaves the row clean", () => {
    const s = sinks();
    applyTypedEdit(
      { target: { kind: "block-content", id: "a" }, text: "the body" } as FinishedEdit,
      s.calls as never,
      current,
    );
    expect(s.read().rows[0]?.editedContent).toBeUndefined();
  });

  test("one changed letter still stages", () => {
    const s = sinks();
    applyTypedEdit(
      { target: { kind: "preset-name" }, text: "Empty Base Bar" } as FinishedEdit,
      s.calls as never,
      current,
    );
    expect(s.read().name).toBe("Empty Base Bar");
  });

  test("without the current values an edit is kept rather than guessed away", () => {
    // The caller could not say what was there, so discarding the edit would be inventing a fact.
    const s = sinks();
    applyTypedEdit({ target: { kind: "preset-name" }, text: "Opening" } as FinishedEdit, s.calls as never);
    expect(s.read().name).toBe("Opening");
  });
});
