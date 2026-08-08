/**
 * The meters' arithmetic: Kit's, imported, plus the two facts this window has to decide for itself.
 *
 * NOTHING IS RECOMPUTED HERE. `contextMeter` already owns the geometry and the pressure zoning,
 * `tokenTally` owns the turn/session strings, `compactTokens` owns the number format, and all three
 * are pure with their own tests. What this file adds is the mapping from a zone to a palette
 * variable, the bar's width, and the fold that gives the window a SESSION total at all - because
 * Kit accumulates one in a turn view that this window does not have.
 */
import { addUsage, EMPTY_USAGE, readUsage, type TokenUsage } from "../../kit/providers/usage";
import type { Zone } from "../../kit/render/primitives/meters/context-meter-core";

/**
 * How many cells the bar draws.
 *
 * Kit's BAR_WIDTH from src/kit/render/primitives/meters/context-meter.tsx. In a terminal these are
 * eighteen character cells; here they are eighteen `#`/`.` glyphs in the mono face, so a screenshot
 * of one meter beside the other shows the same bar at the same fullness.
 */
export const BAR_WIDTH = 18;

/**
 * The ink a zone wears.
 *
 * KIT'S PRESSURE COLOURS, which mirror SillyTavern's amber-at-90 / red-at-100 and are the meter's
 * actual job. A bar that is only ever one colour tells you a number you could have read anyway; the
 * colour is what makes "you are about to lose the start of this conversation" legible without
 * arithmetic.
 */
export const ZONE_INK: Record<Zone, string> = {
  calm: "var(--kit-teal)",
  warn: "var(--kit-gold)",
  crit: "var(--kit-rose)",
};

/** What the window knows about tokens: the latest turn, and everything since it opened. */
export interface Tokens {
  readonly turn: TokenUsage;
  readonly session: TokenUsage;
}

/** Before any turn has reported: two honest zeroes, never a blank or a guess. */
export const NO_TOKENS: Tokens = { turn: EMPTY_USAGE, session: EMPTY_USAGE };

/**
 * Fold one usage report into what the window knows.
 *
 * TURN OVERWRITES, SESSION ADDS - Kit's own split, from turn-events.ts: "Overwrite (not
 * accumulate): .usage tracks the latest call's counts, so the meter reads the turn's final
 * context." A turn that makes four tool calls reports four times, and the fourth is the one that
 * says how full the window is; the sum of all four is what it cost.
 *
 * `readUsage` is the tolerant boundary reader. These numbers crossed a wire from a provider that
 * may omit them, send them as strings, or send a negative - all of which read as zero rather than
 * as NaN spreading through a meter.
 */
export function foldUsage(prior: Tokens, raw: unknown): Tokens {
  const record = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const num = (key: string): number | undefined =>
    typeof record[key] === "number" ? record[key] : undefined;
  const turn = readUsage({
    ...(num("input") === undefined ? {} : { input: num("input") }),
    ...(num("output") === undefined ? {} : { output: num("output") }),
    ...(num("total") === undefined ? {} : { total: num("total") }),
    ...(num("reasoning") === undefined ? {} : { reasoning: num("reasoning") }),
    ...(num("cacheRead") === undefined ? {} : { cacheRead: num("cacheRead") }),
    ...(num("cacheWrite") === undefined ? {} : { cacheWrite: num("cacheWrite") }),
  });
  return { turn, session: addUsage(prior.session, turn) };
}

/**
 * How full the context is, in tokens.
 *
 * THE INPUT COUNT, not the total. Kit's note: "the meter reads .input for context fullness, the
 * tally reads in/out". What was sent up is what is occupying the window; what came back down is
 * next turn's problem and this turn's cost.
 */
export function contextConsumed(tokens: Tokens): number {
  return tokens.turn.input;
}
