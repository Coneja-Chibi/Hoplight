/** Regression coverage for the specials.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import { SPECIAL_TRIGGER_PRESETS } from "./index";

describe("SPECIAL_TRIGGER_PRESETS", () => {
  test("every preset is a bracket special keyword", () => {
    for (const p of SPECIAL_TRIGGER_PRESETS) {
      expect(p.keyword.startsWith("[")).toBe(true);
      expect(p.keyword.endsWith("]") || p.keyword.endsWith(":]")).toBe(true);
      expect(p.group === "context" || p.group === "narrative").toBe(true);
    }
  });

  test("includes narrative LLM-conditionals and contextual specials", () => {
    const keys = SPECIAL_TRIGGER_PRESETS.map((p) => p.keyword);
    expect(keys.some((k) => k.startsWith("[mood:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("[messageCount:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("[randomChance:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("[lorebookActive:"))).toBe(true);
  });
});
