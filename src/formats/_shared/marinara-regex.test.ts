/**
 * Marinara regex mapping tests (REGEX-JEWEL-PLAN.md Phase R1 must #5 and #6). Field shapes mirror
 * `Marinara-Engine/packages/shared/src/types/regex.ts`; a hand-built array here stands in for the
 * "Marinara's Essentials" fixture until the phase that owns `formats/_fixtures/regex/` lands.
 */
import { test, expect, describe } from "bun:test";
import {
  readMarinaraRegexScript,
  readMarinaraRegexScripts,
  marinaraScriptToRule,
  marinaraScriptsToRules,
  ruleToMarinaraScript,
  rulesToMarinaraScripts,
  type MarinaraRegexScript,
} from "./marinara-regex";
import type { RegexRule } from "../../entities/regex/schema";

/** A representative Marinara script row exercising every field, both placements, and depth window. */
const FULL_SCRIPT: MarinaraRegexScript = {
  id: "mar-1",
  name: "Strip stage directions",
  enabled: true,
  findRegex: "\\*[^*]+\\*",
  replaceString: "",
  trimStrings: ["  ", "\n\n"],
  placement: ["ai_output", "user_input"],
  flags: "gi",
  promptOnly: true,
  targetCharacterIds: ["char-a", "char-b"],
  order: 3,
  minDepth: 0,
  maxDepth: 4,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-02T00:00:00.000Z",
};

/** A bare-minimum script: empty placement, no targets, null depths, empty trims - the "as-created" row. */
const MINIMAL_SCRIPT: MarinaraRegexScript = {
  id: "mar-2",
  name: "",
  enabled: false,
  findRegex: "foo",
  replaceString: "bar",
  trimStrings: [],
  placement: [],
  flags: "",
  promptOnly: false,
  targetCharacterIds: [],
  order: 0,
  minDepth: null,
  maxDepth: null,
  createdAt: "",
  updatedAt: "",
};

describe("readMarinaraRegexScript - boundary parse", () => {
  test("accepts a well-formed row", () => {
    expect(readMarinaraRegexScript(FULL_SCRIPT)).toEqual(FULL_SCRIPT);
  });

  test("rejects non-objects", () => {
    expect(readMarinaraRegexScript(null)).toBeNull();
    expect(readMarinaraRegexScript("nope")).toBeNull();
    expect(readMarinaraRegexScript(42)).toBeNull();
    expect(readMarinaraRegexScript(["array"])).toBeNull();
  });

  test("rejects an object missing id or findRegex", () => {
    expect(readMarinaraRegexScript({ findRegex: "x" })).toBeNull();
    expect(readMarinaraRegexScript({ id: "x" })).toBeNull();
  });

  test("defaults malformed field types instead of throwing", () => {
    const parsed = readMarinaraRegexScript({
      id: "mar-3",
      findRegex: "x",
      enabled: "true", // string, not boolean - server's isEnabled() tolerates this
      placement: "ai_output", // bare string, not an array
      trimStrings: "not-an-array",
      order: "not-a-number",
      minDepth: "0",
    });
    expect(parsed).toEqual({
      id: "mar-3",
      name: "",
      enabled: true,
      findRegex: "x",
      replaceString: "",
      trimStrings: [],
      placement: [],
      flags: "",
      promptOnly: false,
      targetCharacterIds: [],
      order: 0,
      minDepth: null,
      maxDepth: null,
      createdAt: "",
      updatedAt: "",
    });
  });

  test("readMarinaraRegexScripts drops malformed rows, keeps well-formed ones", () => {
    const parsed = readMarinaraRegexScripts([FULL_SCRIPT, { bad: true }, MINIMAL_SCRIPT, null]);
    expect(parsed).toEqual([FULL_SCRIPT, MINIMAL_SCRIPT]);
  });

  test("readMarinaraRegexScripts returns [] for non-array input", () => {
    expect(readMarinaraRegexScripts({ not: "an array" })).toEqual([]);
  });
});

describe("marinaraScriptToRule - field mapping (R1 must #5)", () => {
  test("maps core fields, both placements to phases, promptOnly to targets, characterIds", () => {
    const rule = marinaraScriptToRule(FULL_SCRIPT);
    expect(rule.id).toBe("mar-1");
    expect(rule.label).toBe("Strip stage directions");
    expect(rule.find).toBe("\\*[^*]+\\*");
    expect(rule.flags).toBe("gi");
    expect(rule.replace).toBe("");
    expect(rule.trimStrings).toEqual(["  ", "\n\n"]);
    expect(rule.phases).toEqual(["output", "input"]);
    expect(rule.targets).toEqual(["prompt"]);
    expect(rule.minDepth).toBe(0);
    expect(rule.maxDepth).toBe(4);
    expect(rule.characterIds).toEqual(["char-a", "char-b"]);
    expect(rule.enabled).toBe(true);
    expect(rule.sortOrder).toBe(3);
  });

  test("promptOnly false folds to targets undefined (not-prompt-only = both wire and display)", () => {
    const rule = marinaraScriptToRule({ ...FULL_SCRIPT, promptOnly: false });
    expect(rule.targets).toBeUndefined();
  });

  test("empty trimStrings/targetCharacterIds fold to undefined, not []", () => {
    const rule = marinaraScriptToRule(MINIMAL_SCRIPT);
    expect(rule.trimStrings).toBeUndefined();
    expect(rule.characterIds).toBeUndefined();
  });

  test("empty placement folds to empty phases (never-fires is representable, not dropped)", () => {
    const rule = marinaraScriptToRule(MINIMAL_SCRIPT);
    expect(rule.phases).toEqual([]);
  });

  test("createdAt/updatedAt with no canonical home are sealed in extras", () => {
    const rule = marinaraScriptToRule(FULL_SCRIPT);
    expect(rule.extras).toEqual({
      marinaraCreatedAt: "2026-01-01T00:00:00.000Z",
      marinaraUpdatedAt: "2026-02-02T00:00:00.000Z",
    });
  });

  test("marinaraScriptsToRules maps a whole array", () => {
    const rules = marinaraScriptsToRules([FULL_SCRIPT, MINIMAL_SCRIPT]);
    expect(rules).toHaveLength(2);
    expect(rules[0]!.id).toBe("mar-1");
    expect(rules[1]!.id).toBe("mar-2");
  });
});

describe("ruleToMarinaraScript - inverse mapping", () => {
  test("restores placement from phases and promptOnly from targets", () => {
    const rule: RegexRule = {
      id: "r1",
      label: "Test",
      find: "x",
      flags: "g",
      replace: "y",
      phases: ["input", "output"],
      targets: ["prompt"],
      characterIds: ["c1"],
      enabled: true,
      sortOrder: 5,
    };
    const wire = ruleToMarinaraScript(rule);
    expect(wire.placement.sort()).toEqual(["ai_output", "user_input"]);
    expect(wire.promptOnly).toBe(true);
    expect(wire.targetCharacterIds).toEqual(["c1"]);
    expect(wire.order).toBe(5);
    expect(wire.trimStrings).toEqual([]);
    expect(wire.minDepth).toBeNull();
    expect(wire.maxDepth).toBeNull();
  });

  test("phases outside Marinara's input/output subset are capability-hidden, not thrown on", () => {
    const rule: RegexRule = {
      id: "r2",
      label: "Foreign phase",
      find: "x",
      flags: "",
      replace: "",
      phases: ["lorebook", "reasoning"],
      enabled: true,
      sortOrder: 0,
    };
    const wire = ruleToMarinaraScript(rule);
    expect(wire.placement).toEqual([]);
  });

  test("missing extras default createdAt/updatedAt to empty string, never throw", () => {
    const rule: RegexRule = {
      id: "r3",
      label: "No extras",
      find: "x",
      flags: "",
      replace: "",
      phases: [],
      enabled: true,
      sortOrder: 0,
    };
    const wire = ruleToMarinaraScript(rule);
    expect(wire.createdAt).toBe("");
    expect(wire.updatedAt).toBe("");
  });
});

describe("round-trip byte-equality (R1 must #6)", () => {
  test("full script survives script -> rule -> script unchanged", () => {
    const rule = marinaraScriptToRule(FULL_SCRIPT);
    const back = ruleToMarinaraScript(rule);
    // placement order is not semantically significant; compare as sets, everything else exact.
    expect(back.placement.sort()).toEqual([...FULL_SCRIPT.placement].sort());
    expect({ ...back, placement: undefined }).toEqual({ ...FULL_SCRIPT, placement: undefined });
  });

  test("minimal script survives script -> rule -> script unchanged", () => {
    const rule = marinaraScriptToRule(MINIMAL_SCRIPT);
    const back = ruleToMarinaraScript(rule);
    expect(back).toEqual(MINIMAL_SCRIPT);
  });

  test("a whole array round-trips (rulesToMarinaraScripts is the array twin)", () => {
    const rules = marinaraScriptsToRules([FULL_SCRIPT, MINIMAL_SCRIPT]);
    const back = rulesToMarinaraScripts(rules);
    expect(back[1]).toEqual(MINIMAL_SCRIPT);
    expect(back[0]!.placement.sort()).toEqual([...FULL_SCRIPT.placement].sort());
    expect({ ...back[0], placement: undefined }).toEqual({ ...FULL_SCRIPT, placement: undefined });
  });
});
