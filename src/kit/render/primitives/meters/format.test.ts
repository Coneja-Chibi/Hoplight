/** Compact token-count formatting tests across whole and abbreviated ranges. */
import { describe, expect, test } from "bun:test";
import { compactTokens } from "./format";

describe("compactTokens", () => {
  test("integers below 1k render whole", () => {
    expect(compactTokens(13)).toBe("13");
    expect(compactTokens(240)).toBe("240");
    expect(compactTokens(999)).toBe("999");
  });

  test("thousands render with one decimal, trailing .0 dropped", () => {
    expect(compactTokens(1_000)).toBe("1k");
    expect(compactTokens(1_400)).toBe("1.4k");
    expect(compactTokens(84_100)).toBe("84.1k");
    expect(compactTokens(200_000)).toBe("200k");
  });

  test("millions render with one decimal, trailing .0 dropped", () => {
    expect(compactTokens(1_000_000)).toBe("1M");
    expect(compactTokens(1_400_000)).toBe("1.4M");
  });

  test("rounds half up at the k boundary", () => {
    expect(compactTokens(1_450)).toBe("1.5k");
    expect(compactTokens(1_449)).toBe("1.4k");
  });

  test("NaN / Infinity / non-positive render '0'", () => {
    expect(compactTokens(NaN)).toBe("0");
    expect(compactTokens(Infinity)).toBe("0");
    expect(compactTokens(0)).toBe("0");
    expect(compactTokens(-5)).toBe("0");
  });
});
