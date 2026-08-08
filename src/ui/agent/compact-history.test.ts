/**
 * The compacting pass around the model call.
 *
 * The rules live in compaction-core.ts. What matters here is the promise this half makes: the turn
 * goes ahead whatever happens to the summary, and the conversation never shrinks silently.
 */
import { describe, expect, test } from "bun:test";
import { compactHistory } from "./compact-history";
import type { CompactionNote } from "./compact-history";
import type { Turn } from "./compaction-core";

const sized = (tokens: number, tag = "x"): Turn => ({ role: "user", content: tag.repeat(Math.round(tokens * 3.6)) });
const session = (summary: string | null) => ({ summarise: async () => summary });

describe("compactHistory", () => {
  test("a conversation that fits is handed back untouched, with no model call", async () => {
    const history = [sized(10), sized(10)];
    let called = false;
    const got = await compactHistory(
      history,
      { summarise: async () => { called = true; return "s"; } },
      272_000,
      () => {},
    );
    expect(got).toEqual(history);
    // The call costs money and loses detail; an ordinary conversation must never pay for it.
    expect(called).toBe(false);
  });

  test("the summary stands in for the old turns, and the recent end survives", async () => {
    const history = [sized(9_000, "a"), sized(50, "b"), sized(10, "c")];
    const got = await compactHistory(history, session("they wanted three presets"), 10_000, () => {});
    expect(got[0]?.content).toContain("they wanted three presets");
    expect(got[0]?.content).toContain("summary of the earlier conversation");
    expect(got.at(-1)).toEqual(history.at(-1)!);
    expect(got.length).toBeLessThan(history.length + 1);
  });

  test("A FAILED SUMMARY STILL LETS THE TURN HAPPEN", async () => {
    /**
     * The dead end this whole change exists to remove. Losing the detail in old messages is bad;
     * refusing to answer because housekeeping failed is worse.
     */
    const history = [sized(9_000, "a"), sized(50, "b"), sized(10, "c")];
    const got = await compactHistory(history, session(null), 10_000, () => {});
    expect(got.length).toBeGreaterThan(0);
    expect(got.at(-1)).toEqual(history.at(-1)!);
    // No empty marker: telling the model everything before this was nothing reads worse than a gap.
    expect(got.some((m) => m.content.includes("summary of the earlier"))).toBe(false);
  });

  test("IT NEVER SHRINKS A CONVERSATION SILENTLY", async () => {
    // Somebody whose history was folded should be able to see that it was, and whether the detail
    // was summarised or simply dropped.
    const notes: CompactionNote[] = [];
    const history = [sized(9_000, "a"), sized(50, "b"), sized(10, "c")];
    await compactHistory(history, session("summary"), 10_000, (n) => notes.push(n));
    expect(notes).toHaveLength(1);
    expect(notes[0]?.summarised).toBe(true);
    expect(notes[0]?.folded).toBeGreaterThan(0);

    notes.length = 0;
    await compactHistory(history, session(null), 10_000, (n) => notes.push(n));
    expect(notes[0]?.summarised).toBe(false);
  });
});
