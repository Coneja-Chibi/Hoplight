import { describe, expect, test } from "bun:test";
import { stripeFor } from "./stripe-core";
import type { RiskLevel } from "./risk";

describe("stripeFor", () => {
  test("safe shows nothing so the marker keeps its signal", () => {
    const s = stripeFor("safe");
    expect(s.show).toBe(false);
    expect(s.glyph).toBe("");
  });

  test("caution shows a bar labeled caution", () => {
    const s = stripeFor("caution");
    expect(s.show).toBe(true);
    expect(s.label).toBe("caution");
    expect(s.glyph.length).toBeGreaterThan(0);
  });

  test("danger shows a bar labeled danger", () => {
    const s = stripeFor("danger");
    expect(s.show).toBe(true);
    expect(s.label).toBe("danger");
    expect(s.glyph.length).toBeGreaterThan(0);
  });

  test("an out-of-range level fails toward danger and never throws", () => {
    const call = () => stripeFor("nope" as RiskLevel);
    expect(call).not.toThrow();
    const s = call();
    expect(s.level).toBe("danger");
    expect(s.show).toBe(true);
  });

  test("escalation is monotonic: only safe is hidden", () => {
    expect(stripeFor("safe").show).toBe(false);
    expect(stripeFor("caution").show).toBe(true);
    expect(stripeFor("danger").show).toBe(true);
  });
});
