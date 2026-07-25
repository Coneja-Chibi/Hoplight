/** Verifies context-meter thresholds and bounded usage calculations. */
import { describe, expect, test } from "bun:test";
import { contextMeter, CRIT_AT, WARN_AT } from "./context-meter-core";

const known = (m: ReturnType<typeof contextMeter>) => {
  if (!m.known) throw new Error("expected a known meter");
  return m;
};

describe("contextMeter zones", () => {
  test("below WARN_AT is calm", () => {
    expect(known(contextMeter(0.89 * 200, 200, 18)).zone).toBe("calm");
  });

  test("exactly WARN_AT is warn (boundary is inclusive)", () => {
    expect(known(contextMeter(WARN_AT * 200, 200, 18)).zone).toBe("warn");
  });

  test("just below CRIT_AT is still warn", () => {
    expect(known(contextMeter(0.999 * 200, 200, 18)).zone).toBe("warn");
  });

  test("exactly CRIT_AT is crit", () => {
    expect(known(contextMeter(CRIT_AT * 200, 200, 18)).zone).toBe("crit");
  });

  test("overflow past max clamps pct to 1 and forces crit", () => {
    const m = known(contextMeter(500, 200, 18));
    expect(m.zone).toBe("crit");
    expect(m.pct).toBe(1);
    expect(m.filled).toBe(18); // full bar, never overflowing the cells
  });
});

describe("contextMeter unknown / guards", () => {
  test("undefined max -> count-only", () => {
    expect(contextMeter(12_300, undefined, 18)).toEqual({ known: false, consumed: 12_300 });
  });

  test("max <= 0 -> count-only, never divide-by-zero", () => {
    expect(contextMeter(50, 0, 18)).toEqual({ known: false, consumed: 50 });
    expect(contextMeter(50, -100, 18)).toEqual({ known: false, consumed: 50 });
  });

  test("consumed NaN / negative clamps to 0", () => {
    expect(known(contextMeter(NaN, 200, 18)).consumed).toBe(0);
    expect(known(contextMeter(-40, 200, 18)).consumed).toBe(0);
    expect(known(contextMeter(NaN, 200, 18)).filled).toBe(0);
  });

  test("width < 1 -> filled 0, empty 0", () => {
    const m = known(contextMeter(50, 100, 0));
    expect(m.filled).toBe(0);
    expect(m.empty).toBe(0);
    const neg = known(contextMeter(50, 100, -3));
    expect(neg.filled).toBe(0);
    expect(neg.empty).toBe(0);
  });
});

describe("contextMeter invariant", () => {
  test("filled + empty === width for every integer width >= 1", () => {
    for (const width of [1, 5, 18, 100]) {
      for (const consumed of [0, 42, 84_100, 200, 999_999]) {
        const m = known(contextMeter(consumed, 200_000, width));
        expect(m.filled + m.empty).toBe(width);
        expect(m.filled).toBeGreaterThanOrEqual(0);
        expect(m.empty).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("zero consumed with a known max is a calm, empty bar", () => {
    const m = known(contextMeter(0, 200_000, 18));
    expect(m.zone).toBe("calm");
    expect(m.pct).toBe(0);
    expect(m.filled).toBe(0);
    expect(m.empty).toBe(18);
  });
});
