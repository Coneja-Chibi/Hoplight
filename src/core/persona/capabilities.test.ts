/**
 * P0 truth tables: every ownership row traces to design/PERSONA-LANDSCAPE.md; the injection
 * matrix is the position-picker law's persona twin (RC four + ST five, others hidden).
 */
import { describe, expect, test } from "bun:test";
import {
  fieldVisibility,
  parseWriteFor,
  PERSONA_WRITE_FOR_LABELS,
  PERSONA_WRITE_FOR_PROFILES,
} from "./capabilities";
import {
  allPersonaFieldKeys,
  injectionsForProfile,
  PERSONA_ALL_INJECTIONS,
  PERSONA_INJECTION_LABELS,
  platformOwnsField,
} from "./platform-fields";

describe("profiles and labels", () => {
  test("every profile has a label and full leads the strip", () => {
    expect(PERSONA_WRITE_FOR_PROFILES[0]).toBe("full");
    for (const p of PERSONA_WRITE_FOR_PROFILES) {
      expect(PERSONA_WRITE_FOR_LABELS[p].length).toBeGreaterThan(0);
    }
  });

  test("parseWriteFor is tolerant", () => {
    expect(parseWriteFor("lumiverse")).toBe("lumiverse");
    expect(parseWriteFor("nonsense")).toBe("full");
    expect(parseWriteFor(42)).toBe("full");
  });
});

describe("field ownership (survey-grounded)", () => {
  test("core keys show everywhere; brief and content are inseparable floor", () => {
    for (const p of PERSONA_WRITE_FOR_PROFILES) {
      expect(fieldVisibility(p, "name")).toBe("show");
      expect(fieldVisibility(p, "brief")).toBe("show");
      expect(fieldVisibility(p, "content")).toBe("show");
    }
  });

  test("rolecall owns the authoring cluster; agnai owns only the floor", () => {
    expect(platformOwnsField("rolecall", "sections")).toBe(true);
    expect(platformOwnsField("rolecall", "wrapper")).toBe(true);
    expect(platformOwnsField("agnai", "sections")).toBe(false);
    expect(platformOwnsField("agnai", "imageUrl")).toBe(false);
  });

  test("the pronoun TRIPLET is lumiverse-only among the platforms", () => {
    expect(platformOwnsField("lumiverse", "pronounSet")).toBe(true);
    for (const p of ["rolecall", "sillytavern", "marinara", "agnai"] as const) {
      expect(platformOwnsField(p, "pronounSet")).toBe(false);
    }
    expect(platformOwnsField("full", "pronounSet")).toBe(true);
  });

  test("persona lorebook: ST, Lumi, RC carry it; Marinara and Agnai do not", () => {
    expect(platformOwnsField("sillytavern", "knowledgeRefs")).toBe(true);
    expect(platformOwnsField("lumiverse", "knowledgeRefs")).toBe(true);
    expect(platformOwnsField("rolecall", "knowledgeRefs")).toBe(true);
    expect(platformOwnsField("marinara", "knowledgeRefs")).toBe(false);
    expect(platformOwnsField("agnai", "knowledgeRefs")).toBe(false);
  });

  test("every owned extra is a known key", () => {
    const known = new Set(allPersonaFieldKeys());
    for (const p of PERSONA_WRITE_FOR_PROFILES) {
      for (const k of injectionsForProfile(p)) expect(PERSONA_ALL_INJECTIONS).toContain(k);
      expect(known.size).toBeGreaterThan(0);
    }
  });
});

describe("injection matrix (the position-picker law)", () => {
  test("rolecall carries exactly its four, in RC's order", () => {
    expect(injectionsForProfile("rolecall")).toEqual(["world", "character", "scene", "depth"]);
  });

  test("sillytavern carries exactly its five", () => {
    expect(injectionsForProfile("sillytavern")).toEqual([
      "prompt",
      "author_note_top",
      "author_note_bottom",
      "in_chat",
      "none",
    ]);
  });

  test("lumiverse/marinara/agnai hide the picker (deny by absence)", () => {
    expect(injectionsForProfile("lumiverse")).toEqual([]);
    expect(injectionsForProfile("marinara")).toEqual([]);
    expect(injectionsForProfile("agnai")).toEqual([]);
  });

  test("full carries the union and every stop has plain-language copy", () => {
    expect(injectionsForProfile("full")).toEqual([...PERSONA_ALL_INJECTIONS]);
    for (const stop of PERSONA_ALL_INJECTIONS) {
      expect(PERSONA_INJECTION_LABELS[stop]?.label.length).toBeGreaterThan(0);
      expect(PERSONA_INJECTION_LABELS[stop]?.hint.length).toBeGreaterThan(0);
    }
  });
});
