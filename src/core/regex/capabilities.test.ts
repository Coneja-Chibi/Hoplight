/**
 * Regex Write-for capability gating: every profile shows its own wire surface, hides the rest,
 * never deletes data. Mirrors core/lore/capabilities.test.ts.
 */
import { describe, expect, test } from "bun:test";
import {
  fieldVisible,
  isRegexWriteForProfile,
  parseWriteFor,
  regexFieldVisibility,
  REGEX_WRITE_FOR_LABELS,
  REGEX_WRITE_FOR_PROFILES,
  type RegexFieldKey,
} from "./capabilities";
import { PLATFORM_OWNED_EXTRAS, platformOwnsField, REGEX_CORE_KEYS } from "./platform-fields";

describe("isRegexWriteForProfile / parseWriteFor", () => {
  test("accepts every known profile", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) expect(isRegexWriteForProfile(p)).toBe(true);
  });

  test("rejects garbage and unknown strings", () => {
    expect(isRegexWriteForProfile("chub")).toBe(false);
    expect(isRegexWriteForProfile(42)).toBe(false);
    expect(isRegexWriteForProfile(undefined)).toBe(false);
  });

  test("parseWriteFor falls back to full on anything unknown", () => {
    expect(parseWriteFor("risu")).toBe("risu");
    expect(parseWriteFor("chub")).toBe("full");
    expect(parseWriteFor(null)).toBe("full");
  });
});

describe("REGEX_WRITE_FOR_LABELS", () => {
  test("every profile has a label, full reads as the studio name", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) expect(REGEX_WRITE_FOR_LABELS[p]).toBeTruthy();
    expect(REGEX_WRITE_FOR_LABELS.full).toBe("Vaude");
  });
});

describe("regexFieldVisibility / fieldVisible", () => {
  test("core keys are visible on every profile", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      for (const k of REGEX_CORE_KEYS) {
        expect(fieldVisible(p, k)).toBe(true);
      }
    }
  });

  test("full hides nothing", () => {
    const m = regexFieldVisibility("full");
    for (const k of Object.keys(m) as RegexFieldKey[]) expect(m[k]).toBe("show");
  });

  test("risu hides everything but useFlags among the extras", () => {
    expect(fieldVisible("risu", "useFlags")).toBe(true);
    expect(fieldVisible("risu", "trimStrings")).toBe(false);
    expect(fieldVisible("risu", "targets")).toBe(false);
    expect(fieldVisible("risu", "characterIds")).toBe(false);
  });

  test("marinara owns characterIds/targets/depths, hides trimStrings/substituteFind/runOnEdit", () => {
    expect(fieldVisible("marinara", "characterIds")).toBe(true);
    expect(fieldVisible("marinara", "targets")).toBe(true);
    expect(fieldVisible("marinara", "minDepth")).toBe(true);
    expect(fieldVisible("marinara", "maxDepth")).toBe(true);
    expect(fieldVisible("marinara", "trimStrings")).toBe(false);
    expect(fieldVisible("marinara", "substituteFind")).toBe(false);
    expect(fieldVisible("marinara", "runOnEdit")).toBe(false);
  });

  test("lumiverse is the only non-full profile that owns note", () => {
    expect(fieldVisible("lumiverse", "note")).toBe(true);
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      if (p === "full" || p === "lumiverse") continue;
      expect(fieldVisible(p, "note")).toBe(false);
    }
  });

  test("every PLATFORM_OWNED_EXTRAS key is visible on that profile", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      if (p === "full") continue;
      for (const k of PLATFORM_OWNED_EXTRAS[p]) {
        expect(fieldVisible(p, k)).toBe(true);
      }
    }
  });

  test("hidden fields are exactly the ones platformOwnsField rejects", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      const m = regexFieldVisibility(p);
      for (const [k, vis] of Object.entries(m) as [RegexFieldKey, string][]) {
        if (!platformOwnsField(p, k)) expect(vis).toBe("hide");
        else expect(vis).toBe("show");
      }
    }
  });
});
