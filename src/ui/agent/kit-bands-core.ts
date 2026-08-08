/**
 * The arithmetic behind Kit's transcript bands: what folds, what a folded line says, and how much
 * of a failure is allowed on screen.
 *
 * Pure so the rules can be asserted rather than eyeballed. The two constants are Kit's own, and the
 * fold rule is Kit's function imported rather than restated - see the note on `sayIsOpen`.
 */
import { isLongSay, saysOpen } from "../../kit/render/say-fold";
import { truncateGraphemes } from "../../kit/_shared/graphemes";

/**
 * How much of a failure the transcript will show.
 *
 * KIT'S NUMBER, from src/kit/render/primitives/error-row.tsx, restated here because that file is an
 * OpenTUI component and importing it would drag a terminal renderer into a browser bundle. The pair
 * is held together by a test that imports the real constant and compares, so this cannot drift
 * quietly - which is the only thing that makes a second copy acceptable.
 *
 * The cap exists because a provider failure is not bounded. A 500 from a proxy can carry a whole
 * HTML error page, and a transcript that renders it has lost the conversation it was keeping.
 */
export const ERROR_ROW_CHARS = 600;

/** A failure, bounded and marked, cut on grapheme boundaries so nothing renders as half a glyph. */
export function boundedError(text: string): string {
  return truncateGraphemes(text, ERROR_ROW_CHARS);
}

/** Just enough of a line for the fold rule to place it. */
export interface FoldableLine {
  readonly role: string;
  readonly open?: boolean | undefined;
}

/**
 * Is this reply long enough to fold at all?
 *
 * Kit's threshold, imported. A reply under it is never collapsed, however many of them there are.
 */
export function isFoldable(text: string, streaming: boolean): boolean {
  // A reply still being typed is never folded: collapsing text as it arrives is unreadable, and the
  // decision is remade the instant it settles anyway.
  return !streaming && isLongSay(text);
}

/**
 * Is this reply showing its text?
 *
 * KIT'S RULE, AND THE ROLE IS PROJECTED TO REACH IT. `saysOpen` asks whether any LATER line has
 * role `"say"`, because that is what Kit calls an assistant turn. This window calls the same thing
 * `"assistant"`, so handing it window lines unchanged would mean the `.some` never matched, every
 * long reply would report open, and the fold would silently do nothing - a feature that looks
 * shipped and collapses nothing.
 *
 * The rest is Kit's, unchanged: the newest reply is open because folding exists to keep scrollback
 * from being a wall and the reply you are reading is not scrollback, and an explicit toggle always
 * wins because collapsing the newest reply is a thing people do deliberately.
 */
export function sayIsOpen(lines: readonly FoldableLine[], index: number): boolean {
  const projected = lines.map((line) => ({
    role: line.role === "assistant" ? "say" : line.role,
    open: line.open,
  }));
  const here = projected[index];
  if (!here) return true;
  return saysOpen(projected, index, here);
}

/**
 * What a folded reply says.
 *
 * Kit's line: that it was said, how much there is, and how to get it back. A fold with no way out
 * printed on it is a reply somebody has to guess is clickable.
 */
export function foldSummary(text: string): string {
  return `said · ${String(text.length)} chars · click reopens`;
}
