/**
 * Multi-platform regex field + phase ownership: every Write-for profile must expose its wire
 * surface, grounded in design/REGEX-FORMATS.md. Mirrors core/lore/platform-fields.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { fieldVisible, REGEX_WRITE_FOR_PROFILES, type RegexFieldKey } from "./capabilities";
import {
  allRegexFieldKeys,
  PLATFORM_OWNED_EXTRAS,
  phasesForProfile,
  platformOwnsField,
  profileRunsReplaceFeature,
  REGEX_ALL_PHASES,
  REGEX_CORE_KEYS,
  REGEX_HOST_AGE_FEATURES,
  REGEX_PHASES_BY_PROFILE,
  REGEX_REPLACE_FEATURE_SUPPORT,
} from "./platform-fields";

describe("platform field ownership (all regex platforms)", () => {
  test("core keys are owned by every profile", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      for (const k of REGEX_CORE_KEYS) {
        expect(platformOwnsField(p, k)).toBe(true);
        expect(fieldVisible(p, k)).toBe(true);
      }
    }
  });

  test("full is the union: no key hidden", () => {
    for (const k of allRegexFieldKeys()) {
      expect(platformOwnsField("full", k)).toBe(true);
      expect(fieldVisible("full", k)).toBe(true);
    }
  });

  test("sillytavern owns the ST timing/substitution cluster; hides Lumi/Marinara-only fields", () => {
    expect(fieldVisible("sillytavern", "trimStrings")).toBe(true);
    expect(fieldVisible("sillytavern", "substituteFind")).toBe(true);
    expect(fieldVisible("sillytavern", "minDepth")).toBe(true);
    expect(fieldVisible("sillytavern", "maxDepth")).toBe(true);
    expect(fieldVisible("sillytavern", "runOnEdit")).toBe(true);
    expect(fieldVisible("sillytavern", "useFlags")).toBe(false);
    expect(fieldVisible("sillytavern", "targets")).toBe(false);
    expect(fieldVisible("sillytavern", "characterIds")).toBe(false);
  });

  test("rolecall owns ST's timing cluster EXCEPT substituteFind (subsystem A never round-trips it - REGEX-FORMATS.md residual)", () => {
    expect(fieldVisible("rolecall", "trimStrings")).toBe(true);
    expect(fieldVisible("rolecall", "minDepth")).toBe(true);
    expect(fieldVisible("rolecall", "maxDepth")).toBe(true);
    expect(fieldVisible("rolecall", "runOnEdit")).toBe(true);
    expect(fieldVisible("rolecall", "substituteFind")).toBe(false);
  });

  test("risu owns only useFlags among the extras", () => {
    expect(fieldVisible("risu", "useFlags")).toBe(true);
    expect(fieldVisible("risu", "trimStrings")).toBe(false);
    expect(fieldVisible("risu", "substituteFind")).toBe(false);
    expect(fieldVisible("risu", "runOnEdit")).toBe(false);
    expect(fieldVisible("risu", "characterIds")).toBe(false);
  });

  test("lumiverse owns targets/substituteFind/trimStrings/depths/runOnEdit/note", () => {
    expect(fieldVisible("lumiverse", "targets")).toBe(true);
    expect(fieldVisible("lumiverse", "substituteFind")).toBe(true);
    expect(fieldVisible("lumiverse", "trimStrings")).toBe(true);
    expect(fieldVisible("lumiverse", "minDepth")).toBe(true);
    expect(fieldVisible("lumiverse", "maxDepth")).toBe(true);
    expect(fieldVisible("lumiverse", "runOnEdit")).toBe(true);
    expect(fieldVisible("lumiverse", "note")).toBe(true);
    expect(fieldVisible("lumiverse", "useFlags")).toBe(false);
    expect(fieldVisible("lumiverse", "characterIds")).toBe(false);
  });

  test("marinara owns characterIds/targets/depths; hides trimStrings/substituteFind/runOnEdit/useFlags", () => {
    expect(fieldVisible("marinara", "characterIds")).toBe(true);
    expect(fieldVisible("marinara", "targets")).toBe(true);
    expect(fieldVisible("marinara", "minDepth")).toBe(true);
    expect(fieldVisible("marinara", "maxDepth")).toBe(true);
    expect(fieldVisible("marinara", "trimStrings")).toBe(false);
    expect(fieldVisible("marinara", "substituteFind")).toBe(false);
    expect(fieldVisible("marinara", "runOnEdit")).toBe(false);
    expect(fieldVisible("marinara", "useFlags")).toBe(false);
  });

  test("every PLATFORM_OWNED_EXTRAS key is visible on that profile", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      if (p === "full") continue;
      for (const k of PLATFORM_OWNED_EXTRAS[p]) {
        expect(fieldVisible(p, k)).toBe(true);
      }
    }
  });

  test("hidden-vs-owned agree for every profile x key pair", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      for (const k of allRegexFieldKeys()) {
        expect(fieldVisible(p, k)).toBe(platformOwnsField(p, k));
      }
    }
  });
});

describe("pipeline phases per profile (grounded in design/REGEX-FORMATS.md)", () => {
  test("full carries the whole canonical phase set, in display order", () => {
    expect(phasesForProfile("full")).toEqual([...REGEX_ALL_PHASES]);
  });

  test("sillytavern: input/output/slash/lorebook/reasoning; no request, no memory", () => {
    const st = phasesForProfile("sillytavern");
    expect(st).toEqual(["input", "output", "lorebook", "reasoning", "slash"]);
    expect(st).not.toContain("request");
    expect(st).not.toContain("memory");
    expect(st).not.toContain("prompt");
  });

  test("risu: input/output/request/display; no slash, no lorebook", () => {
    expect(phasesForProfile("risu")).toEqual(["input", "output", "request", "display"]);
  });

  test("rolecall: input/output/display/prompt/lorebook/reasoning; no request, no memory", () => {
    const rc = phasesForProfile("rolecall");
    expect(rc).toEqual(["input", "output", "display", "prompt", "lorebook", "reasoning"]);
    expect(rc).not.toContain("request");
    expect(rc).not.toContain("memory");
  });

  test("lumiverse: input/output/lorebook/reasoning/memory - the only profile with memory", () => {
    expect(phasesForProfile("lumiverse")).toEqual(["input", "output", "lorebook", "reasoning", "memory"]);
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      if (p === "full" || p === "lumiverse") continue;
      expect(phasesForProfile(p)).not.toContain("memory");
    }
  });

  test("marinara has exactly input+output", () => {
    expect(phasesForProfile("marinara")).toEqual(["input", "output"]);
  });

  test("every profile's phases are a subset of the canonical set and every profile is mapped", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      const phases = phasesForProfile(p);
      expect(phases.length).toBeGreaterThan(0);
      for (const ph of phases) expect(REGEX_ALL_PHASES).toContain(ph);
    }
  });

  test("REGEX_PHASES_BY_PROFILE has an entry for every profile", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      expect(REGEX_PHASES_BY_PROFILE[p]).toBeDefined();
      expect(REGEX_PHASES_BY_PROFILE[p].length).toBeGreaterThan(0);
    }
  });
});

describe("engine-feature support table (travel-honesty axis, grounded in design/REGEX-FORMATS.md)", () => {
  test("{{match}} runs on full/sillytavern/rolecall only", () => {
    expect(REGEX_REPLACE_FEATURE_SUPPORT["match-token"]).toEqual(["full", "sillytavern", "rolecall"]);
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      const expected = p === "full" || p === "sillytavern" || p === "rolecall";
      expect(profileRunsReplaceFeature(p, "match-token")).toBe(expected);
    }
  });

  test("case transforms / conditional chaining / overlay are vaud-engine only", () => {
    for (const f of ["case-transform", "conditional-chaining", "overlay"] as const) {
      expect(REGEX_REPLACE_FEATURE_SUPPORT[f]).toEqual(["full"]);
      for (const p of REGEX_WRITE_FOR_PROFILES) {
        expect(profileRunsReplaceFeature(p, f)).toBe(p === "full");
      }
    }
  });

  test("<cbs> flag tokens run on Risu only (Vaude strips them at compile)", () => {
    expect(REGEX_REPLACE_FEATURE_SUPPORT["cbs-flag-tokens"]).toEqual(["risu"]);
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      expect(profileRunsReplaceFeature(p, "cbs-flag-tokens")).toBe(p === "risu");
    }
  });

  test("v-flag and lookbehind are exactly the host-age pattern risks", () => {
    expect(REGEX_HOST_AGE_FEATURES).toEqual(["v-flag", "lookbehind"]);
  });
});
