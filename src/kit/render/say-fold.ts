/**
 * Deterministic long-reply folding policy. It depends only on stored text and position, so a resumed
 * transcript produces the same collapsed shape as the live session after streaming settles.
 */
export const LONG_SAY_CHARS = 1200;

export const isLongSay = (text: string): boolean => text.length > LONG_SAY_CHARS;

/** Just enough of a transcript line to decide whether it is the newest reply. */
interface FoldableLine {
  readonly role: string;
  readonly open?: boolean | undefined;
}

/**
 * Is this reply showing its text?
 *
 * THE NEWEST REPLY IS OPEN. Folding exists to keep scrollback from being a wall, and the reply you
 * are reading is not scrollback. A long answer streamed in full, settled, and collapsed itself to one
 * line in the same instant - so the longer and more useful the answer, the less of it you were
 * allowed to see, and the only way to read your own reply was to click it open again every time.
 *
 * AN EXPLICIT TOGGLE ALWAYS WINS. `open` is undefined until somebody clicks; once they have, that is
 * an instruction and this rule stops applying to that line. Collapsing the newest reply is a thing
 * people do deliberately, and it must not spring back open on the next render.
 *
 * Position, not a timestamp, so a resumed transcript folds exactly like the live one did.
 */
export function saysOpen(
  lines: readonly FoldableLine[],
  index: number,
  line: FoldableLine,
): boolean {
  if (line.open !== undefined) return line.open;
  return !lines.some((later, at) => at > index && later.role === "say");
}
