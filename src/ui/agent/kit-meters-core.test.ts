/**
 * The meters, pinned to Kit's thresholds and Kit's own reading of what a usage report means.
 *
 * The zoning and the number format are Kit's functions, imported here as well as by the shipped
 * code, so these assertions fail if the terminal's thresholds move.
 */
import { describe, expect, test } from "bun:test";
import { CRIT_AT, WARN_AT, contextMeter } from "../../kit/render/primitives/meters/context-meter-core";
import { compactTokens } from "../../kit/render/primitives/meters/format";
import { tokenTally } from "../../kit/render/primitives/meters/token-tally-core";
import { BAR_WIDTH, NO_TOKENS, ZONE_INK, contextConsumed, foldUsage } from "./kit-meters-core";

describe("Kit's thresholds", () => {
  test("amber at 90 percent, red at 100, and the bar is eighteen cells", () => {
    expect(WARN_AT).toBe(0.9);
    expect(CRIT_AT).toBe(1);
    expect(BAR_WIDTH).toBe(18);
  });

  test("the zone colours are the meter's job, and every one is a palette variable", () => {
    expect(ZONE_INK.calm).toBe("var(--kit-teal)");
    expect(ZONE_INK.warn).toBe("var(--kit-gold)");
    expect(ZONE_INK.crit).toBe("var(--kit-rose)");
  });

  test("an unknown window is count-only, never an invented bar", () => {
    /**
     * DENY BY ABSENCE. This window's provider endpoint reports a context size only when the
     * provider told it one. Drawing a bar against a guessed maximum would put a reassuring
     * two-percent meter in front of somebody whose conversation is about to be truncated.
     */
    const meter = contextMeter(12_300, undefined, BAR_WIDTH);
    expect(meter.known).toBe(false);
  });
});

describe("foldUsage", () => {
  test("THE TURN OVERWRITES AND THE SESSION ADDS", () => {
    /**
     * Kit's split, from turn-events.ts. A turn making four tool calls reports four times: the
     * fourth says how full the window is, the sum of all four says what it cost.
     */
    const first = foldUsage(NO_TOKENS, { input: 100, output: 20 });
    const second = foldUsage(first, { input: 400, output: 60 });
    expect(second.turn.input).toBe(400);
    expect(second.turn.output).toBe(60);
    expect(second.session.input).toBe(500);
    expect(second.session.output).toBe(80);
  });

  test("a total is derived when the provider omits one", () => {
    expect(foldUsage(NO_TOKENS, { input: 7, output: 3 }).turn.total).toBe(10);
  });

  test("RAGGED PROVIDER NUMBERS READ AS ZERO, never as NaN", () => {
    // OpenAI-compatible routers routinely omit these, and one NaN in a meter renders as "NaN%".
    for (const raw of [null, undefined, {}, "nonsense", { input: -5 }, { input: "many" }]) {
      const folded = foldUsage(NO_TOKENS, raw);
      expect(Number.isFinite(folded.turn.input)).toBe(true);
      expect(folded.turn.input).toBe(0);
      expect(folded.session.total).toBe(0);
    }
  });

  test("the session survives a turn that reported nothing at all", () => {
    const one = foldUsage(NO_TOKENS, { input: 90, output: 10 });
    const quiet = foldUsage(one, undefined);
    expect(quiet.session.total).toBe(100);
    expect(quiet.turn.total).toBe(0);
  });
});

describe("what the meter reads", () => {
  test("CONTEXT IS THE INPUT COUNT, not the total", () => {
    // Kit's note: what was sent up is what occupies the window; what came back is the cost.
    const tokens = foldUsage(NO_TOKENS, { input: 84_100, output: 900 });
    expect(contextConsumed(tokens)).toBe(84_100);
  });

  test("the tally suppresses a breakdown for a turn that produced nothing", () => {
    // A quiet or usage-less turn showing "up 0 down 0" is noise dressed as a fact.
    expect(tokenTally(NO_TOKENS.turn, NO_TOKENS.session).detail).toBeUndefined();
    const busy = foldUsage(NO_TOKENS, { input: 1_400, output: 200 });
    expect(tokenTally(busy.turn, busy.session).detail).toBe("up 1.4k down 200");
  });

  test("counts read the way Kit prints them", () => {
    expect(compactTokens(13)).toBe("13");
    expect(compactTokens(1_000)).toBe("1k");
    expect(compactTokens(1_440)).toBe("1.4k");
    expect(compactTokens(1_400_000)).toBe("1.4M");
  });
});
