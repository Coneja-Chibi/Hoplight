/** Token-tally tests for per-turn and session-wide usage summaries. */
import { describe, expect, test } from "bun:test";
import { EMPTY_USAGE, type TokenUsage } from "../../../providers/usage";
import { tokenTally } from "./token-tally-core";

const usage = (over: Partial<TokenUsage>): TokenUsage => ({ ...EMPTY_USAGE, ...over });

describe("tokenTally", () => {
  test("compacts turn and session totals", () => {
    const t = tokenTally(usage({ total: 1_400 }), usage({ total: 84_100 }));
    expect(t.turn).toBe("1.4k");
    expect(t.session).toBe("84.1k");
  });

  test("includes an up/down detail when the turn produced tokens", () => {
    const t = tokenTally(usage({ input: 1_200, output: 240, total: 1_440 }), usage({ total: 84_100 }));
    expect(t.detail).toBe("up 1.2k down 240");
  });

  test("suppresses the detail when the turn total is zero", () => {
    const t = tokenTally(EMPTY_USAGE, usage({ total: 84_100 }));
    expect(t.turn).toBe("0");
    expect(t.session).toBe("84.1k");
    expect(t.detail).toBeUndefined();
  });

  test("pre-first-turn renders 0 / 0 with no detail", () => {
    expect(tokenTally(EMPTY_USAGE, EMPTY_USAGE)).toEqual({ turn: "0", session: "0" });
  });

  test("compacts a session total that has grown into the millions", () => {
    expect(tokenTally(usage({ total: 500 }), usage({ total: 1_400_000 })).session).toBe("1.4M");
  });
});
