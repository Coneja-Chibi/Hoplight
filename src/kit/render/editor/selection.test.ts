/**
 * Selecting text, and what happens to it.
 *
 * A selection is an ANCHOR and a CURSOR, so every operation has to work identically in both
 * directions. Most of these tests run the same case twice - dragged down, then dragged up - because
 * "works one way" is the failure mode this shape invites.
 */
import { describe, expect, test } from "bun:test";
import { covers, deleteSelection, insertText, ordered, selectedText } from "./selection";
import { bufferOf, textOf, type TextBuffer } from "./text-buffer";

const at = (text: string, row: number, col: number): TextBuffer => ({ ...bufferOf(text), row, col });
const DOC = "one two\nthree\nfour five";

describe("ordered", () => {
  test("it sorts into reading order whichever way it was made", () => {
    const down = ordered({ row: 0, col: 2 }, { row: 2, col: 1 });
    const up = ordered({ row: 2, col: 1 }, { row: 0, col: 2 });
    expect(down).toEqual(up!);
  });

  test("an empty selection is no selection", () => {
    // Clicking without dragging leaves an anchor exactly where the cursor is; that is not a range.
    expect(ordered({ row: 1, col: 3 }, { row: 1, col: 3 })).toBeNull();
  });

  test("no anchor is no selection", () => {
    expect(ordered(null, { row: 0, col: 0 })).toBeNull();
  });
});

describe("selectedText", () => {
  test("within one line", () => {
    expect(selectedText(at(DOC, 0, 7), { row: 0, col: 4 })).toBe("two");
  });

  test("across lines, both directions the same", () => {
    const down = selectedText(at(DOC, 2, 4), { row: 0, col: 4 });
    const up = selectedText(at(DOC, 0, 4), { row: 2, col: 4 });
    expect(down).toBe("two\nthree\nfour");
    expect(up).toBe(down);
  });

  test("nothing selected is empty, not undefined", () => {
    expect(selectedText(at(DOC, 0, 0), null)).toBe("");
  });
});

describe("covers", () => {
  test("it marks the characters between, and not the one past the end", () => {
    // The end is exclusive: a selection ending at column 3 covers 0,1,2 and stops.
    expect(covers({ row: 0, col: 0 }, { row: 0, col: 3 }, 0, 2)).toBe(true);
    expect(covers({ row: 0, col: 0 }, { row: 0, col: 3 }, 0, 3)).toBe(false);
  });

  test("a middle line is covered whole", () => {
    expect(covers({ row: 0, col: 5 }, { row: 2, col: 1 }, 1, 99)).toBe(true);
  });

  test("lines outside are untouched", () => {
    expect(covers({ row: 1, col: 0 }, { row: 1, col: 4 }, 0, 0)).toBe(false);
    expect(covers({ row: 1, col: 0 }, { row: 1, col: 4 }, 2, 0)).toBe(false);
  });
});

describe("deleteSelection", () => {
  test("it removes the same characters whichever way it was dragged", () => {
    const down = deleteSelection(at(DOC, 2, 4), { row: 0, col: 4 });
    const up = deleteSelection(at(DOC, 0, 4), { row: 2, col: 4 });
    expect(textOf(down)).toBe("one  five");
    expect(textOf(up)).toBe(textOf(down));
  });

  test("THE CURSOR LANDS WHERE THE TEXT NOW IS, both directions", () => {
    // Dragging up and dragging down must leave the caret in the same place: the start of what went.
    const down = deleteSelection(at(DOC, 2, 4), { row: 0, col: 4 });
    const up = deleteSelection(at(DOC, 0, 4), { row: 2, col: 4 });
    expect([down.row, down.col]).toEqual([0, 4]);
    expect([up.row, up.col]).toEqual([0, 4]);
  });

  test("no selection changes nothing", () => {
    const b = at(DOC, 1, 2);
    expect(deleteSelection(b, null)).toEqual(b);
  });

  test("deleting everything leaves one empty line, not zero", () => {
    const gone = deleteSelection(at(DOC, 2, 9), { row: 0, col: 0 });
    expect(gone.lines).toEqual([""]);
  });
});

describe("insertText", () => {
  test("a plain string goes in at the cursor", () => {
    expect(textOf(insertText(at("abcd", 0, 2), null, "XY"))).toBe("abXYcd");
  });

  test("MULTI-LINE PASTE, which used to be impossible", () => {
    /**
     * The old editor appended printable characters one at a time and Enter committed, so a newline
     * could not arrive at all - typed or pasted.
     */
    const out = insertText(at("abcd", 0, 2), null, "X\nY\nZ");
    expect(textOf(out)).toBe("abX\nY\nZcd");
    expect([out.row, out.col]).toEqual([2, 1]);
  });

  test("windows line endings do not leave stray carriage returns", () => {
    // A \r draws as a blank cell and hides in every diff after it.
    expect(textOf(insertText(at("ab", 0, 2), null, "X\r\nY"))).toBe("abX\nY");
  });

  test("pasting over a selection replaces it", () => {
    const out = insertText(at(DOC, 0, 7), { row: 0, col: 4 }, "TWO");
    expect(textOf(out)).toBe("one TWO\nthree\nfour five");
  });

  test("pasting over a multi-line selection replaces the lot", () => {
    const out = insertText(at(DOC, 2, 4), { row: 0, col: 4 }, "X");
    expect(textOf(out)).toBe("one X five");
  });

  test("the cursor ends after what was pasted", () => {
    const out = insertText(at("ab", 0, 1), null, "XYZ");
    expect([out.row, out.col]).toEqual([0, 4]);
  });
});
