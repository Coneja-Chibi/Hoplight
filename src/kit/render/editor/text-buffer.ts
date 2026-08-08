/**
 * A block of text with a cursor in it.
 *
 * Kit has never had one. The rail's editor holds a single `string` and appends printable characters
 * to it: no cursor, no newline - Enter is the commit key - and no way to fix a word in the middle
 * except to delete everything after it. That is fine for renaming a block and useless for the 3.8k
 * of hand-laid unicode a README block actually contains.
 *
 * PURE, AND LINES-AND-CURSOR RATHER THAN ONE STRING WITH AN OFFSET. Every operation here is an
 * off-by-one waiting to happen - backspace at the start of a line, up-arrow into a shorter line, home
 * on an empty document - and a shape where those are expressible is a shape where they are testable.
 *
 * THE CURSOR IS CLAMPED, NEVER TRUSTED. Every function returns a buffer whose cursor is inside the
 * text it belongs to, so no caller can produce a position that does not exist.
 */

export interface TextBuffer {
  /** The document, split on newlines. Always at least one line, which may be empty. */
  readonly lines: readonly string[];
  /** Which line the cursor is on. */
  readonly row: number;
  /** How many characters into that line. `line.length` means past the last character. */
  readonly col: number;
}

/** A buffer holding this text, cursor at the very end where somebody would start typing. */
export function bufferOf(text: string): TextBuffer {
  const lines = text.split("\n");
  const row = lines.length - 1;
  return { lines, row, col: lines[row]?.length ?? 0 };
}

/** The document as one string again. */
export const textOf = (buffer: TextBuffer): string => buffer.lines.join("\n");

/** Put the cursor somewhere that exists, whatever was asked for. */
function clamp(lines: readonly string[], row: number, col: number): TextBuffer {
  const safeRows = lines.length > 0 ? lines : [""];
  const r = Math.max(0, Math.min(row, safeRows.length - 1));
  const c = Math.max(0, Math.min(col, safeRows[r]!.length));
  return { lines: safeRows, row: r, col: c };
}

/** Type one character. */
export function insert(buffer: TextBuffer, char: string): TextBuffer {
  const line = buffer.lines[buffer.row] ?? "";
  const next = line.slice(0, buffer.col) + char + line.slice(buffer.col);
  const lines = buffer.lines.map((l, i) => (i === buffer.row ? next : l));
  return clamp(lines, buffer.row, buffer.col + char.length);
}

/**
 * Split the line at the cursor.
 *
 * The whole reason this file exists: Enter used to commit, so a paragraph break was not a character
 * anybody could type into a block.
 */
export function newline(buffer: TextBuffer): TextBuffer {
  const line = buffer.lines[buffer.row] ?? "";
  const head = line.slice(0, buffer.col);
  const tail = line.slice(buffer.col);
  const lines = [
    ...buffer.lines.slice(0, buffer.row),
    head,
    tail,
    ...buffer.lines.slice(buffer.row + 1),
  ];
  return clamp(lines, buffer.row + 1, 0);
}

/**
 * Delete backwards.
 *
 * AT THE START OF A LINE it joins to the one above, landing the cursor where the join happened -
 * which is where the eye already is, and where the next keystroke belongs.
 */
export function backspace(buffer: TextBuffer): TextBuffer {
  if (buffer.col > 0) {
    const line = buffer.lines[buffer.row] ?? "";
    const next = line.slice(0, buffer.col - 1) + line.slice(buffer.col);
    return clamp(buffer.lines.map((l, i) => (i === buffer.row ? next : l)), buffer.row, buffer.col - 1);
  }
  if (buffer.row === 0) return buffer;
  const above = buffer.lines[buffer.row - 1] ?? "";
  const joined = above + (buffer.lines[buffer.row] ?? "");
  const lines = [
    ...buffer.lines.slice(0, buffer.row - 1),
    joined,
    ...buffer.lines.slice(buffer.row + 1),
  ];
  return clamp(lines, buffer.row - 1, above.length);
}

/** Delete forwards, joining the line below when the cursor is at the end. */
export function deleteForward(buffer: TextBuffer): TextBuffer {
  const line = buffer.lines[buffer.row] ?? "";
  if (buffer.col < line.length) {
    const next = line.slice(0, buffer.col) + line.slice(buffer.col + 1);
    return clamp(buffer.lines.map((l, i) => (i === buffer.row ? next : l)), buffer.row, buffer.col);
  }
  if (buffer.row >= buffer.lines.length - 1) return buffer;
  const joined = line + (buffer.lines[buffer.row + 1] ?? "");
  const lines = [
    ...buffer.lines.slice(0, buffer.row),
    joined,
    ...buffer.lines.slice(buffer.row + 2),
  ];
  return clamp(lines, buffer.row, buffer.col);
}

export type Move = "left" | "right" | "up" | "down" | "home" | "end" | "top" | "bottom";

/**
 * Move the cursor.
 *
 * LEFT AND RIGHT WRAP BETWEEN LINES, because a document is one stream of characters to the person
 * reading it and stopping dead at a line end is the thing that makes an editor feel broken.
 *
 * UP AND DOWN KEEP THE COLUMN WHERE THEY CAN. Landing in a shorter line clamps to its end rather
 * than refusing to move, which is what every editor does and what fingers expect.
 */
export function move(buffer: TextBuffer, how: Move): TextBuffer {
  const line = buffer.lines[buffer.row] ?? "";
  switch (how) {
    case "left":
      if (buffer.col > 0) return clamp(buffer.lines, buffer.row, buffer.col - 1);
      if (buffer.row === 0) return buffer;
      return clamp(buffer.lines, buffer.row - 1, (buffer.lines[buffer.row - 1] ?? "").length);
    case "right":
      if (buffer.col < line.length) return clamp(buffer.lines, buffer.row, buffer.col + 1);
      if (buffer.row >= buffer.lines.length - 1) return buffer;
      return clamp(buffer.lines, buffer.row + 1, 0);
    case "up":
      return clamp(buffer.lines, buffer.row - 1, buffer.col);
    case "down":
      return clamp(buffer.lines, buffer.row + 1, buffer.col);
    case "home":
      return clamp(buffer.lines, buffer.row, 0);
    case "end":
      return clamp(buffer.lines, buffer.row, line.length);
    case "top":
      return clamp(buffer.lines, 0, 0);
    case "bottom":
      return clamp(buffer.lines, buffer.lines.length - 1, Number.MAX_SAFE_INTEGER);
  }
}

/**
 * Which lines to draw, so the cursor is always on screen.
 *
 * Returned rather than held as state: a scroll offset that lives beside the buffer is a second thing
 * that can disagree with it, and the one it would disagree with is where the cursor is.
 */
export function visibleWindow(buffer: TextBuffer, height: number): { from: number; to: number } {
  const rows = Math.max(1, height);
  if (buffer.lines.length <= rows) return { from: 0, to: buffer.lines.length };
  const from = Math.max(0, Math.min(buffer.row - Math.floor(rows / 2), buffer.lines.length - rows));
  return { from, to: from + rows };
}
