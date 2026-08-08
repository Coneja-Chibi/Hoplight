/**
 * Selecting text, and what happens to it.
 *
 * A SELECTION IS AN ANCHOR AND A CURSOR, not a start and an end. Which one is first depends on which
 * way you dragged, and every operation here has to work the same in both directions - selecting
 * upward and pressing delete must remove the same characters as selecting downward and pressing it.
 * Storing it "already sorted" is how that goes wrong, because the anchor is where you started and
 * that fact is needed to extend the selection later.
 */
import type { TextBuffer } from "./text-buffer";

/** A position in the document. */
export interface Spot {
  readonly row: number;
  readonly col: number;
}

/** Where a selection began. Null means nothing is selected. */
export type Anchor = Spot | null;

/** Which of two positions comes first in reading order. */
export const before = (a: Spot, b: Spot): boolean =>
  a.row < b.row || (a.row === b.row && a.col <= b.col);

/** The selection in reading order, or null when there is none or it is empty. */
export function ordered(anchor: Anchor, cursor: Spot): { from: Spot; to: Spot } | null {
  if (!anchor) return null;
  if (anchor.row === cursor.row && anchor.col === cursor.col) return null;
  return before(anchor, cursor) ? { from: anchor, to: cursor } : { from: cursor, to: anchor };
}

/** Is this character inside the selection? Used per cell while drawing. */
export function covers(anchor: Anchor, cursor: Spot, row: number, col: number): boolean {
  const range = ordered(anchor, cursor);
  if (!range) return false;
  if (row < range.from.row || row > range.to.row) return false;
  if (row === range.from.row && col < range.from.col) return false;
  if (row === range.to.row && col >= range.to.col) return false;
  return true;
}

/** The selected text, ready for the clipboard. Empty string when nothing is selected. */
export function selectedText(buffer: TextBuffer, anchor: Anchor): string {
  const range = ordered(anchor, { row: buffer.row, col: buffer.col });
  if (!range) return "";
  const { from, to } = range;
  if (from.row === to.row) return (buffer.lines[from.row] ?? "").slice(from.col, to.col);
  const head = (buffer.lines[from.row] ?? "").slice(from.col);
  const middle = buffer.lines.slice(from.row + 1, to.row);
  const tail = (buffer.lines[to.row] ?? "").slice(0, to.col);
  return [head, ...middle, tail].join("\n");
}

/**
 * Remove the selection, leaving the cursor where it was.
 *
 * The cursor lands at the START of what was selected however it was made, because that is where the
 * text now is - dragging upward and dragging downward delete the same characters and leave the
 * caret in the same place.
 */
export function deleteSelection(buffer: TextBuffer, anchor: Anchor): TextBuffer {
  const range = ordered(anchor, { row: buffer.row, col: buffer.col });
  if (!range) return buffer;
  const { from, to } = range;
  const head = (buffer.lines[from.row] ?? "").slice(0, from.col);
  const tail = (buffer.lines[to.row] ?? "").slice(to.col);
  const lines = [
    ...buffer.lines.slice(0, from.row),
    head + tail,
    ...buffer.lines.slice(to.row + 1),
  ];
  return { lines: lines.length > 0 ? lines : [""], row: from.row, col: from.col };
}

/**
 * Put text in at the cursor, replacing any selection.
 *
 * MULTI-LINE PASTE IS THE POINT. Pasting three paragraphs used to be impossible: the old editor
 * appended printable characters one at a time and Enter committed, so a newline could not arrive at
 * all - by hand or from a clipboard.
 */
export function insertText(buffer: TextBuffer, anchor: Anchor, text: string): TextBuffer {
  const base = anchor ? deleteSelection(buffer, anchor) : buffer;
  const line = base.lines[base.row] ?? "";
  const head = line.slice(0, base.col);
  const tail = line.slice(base.col);
  // Normalised, because a Windows clipboard carries \r\n and a stray \r draws as a blank cell.
  const parts = text.replace(/\r\n?/g, "\n").split("\n");

  if (parts.length === 1) {
    const only = parts[0]!;
    return {
      lines: base.lines.map((l, i) => (i === base.row ? head + only + tail : l)),
      row: base.row,
      col: base.col + only.length,
    };
  }
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const middle = parts.slice(1, -1);
  const lines = [
    ...base.lines.slice(0, base.row),
    head + first,
    ...middle,
    last + tail,
    ...base.lines.slice(base.row + 1),
  ];
  return { lines, row: base.row + parts.length - 1, col: last.length };
}
