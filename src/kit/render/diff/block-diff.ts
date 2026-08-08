/**
 * One block's change, line by line, and who wrote each line.
 *
 * WHY LINES AND NOT A SUMMARY. The review card truncates every value at 48 characters, so a rewritten
 * block reads as "block content rewritten -> 1". That is a count of edits standing in for the edit:
 * you are asked to approve words you cannot see. A block is a thing people read line by line, so it
 * is shown that way.
 *
 * THREE AUTHORS, NOT TWO. The after side is editable, which means a line can come from three places:
 * what was stored, what the model proposed, or what you typed over the top of it. Anything that
 * cannot tell those apart cannot answer "which of these words are mine", which is the question
 * somebody asks right before they accept.
 *
 * A LINE EDITED BACK TO THE ORIGINAL IS NOT A CHANGE. Marking it anyway is the phantom-edit bug in a
 * different costume: it would report something pending that has nothing to apply.
 */

/** Where one line of the after side came from. */
export type LineAuthor =
  /** Identical to what is stored. Not a change at all, whoever typed it. */
  | "stored"
  /** Changed, and exactly what the model proposed. */
  | "model"
  /** Changed, and not what the model proposed: you wrote this. */
  | "yours";

/** One line of the editable side. */
export interface AfterLine {
  readonly text: string;
  readonly author: LineAuthor;
}

/** One line of the read-only side. */
export interface BeforeLine {
  readonly text: string;
  /** True when this line is nowhere in the after side, so it is being removed. */
  readonly removed: boolean;
}

const split = (text: string): string[] => text.split("\n");

/**
 * Who wrote each line of the current text.
 *
 * Compared BY POSITION against both sources. Position rather than a similarity match because the
 * editor is a plain text box: line three is line three, and a fuzzy alignment would move the marks
 * around under a cursor while somebody is typing, which is worse than being occasionally coarse.
 */
export function afterLines(stored: string, proposed: string, current: string): AfterLine[] {
  const wasStored = split(stored);
  const wasProposed = split(proposed);
  return split(current).map((text, at) => {
    if (wasStored[at] === text) return { text, author: "stored" };
    if (wasProposed[at] === text) return { text, author: "model" };
    return { text, author: "yours" };
  });
}

/** The read-only side, with the lines the current text no longer contains marked. */
export function beforeLines(stored: string, current: string): BeforeLine[] {
  const now = new Set(split(current));
  return split(stored).map((text) => ({ text, removed: !now.has(text) }));
}

/** What the gutter prints beside a line. Blank for unchanged, because it is not a change. */
export const authorGlyph = (author: LineAuthor): string =>
  author === "model" ? "+" : author === "yours" ? "~" : " ";

/** How many lines each author is responsible for, for the one-line summary under the panes. */
export interface AuthorTally {
  readonly model: number;
  readonly yours: number;
}

export function tallyAuthors(lines: readonly AfterLine[]): AuthorTally {
  let model = 0;
  let yours = 0;
  for (const line of lines) {
    if (line.author === "model") model += 1;
    if (line.author === "yours") yours += 1;
  }
  return { model, yours };
}

/**
 * Is there anything to apply?
 *
 * FALSE WHEN THE TEXT IS BACK TO WHAT IS STORED, however it got there - reset, or typed back one
 * character at a time. Applying then would write a file identical to the one on disk and report a
 * change nobody made.
 */
export const hasChange = (stored: string, current: string): boolean => stored !== current;

/** Who the current text belongs to, for the line that says so before you accept. */
export function authorOf(stored: string, proposed: string, current: string): "stored" | "model" | "yours" {
  if (current === stored) return "stored";
  return current === proposed ? "model" : "yours";
}
