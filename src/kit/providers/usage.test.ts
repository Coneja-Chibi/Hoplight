import { describe, expect, test } from "bun:test";
import { addUsage, EMPTY_USAGE, readUsage, type TokenUsage } from "./usage";

describe("readUsage", () => {
  test("reads a full, valid payload verbatim", () => {
    expect(
      readUsage({ input: 100, output: 40, total: 140, cacheRead: 10, cacheWrite: 5, reasoning: 7 }),
    ).toEqual({ input: 100, output: 40, total: 140, cacheRead: 10, cacheWrite: 5, reasoning: 7 });
  });

  test("undefined / NaN / Infinity / negative all read 0", () => {
    expect(
      readUsage({ input: undefined, output: NaN, total: Infinity, cacheRead: -5, cacheWrite: -0.1 }),
    ).toEqual(EMPTY_USAGE);
  });

  test("derives total from input+output when total is absent", () => {
    expect(readUsage({ input: 1200, output: 240 }).total).toBe(1440);
  });

  test("derives total when total is reported as zero but input+output is positive", () => {
    expect(readUsage({ input: 30, output: 10, total: 0 }).total).toBe(40);
  });

  test("keeps a provider-reported positive total over the derived sum", () => {
    // some routers report only a total; input/output stay 0 and total is trusted
    expect(readUsage({ total: 900 })).toEqual({ ...EMPTY_USAGE, total: 900 });
  });

  test("empty payload -> all zeros", () => {
    expect(readUsage({})).toEqual(EMPTY_USAGE);
  });
});

describe("addUsage", () => {
  test("sums field-wise", () => {
    const a: TokenUsage = { input: 1, output: 2, total: 3, cacheRead: 4, cacheWrite: 5, reasoning: 6 };
    const b: TokenUsage = { input: 10, output: 20, total: 30, cacheRead: 40, cacheWrite: 50, reasoning: 60 };
    expect(addUsage(a, b)).toEqual({
      input: 11,
      output: 22,
      total: 33,
      cacheRead: 44,
      cacheWrite: 55,
      reasoning: 66,
    });
  });

  test("leaves both inputs unmutated", () => {
    const a: TokenUsage = { ...EMPTY_USAGE, input: 5, total: 5 };
    const b: TokenUsage = { ...EMPTY_USAGE, input: 7, total: 7 };
    addUsage(a, b);
    expect(a).toEqual({ ...EMPTY_USAGE, input: 5, total: 5 });
    expect(b).toEqual({ ...EMPTY_USAGE, input: 7, total: 7 });
  });

  test("EMPTY_USAGE is the additive identity", () => {
    const a: TokenUsage = { input: 9, output: 8, total: 17, cacheRead: 1, cacheWrite: 2, reasoning: 3 };
    expect(addUsage(a, EMPTY_USAGE)).toEqual(a);
  });
});
