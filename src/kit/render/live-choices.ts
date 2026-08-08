/**
 * Which question is still waiting on you.
 *
 * ONLY THE LAST ONE, AND ONLY UNTIL IT IS ANSWERED. An older question further up the transcript has
 * been answered or abandoned, and letting a number key reach back into it would make the same
 * keystroke mean different things depending on how far somebody had scrolled.
 *
 * Pure and separate from the shell because it is a rule about the transcript, not about rendering.
 */
import type { RenderLine } from "./turn-events";

/** A question waiting for an answer, and where it sits in the transcript. */
export interface LiveAsk {
  readonly index: number;
  readonly question: string;
  readonly options: readonly { value: string; note?: string }[];
}

/**
 * The question still open, or null.
 *
 * SPEAKING DOES NOT CLOSE IT. A question is closed by being ANSWERED, which the panel records on the
 * line itself - so a stray message typed while a panel is up leaves the panel usable rather than
 * quietly stranding it. That is the difference from the old rule, which treated any user line as an
 * answer and would now abandon a round set the moment somebody said anything else.
 */
export function liveAsk(lines: readonly RenderLine[]): LiveAsk | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line?.role !== "choices") continue;
    if (line.answered !== undefined) return null;
    return { index: i, question: line.question, options: line.options };
  }
  return null;
}
