/**
 * Kit's live-widget timings, held to Kit's own numbers.
 *
 * These read like trivia and are not. The stagehand IS its cadence: a dot breathing on 1.6 seconds,
 * a verb turning over every 5.2, dots stepping every 800ms. Rounded to "about a second" it stops
 * being the same object, and somebody watching a turn in the terminal beside a turn in the window
 * would be watching two programs that merely look alike.
 */
import { describe, expect, test } from "bun:test";
import {
  BREATH_STEP_MS, DOT_STEP_MS, STAGE_VERBS, VERB_HOLD_MS,
  breathInk, clockText, rehearsalTail, stageLabel, traceSummary,
} from "./kit-widgets-core";

describe("clockText", () => {
  test("minutes and zero-padded seconds, floored", () => {
    expect(clockText(0)).toBe("0:00");
    expect(clockText(9_400)).toBe("0:09");
    expect(clockText(61_000)).toBe("1:01");
    expect(clockText(600_000)).toBe("10:00");
  });

  test("NEGATIVE TIME READS AS ZERO, never as a negative clock", () => {
    // A clock is stamped from `Date.now() - startedAt`, and a machine that slept or resynced its
    // time can make that negative. "-1:-3" on screen looks like the app is broken.
    expect(clockText(-5_000)).toBe("0:00");
  });
});

describe("the stagehand's cadence", () => {
  test("THE DOT BREATHES ON KIT'S 1.6 SECOND CYCLE", () => {
    // Four inks at 400ms each: dim, deep, bright, deep. It is a breath, not a blink.
    expect(BREATH_STEP_MS).toBe(400);
    const at = (ms: number): string => breathInk(ms);
    expect(at(0)).not.toBe(at(400));
    expect(at(400)).not.toBe(at(800));
    // A full cycle returns to where it started.
    expect(at(1_600)).toBe(at(0));
    expect(at(2_000)).toBe(at(400));
  });

  test("the verb holds for 5.2 seconds, then the next takes the stage", () => {
    expect(VERB_HOLD_MS).toBe(5_200);
    expect(stageLabel(0)).toContain(STAGE_VERBS[0]);
    expect(stageLabel(5_100)).toContain(STAGE_VERBS[0]);
    expect(stageLabel(5_300)).toContain(STAGE_VERBS[1]);
    // And it wraps rather than running out of verbs on a long turn.
    expect(stageLabel(VERB_HOLD_MS * STAGE_VERBS.length)).toContain(STAGE_VERBS[0]);
  });

  test("the dots step every 800ms, one to three", () => {
    expect(DOT_STEP_MS).toBe(800);
    const dots = (ms: number): number => (stageLabel(ms).match(/\./g) ?? []).length;
    expect(dots(0)).toBe(1);
    expect(dots(800)).toBe(2);
    expect(dots(1_600)).toBe(3);
    // Back to one, never four.
    expect(dots(2_400)).toBe(1);
  });

  test("NO PROVIDER NAME EVER APPEARS", () => {
    /**
     * Kit's rule, and a good one: while you are waiting, who is being billed is not the thing you
     * are waiting to learn. The elapsed clock is the only hard fact the stagehand carries.
     */
    for (const ms of [0, 5_000, 60_000]) {
      const label = stageLabel(ms);
      expect(label).not.toMatch(/anthropic|openai|claude|gpt|codex/i);
    }
  });
});

describe("rehearsalTail", () => {
  test("short thoughts are shown whole", () => {
    expect(rehearsalTail("thinking about it")).toBe("thinking about it");
  });

  test("it keeps the FRESHEST slice, because that is what watching means", () => {
    // The point of the open box is seeing it think now. The whole thought lands afterwards as a
    // trace, so nothing is lost by showing the tail.
    const long = `${"a".repeat(500)}NEWEST`;
    const tail = rehearsalTail(long, 20);
    expect(tail.endsWith("NEWEST")).toBe(true);
    expect([...tail]).toHaveLength(20);
  });

  test("IT NEVER CUTS A CHARACTER IN HALF", () => {
    /**
     * Sliced by UTF-16 unit, a surrogate pair breaks into a replacement glyph - and reasoning is
     * exactly the text most likely to carry emoji and CJK, because it quotes whatever the person is
     * working on. Counted by code point instead.
     */
    const emoji = "x".repeat(30) + "\u{1F534}\u{1F534}\u{1F534}";
    const tail = rehearsalTail(emoji, 3);
    expect(tail).toBe("\u{1F534}\u{1F534}\u{1F534}");
    expect(tail).not.toContain("�");
  });
});

describe("traceSummary", () => {
  test("it says how long, how much, and how to get it back", () => {
    const line = traceSummary(12.4, 3_751);
    expect(line).toContain("12s");
    expect(line).toContain("3751 chars");
    expect(line).toContain("reopen");
  });

  test("a sub-second thought does not report a negative or empty duration", () => {
    expect(traceSummary(0.2, 10)).toContain("0s");
    expect(traceSummary(-3, 10)).toContain("0s");
  });
});
