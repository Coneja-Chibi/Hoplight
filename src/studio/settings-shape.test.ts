/**
 * settings-shape tests - the fail-closed settings parser. Every known key drops to absent on a
 * bad value; unknown keys (drop-in step keys) pass through untouched; garbage in = defaults out.
 */
import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, parseSettings } from "./settings-shape";

describe("parseSettings", () => {
  test("garbage reads as fresh defaults", () => {
    for (const bad of [null, undefined, 42, "hi", [], true]) {
      expect(parseSettings(bad)).toEqual({ ...DEFAULT_SETTINGS });
    }
  });

  test("a full valid document round-trips", () => {
    const doc = {
      setupComplete: true,
      theme: "stage" as const,
      firstDeck: "character",
      publishTargets: ["SillyTavern", "RisuAI"],
      houseAccent: "#8b5cf6",
    };
    expect(parseSettings(doc)).toEqual(doc);
  });

  test("setupComplete is strictly boolean true", () => {
    expect(parseSettings({ setupComplete: "yes" }).setupComplete).toBe(false);
    expect(parseSettings({ setupComplete: 1 }).setupComplete).toBe(false);
    expect(parseSettings({ setupComplete: true }).setupComplete).toBe(true);
  });

  test("bad known values drop to absent without poisoning the rest", () => {
    const out = parseSettings({
      setupComplete: true,
      theme: "neon",
      firstDeck: "",
      publishTargets: ["SillyTavern", 7, null, ""],
      houseAccent: "red",
    });
    expect(out.setupComplete).toBe(true);
    expect(out.theme).toBeUndefined();
    expect(out.firstDeck).toBeUndefined();
    expect(out.publishTargets).toEqual(["SillyTavern"]);
    expect(out.houseAccent).toBeUndefined();
  });

  test("houseAccent accepts real hex only", () => {
    expect(parseSettings({ houseAccent: "#e11d48" }).houseAccent).toBe("#e11d48");
    expect(parseSettings({ houseAccent: "#fff" }).houseAccent).toBe("#fff");
    expect(parseSettings({ houseAccent: "javascript:alert(1)" }).houseAccent).toBeUndefined();
  });

  test("unknown keys pass through (drop-in step keys are open by design)", () => {
    const out = parseSettings({ setupComplete: false, myStepKey: { any: "shape" } });
    expect(out.myStepKey).toEqual({ any: "shape" });
  });
});
