/**
 * Public shapes for the lore activation engine (scanBook / verdicts / timed state).
 */
import type { SelectiveLogic } from "../../entities/lorebook/schema";

export interface ScanLine {
  text: string;
  role: "user" | "assistant" | "system";
}

export interface ActivationOptions {
  /** Rehearsal uses "roll" with injected rng; UI previews use always/never. */
  chanceMode: "roll" | "always" | "never";
  /** Injected; NEVER Math.random inside core. Returns [0, 1). */
  rng?: () => number;
  /** Omit = no budget pass. */
  tokenBudget?: number;
  /** Default 3, hard cap 10. */
  maxRecursionLoops?: number;
  /** Sticky/cooldown/delay carry-over between turns. */
  turnState?: TimedState;
}

export interface TimedState {
  stickyLeft: Record<string, number>;
  cooldownLeft: Record<string, number>;
  turn: number;
}

export type FireReason =
  | { kind: "constant" }
  | {
      kind: "key";
      keyword: string;
      lineIndex: number;
      wholeWord: boolean;
      caseSensitive: boolean;
    }
  | { kind: "recursion"; wokeBy: string; keyword: string; loop: number }
  | { kind: "sticky"; remaining: number };

export type SkipReason =
  | { kind: "disabled" }
  | { kind: "no-key-match" }
  | { kind: "secondary-logic"; logic: SelectiveLogic }
  | { kind: "chance"; rolled: number; needed: number }
  | { kind: "cooldown"; remaining: number }
  | { kind: "delay"; needs: number; have: number }
  | { kind: "budget-cut"; wouldCost: number; left: number }
  | { kind: "vectorized" }
  | { kind: "exclude-recursion" }
  | { kind: "delay-until-recursion"; needs: number; have: number }
  | { kind: "empty-keys" };

export interface EntryVerdict {
  entryId: string;
  fired: boolean;
  reason: FireReason | SkipReason;
  loop: number;
  tokenCost: number;
}

export interface ActivationResult {
  /** EVERY enabled entry gets one (and disabled get disabled verdicts). */
  verdicts: EntryVerdict[];
  /** Convenience: verdicts where fired, in insertion (budget) order. */
  fired: EntryVerdict[];
  budget: { limit: number | null; spent: number; cuts: EntryVerdict[] };
  loops: number;
  nextTurnState: TimedState;
}

export interface WakeEdge {
  from: string;
  to: string;
  keyword: string;
}
