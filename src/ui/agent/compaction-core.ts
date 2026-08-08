/**
 * Deciding when a conversation is too long, and what to do about it.
 *
 * WHAT THIS REPLACES. The window bounded a turn by counting MESSAGES - sixty of them - and by a
 * fixed character ceiling. Neither has anything to do with what a conversation costs: somebody on a
 * 272k model, ten percent used, was told "at most 60 messages" and could not go on. A message is not
 * a unit of anything. Tokens are, and the provider already tells us how many it has room for.
 *
 * SO THE BUDGET COMES FROM THE MODEL. Every agent that does this well measures against the real
 * context window - Claude Code compacts near its limit, Codex against a per-model token limit that
 * cannot be set above 90%, OpenCode on `context_limit - output_limit` overflow. The number here is
 * the same idea: a fraction of what this model actually has.
 *
 * AND WHAT HAPPENS AT THE EDGE IS A SUMMARY, NOT A DELETION. Dropping the oldest messages loses the
 * decisions that made the recent ones make sense - the constraint you gave in message three is
 * exactly what the model needs when it acts in message forty. So the old turns are summarised into
 * one message and the newest are kept verbatim, which is the shape all four of those tools landed
 * on independently.
 *
 * PURE. The summarising itself needs a model; deciding what to summarise does not, and this is the
 * part worth being able to test without one.
 */

/** A conversation message as the window sends it. */
export interface Turn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/**
 * Characters per token, near enough.
 *
 * DELIBERATELY A GUESS, and a conservative one. The exact count needs the model's own tokeniser,
 * which lives on the other side of a network call - and being wrong here is cheap in one direction
 * (compacting slightly early) and expensive in the other (a turn the provider refuses). English
 * prose runs about four; code and JSON run denser, so this errs low.
 */
const CHARS_PER_TOKEN = 3.6;

export const estimateTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN);

/**
 * How much of the window a conversation may fill before it is compacted.
 *
 * 0.75 rather than the 0.95 Claude Code uses, because this budget covers the CONVERSATION only -
 * the standing instruction, the screen brief, the tool schemas and the model's own reply all come
 * out of the same window and none of them are counted here. Codex reserves for output the same way.
 * Users of both report 95% firing too late to be useful.
 */
export const CONTEXT_SHARE = 0.75;

/** A studio-sized default for a provider that never said how much room it has. */
export const ASSUMED_CONTEXT = 128_000;

export interface CompactionPlan {
  /** Nothing to do: the conversation fits. */
  readonly compact: false;
  readonly tokens: number;
}

export interface CompactionSplit {
  readonly compact: true;
  /** The older turns, to be replaced by one summary. */
  readonly fold: readonly Turn[];
  /** The newest turns, kept word for word. */
  readonly keep: readonly Turn[];
  readonly tokens: number;
}

/**
 * Split a conversation into what may be summarised and what must survive untouched.
 *
 * THE NEWEST END IS SACRED, and a fixed share of the budget is reserved for it - Codex keeps about
 * 20k tokens of recent messages beside its summary for the same reason. A summary is lossy by
 * definition, and the turns somebody is actually in the middle of are the ones where losing a
 * detail shows up immediately.
 *
 * THE LAST MESSAGE IS NEVER FOLDED. It is the question being asked.
 */
export function planCompaction(
  messages: readonly Turn[],
  contextTokens: number = ASSUMED_CONTEXT,
): CompactionPlan | CompactionSplit {
  const tokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const budget = Math.floor((contextTokens > 0 ? contextTokens : ASSUMED_CONTEXT) * CONTEXT_SHARE);
  if (tokens <= budget || messages.length < 2) return { compact: false, tokens };

  // Half the budget stays with the recent end. The other half is what the summary has to fit in,
  // and a summary that needed more than that was never going to be a summary.
  const keepBudget = Math.floor(budget / 2);
  const keep: Turn[] = [];
  let kept = 0;
  for (let at = messages.length - 1; at >= 1; at -= 1) {
    const message = messages[at]!;
    const cost = estimateTokens(message.content);
    // The final message goes in whatever it costs; everything else has to fit.
    if (keep.length > 0 && kept + cost > keepBudget) break;
    keep.unshift(message);
    kept += cost;
  }
  const fold = messages.slice(0, messages.length - keep.length);
  // Nothing old enough to fold: the recent end alone is over budget, so there is no summary to make
  // and the caller falls back to its last-resort trim.
  if (fold.length === 0) return { compact: false, tokens };
  return { compact: true, fold, keep, tokens };
}

/**
 * What the summarising model is asked for.
 *
 * A HANDOFF, not a precis. The four agents that do this converged on the same list because it is
 * what the next turn actually needs: what was done, what is in flight, which pieces were touched,
 * what the person asked for and ruled out, and what is left. Prose about the mood of the
 * conversation is what makes a compacted session useless.
 */
export const COMPACTION_PROMPT = [
  "Summarise the conversation above so another agent can continue it without having read it.",
  "Write it as a handover, in plain sentences, under 400 words. Cover, in this order:",
  "what has been accomplished; what is in progress right now; which studio pieces were read or",
  "changed, by kind and id; the person's requests, preferences and constraints, in their words",
  "where it matters; anything that failed or was ruled out, so it is not tried again; and what is",
  "left to do. Keep exact names, ids and numbers. Do not invent anything that was not said.",
].join(" ");

/** The summary, as the message that stands in for everything it replaced. */
export const summaryMessage = (summary: string): Turn => ({
  role: "user",
  /**
   * FENCED AND LABELLED, for the same reason the screen brief is: it is a description of a
   * conversation, and it must not read as a fresh instruction the person just gave.
   */
  content: [
    "--- summary of the earlier conversation ---",
    summary.trim(),
    "--- end of summary; the messages after this are the recent conversation, verbatim ---",
  ].join("\n"),
});
