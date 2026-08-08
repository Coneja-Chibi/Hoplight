/**
 * Compacting a conversation before the turn that would not have fitted.
 *
 * The decision is pure and lives in compaction-core.ts; this is the impure half - the one model
 * call that turns the older turns into a summary, and the fallback for when it cannot be made.
 *
 * IT NEVER BLOCKS THE TURN. A summarising pass that fails costs the detail in those old messages,
 * which is bad; refusing to answer because housekeeping failed is worse, and is exactly the dead
 * end this whole change exists to remove. So a failed pass keeps the recent end and drops the rest,
 * and says so.
 */
import {
  COMPACTION_PROMPT,
  planCompaction,
  summaryMessage,
  type Turn,
} from "./compaction-core";
import type { Session } from "../../kit/session";

/** What the window is told, so a conversation never shrinks silently. */
export interface CompactionNote {
  readonly folded: number;
  readonly kept: number;
  readonly tokens: number;
  /** True when the older turns became a summary; false when they were dropped. */
  readonly summarised: boolean;
}

export async function compactHistory(
  history: readonly Turn[],
  session: Pick<Session, "summarise">,
  contextTokens: number,
  note: (note: CompactionNote) => void,
  signal?: AbortSignal,
): Promise<Turn[]> {
  const plan = planCompaction(history, contextTokens);
  if (!plan.compact) return [...history];

  const summary = await session.summarise(plan.fold, COMPACTION_PROMPT, signal);
  note({
    folded: plan.fold.length,
    kept: plan.keep.length,
    tokens: plan.tokens,
    summarised: summary !== null,
  });

  /**
   * A SUMMARY THAT CAME BACK EMPTY IS NOT A SUMMARY. Prepending an empty marker would tell the
   * model that everything before this point was nothing, which reads worse than an honest gap.
   */
  if (summary === null) return [...plan.keep];
  return [summaryMessage(summary), ...plan.keep];
}
