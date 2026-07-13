/**
 * P0 truth tables: every ownership row traces to docs/PRESET-JEWEL-PLAN.md (survey + presets-core +
 * the verified Marinara export). The placement matrix is the position-picker law's preset twin
 * (RC five, ST/Marinara two).
 */
import { describe, expect, test } from "bun:test";
import {
  fieldVisibility,
  parseWriteFor,
  PRESET_WRITE_FOR_LABELS,
  PRESET_WRITE_FOR_PROFILES,
} from "./capabilities";
import { allPresetFieldKeys, platformOwnsField } from "./platform-fields";

describe("profiles and labels", () => {
  test("every profile has a label and full leads the strip", () => {
    expect(PRESET_WRITE_FOR_PROFILES[0]).toBe("full");
    for (const p of PRESET_WRITE_FOR_PROFILES) {
      expect(PRESET_WRITE_FOR_LABELS[p].length).toBeGreaterThan(0);
    }
  });

  test("lumiverse is NOT an authoring lens (import-only)", () => {
    expect((PRESET_WRITE_FOR_PROFILES as readonly string[]).includes("lumiverse")).toBe(false);
    expect(parseWriteFor("lumiverse")).toBe("full");
  });

  test("parseWriteFor is tolerant", () => {
    expect(parseWriteFor("marinara")).toBe("marinara");
    expect(parseWriteFor("nonsense")).toBe("full");
    expect(parseWriteFor(42)).toBe("full");
  });
});

describe("field ownership (survey-grounded)", () => {
  test("core keys show under every lens (name, description, prompts)", () => {
    for (const p of PRESET_WRITE_FOR_PROFILES) {
      expect(fieldVisibility(p, "name")).toBe("show");
      expect(fieldVisibility(p, "description")).toBe("show");
      expect(fieldVisibility(p, "prompts")).toBe("show");
    }
  });

  test("choices (the walkthrough): RC and Marinara own it, ST does not", () => {
    expect(platformOwnsField("rolecall", "choices")).toBe(true);
    expect(platformOwnsField("marinara", "choices")).toBe(true);
    expect(platformOwnsField("sillytavern", "choices")).toBe(false);
    expect(platformOwnsField("full", "choices")).toBe(true);
  });

  test("per-block XML wrap is Marinara-only among the platforms", () => {
    expect(platformOwnsField("marinara", "xmlWrap")).toBe(true);
    expect(platformOwnsField("rolecall", "xmlWrap")).toBe(false);
    expect(platformOwnsField("sillytavern", "xmlWrap")).toBe(false);
    expect(platformOwnsField("full", "xmlWrap")).toBe(true);
  });

  test("ST's full settings surface: templates + media + generation are ST/RC, not Marinara", () => {
    for (const k of ["templates", "media", "generation"] as const) {
      expect(platformOwnsField("sillytavern", k)).toBe(true);
      expect(platformOwnsField("rolecall", k)).toBe(true);
      expect(platformOwnsField("marinara", k)).toBe(false);
    }
  });

  test("every owned extra is a known field key", () => {
    const known = new Set(allPresetFieldKeys());
    for (const p of PRESET_WRITE_FOR_PROFILES) {
      for (const k of ["samplers", "markers"] as const) {
        if (platformOwnsField(p, k)) expect(known.has(k)).toBe(true);
      }
    }
    expect(known.has("choices")).toBe(true);
  });
});
