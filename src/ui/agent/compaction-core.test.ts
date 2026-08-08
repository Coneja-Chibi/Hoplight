/**
 * When a conversation is too long, and what survives being compacted.
 *
 * The failure this replaces was not subtle: sixty messages, refused, on a model with 272k of room
 * and ten percent of it used. So the first thing worth pinning is that an ordinary conversation is
 * never touched at all - a compaction that fires early costs a model call and loses detail for
 * nothing.
 */
import { describe, expect, test } from "bun:test";
import {
  ASSUMED_CONTEXT,
  CONTEXT_SHARE,
  estimateTokens,
  planCompaction,
  summaryMessage,
  type Turn,
} from "./compaction-core";

const say = (content: string): Turn => ({ role: "user", content });
/** Roughly n tokens of text. */
const sized = (tokens: number): Turn => say("x".repeat(Math.round(tokens * 3.6)));

describe("planCompaction", () => {
  test("A LONG CONVERSATION WELL INSIDE THE WINDOW IS LEFT ALONE", () => {
    /**
     * The reported bug, as a test. Sixty short messages against a 272k model is nothing, and the
     * old rule refused the turn outright.
     */
    const sixty = Array.from({ length: 60 }, (_, i) => say(`message ${String(i)}`));
    expect(planCompaction(sixty, 272_000).compact).toBe(false);
  });

  test("it compacts once the conversation fills its share of the window", () => {
    const budget = Math.floor(10_000 * CONTEXT_SHARE);
    const over = [sized(budget), sized(200), sized(200)];
    expect(planCompaction(over, 10_000).compact).toBe(true);
  });

  test("THE NEWEST MESSAGES ARE KEPT WORD FOR WORD", () => {
    // A summary is lossy by definition, and the turns somebody is in the middle of are where
    // losing a detail shows up immediately.
    // Over the 7,500-token budget a 10k window allows, so this genuinely compacts.
    const messages = [sized(9_000), sized(100), say("the newest thing I said")];
    const plan = planCompaction(messages, 10_000);
    expect(plan.compact).toBe(true);
    if (plan.compact) {
      expect(plan.keep.at(-1)?.content).toBe("the newest thing I said");
      expect(plan.fold).toContain(messages[0]!);
    }
  });

  test("THE QUESTION BEING ASKED IS NEVER FOLDED AWAY", () => {
    // Even when the last message alone is enormous, it is the thing being asked and it goes.
    const messages = [sized(3_000), sized(9_000)];
    const plan = planCompaction(messages, 10_000);
    if (plan.compact) expect(plan.keep).toContain(messages[1]!);
  });

  test("nothing old enough to fold means no compaction, not an empty summary", () => {
    // One vast message over budget has no earlier half to summarise; the caller's trim handles it.
    expect(planCompaction([sized(50_000)], 10_000).compact).toBe(false);
  });

  test("a provider that never said how much room it has gets a studio-sized default", () => {
    const under = Array.from({ length: 20 }, () => sized(100));
    expect(planCompaction(under, 0).compact).toBe(false);
    expect(planCompaction([sized(ASSUMED_CONTEXT)], 0).compact).toBe(false);
  });

  test("the share leaves room for the instruction, the brief, the tools and the reply", () => {
    /**
     * The budget covers the CONVERSATION only. Claude Code compacts near 95% of the whole window;
     * this counts a fraction of it because everything else the turn carries is uncounted here, and
     * both its users and Codex's report 95% firing too late to be useful.
     */
    expect(CONTEXT_SHARE).toBeLessThan(0.9);
  });
});

describe("estimateTokens", () => {
  test("it errs low on characters per token, so it compacts early rather than late", () => {
    // Being wrong early costs a model call; being wrong late costs a turn the provider refuses.
    expect(estimateTokens("x".repeat(360))).toBeGreaterThanOrEqual(100);
  });
});

describe("summaryMessage", () => {
  test("IT READS AS A RECORD, NOT AS SOMETHING THE PERSON JUST ASKED FOR", () => {
    // Fenced and labelled for the same reason the screen brief is: a description of a conversation
    // dropped in bare would be followed as a fresh instruction.
    const message = summaryMessage("they wanted three presets");
    expect(message.content).toContain("summary of the earlier conversation");
    expect(message.content).toContain("verbatim");
    expect(message.content).toContain("they wanted three presets");
  });
});
