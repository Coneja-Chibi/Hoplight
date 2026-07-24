/**
 * tokenTally: the pure view model behind the Token Tally readout. Turns the canonical turn/session
 * TokenUsage into the compact strings the shell paints: this turn's total, the running session total,
 * and an optional up/down detail. The detail is suppressed when the turn produced nothing, so a quiet
 * or usage-less turn never shows a noisy "0 / 0" breakdown. Pure formatting: no I/O, never throws.
 */
import type { TokenUsage } from "../../../providers/usage";
import { compactTokens } from "./format";

export interface TokenTally {
  readonly turn: string;
  readonly session: string;
  /** "up <in> down <out>" for this turn, present only when the turn produced tokens. */
  readonly detail?: string;
}

/** Build the tally strings from this turn's usage and the running session total. */
export const tokenTally = (turn: TokenUsage, session: TokenUsage): TokenTally => {
  const base = { turn: compactTokens(turn.total), session: compactTokens(session.total) };
  if (turn.total <= 0) return base;
  return { ...base, detail: `up ${compactTokens(turn.input)} down ${compactTokens(turn.output)}` };
};
