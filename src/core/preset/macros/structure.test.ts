/**
 * Structural findings. The theme of these tests is the difference between "none" and "unknown", and
 * between a fact and a guess: a report that lets absence read as a clean bill of health is the exact
 * failure this module was built to avoid, and every bound it applies has to name what it bounded.
 */
import { describe, expect, test } from "bun:test";
import { readPresetStructure } from "./structure";

const preset = (
  contents: string[],
  extra: { choices?: unknown[]; yaml?: string; escrow?: boolean } = {},
): unknown => {
  const body = {
    prompts: contents.map((content, index) => ({ id: `b-${index}`, name: `Block ${index}`, content })),
    ...(extra.choices ? { choices: extra.choices } : {}),
  };
  if (extra.yaml === undefined && extra.escrow !== true) return { body };
  return {
    body,
    original: { rolecall: { raw: { ...(extra.yaml !== undefined ? { macro_engine_yaml: extra.yaml } : {}) } } },
  };
};

describe("the state layer, which lives only in escrow", () => {
  test("a parsed hook machine reports read, with its hooks", () => {
    const yaml = [
      "hooks:",
      "  - id: catch-items",
      "    trigger: '(?<=\\[ARC:[^\\]]*)([^,\\]]+)'",
      "    flags: gi",
      "    strip: false",
      "    placement: [user_input, ai_output]",
      "    actions:",
      "      - { type: push, key: plan_items }",
    ].join("\n");
    const found = readPresetStructure(preset(["text"], { yaml }));
    expect(found.stateLayer).toBe("read");
    expect(found.hookCount).toBe(1);
    expect(found.pushHooks).toHaveLength(1);
    // The regex travels verbatim: writing a catcher needs the pattern, not a summary of it.
    expect(found.pushHooks[0]?.trigger).toBe("(?<=\\[ARC:[^\\]]*)([^,\\]]+)");
    expect(found.pushHooks[0]?.variable).toBe("plan_items");
    expect(found.pushHooks[0]?.placement).toEqual(["user_input", "ai_output"]);
  });

  test("escrow present but carrying no machine reports absent", () => {
    const found = readPresetStructure(preset(["text"], { escrow: true }));
    expect(found.stateLayer).toBe("absent");
    expect(found.hookCount).toBe(0);
  });

  test("no escrow at all reports unknown, and says so in its limits", () => {
    // This is the whole point. Without escrow there is no way to tell a preset that never had hooks
    // from one whose hooks were dropped, and zero hooks must not be reported as if it were the former.
    const found = readPresetStructure(preset(["text"]));
    expect(found.stateLayer).toBe("unknown");
    expect(found.hookCount).toBe(0);
    expect(found.limits.join(" ")).toContain("not a claim that there are no hooks");
  });

  test("only a push action is a push hook; a set is not", () => {
    const yaml = [
      "hooks:",
      "  - id: plain-set",
      "    trigger: 'x'",
      "    actions:",
      "      - { type: set, key: mood }",
    ].join("\n");
    const found = readPresetStructure(preset(["t"], { yaml }));
    expect(found.hookCount).toBe(1);
    expect(found.pushHooks).toEqual([]);
  });
});

describe("arrays", () => {
  test("literal indices are collected as a range, dynamic ones counted apart", () => {
    // The two are not interchangeable: a literal index lowers to a fixed name, a computed one
    // lowers to a composed name, and only the first can be enumerated ahead of time.
    const found = readPresetStructure(preset([
      "{{getvarkey::plan::0}} {{getvarkey::plan::2}} {{setvarkey::plan::1::x}}",
      "{{getvarkey::plan::{{getvar::i}}}}",
    ]));
    expect(found.arrays).toHaveLength(1);
    expect(found.arrays[0]?.name).toBe("plan");
    expect(found.arrays[0]?.literalIndices).toEqual([0, 1, 2]);
    expect(found.arrays[0]?.dynamicAccesses).toBe(1);
  });

  test("a preset with no indexed access reports no arrays", () => {
    expect(readPresetStructure(preset(["{{getvar::plain}}"])).arrays).toEqual([]);
  });
});

describe("domains", () => {
  test("a variable written only with literals reports its values", () => {
    const found = readPresetStructure(preset([
      "{{setvar::mood::calm}}{{setvar::mood::tense}}{{setvar::mood::calm}}",
    ]));
    expect(found.domains).toEqual([{ variable: "mood", values: ["calm", "tense"] }]);
  });

  test("one computed write disqualifies the variable entirely, never a partial list", () => {
    // A partial list presented as a domain is what would make a reader expand it wrongly, so the
    // variable drops out rather than reporting the literals it happened to also have.
    const found = readPresetStructure(preset([
      "{{setvar::mood::calm}}{{setvar::mood::{{getvar::other}}}}",
    ]));
    expect(found.domains).toEqual([]);
    expect(found.wideVariables).toEqual([]);
  });

  test("a shorthand assignment counts as a write, and a shorthand comparison does not", () => {
    const found = readPresetStructure(preset([
      "{{.mood = calm}}{{.mood = tense}}{{if {{.mood == calm}}}}x{{/if}}",
    ]));
    expect(found.domains).toEqual([{ variable: "mood", values: ["calm", "tense"] }]);
  });

  test("an arithmetic write opens the domain of a variable that otherwise looks closed", () => {
    // Measured against a real preset: three variables reported as the closed set {0} while incvar
    // and addvar were also driving them. Reported closed, a running counter reads as the constant
    // zero, which is the single most misleading thing this report could say.
    expect(readPresetStructure(preset(["{{setvar::turns::0}}{{incvar::turns}}"])).domains).toEqual([]);
    expect(readPresetStructure(preset(["{{setvar::score::0}}{{addvar::score::5}}"])).domains).toEqual([]);
    expect(readPresetStructure(preset(["{{setvar::n::0}}{{.n++}}"])).domains).toEqual([]);
    expect(readPresetStructure(preset(["{{setvar::n::0}}{{.n += 2}}"])).domains).toEqual([]);
  });

  test("a computed shorthand assignment disqualifies just like a computed setvar", () => {
    const found = readPresetStructure(preset([
      "{{setvar::roll::1}}{{.roll = {{random::1::6}}}}",
    ]));
    expect(found.domains).toEqual([]);
  });

  test("values too long to expand are named, not silently dropped", () => {
    const long = "x".repeat(120);
    const found = readPresetStructure(preset([`{{setvar::essay::${long}}}`]));
    expect(found.domains).toEqual([]);
    expect(found.wideVariables).toEqual(["essay"]);
  });
});

describe("marker candidates", () => {
  test("a dead macro naming a canonical slot is offered, with the word it matched on", () => {
    const found = readPresetStructure(
      preset(["{{message_history}}"]),
      [{ token: "{{message_history}}", where: "Transcript" }],
    );
    expect(found.markerCandidates).toEqual([
      { token: "{{message_history}}", where: "Transcript", markerSlot: "chatHistory", sharedWord: "history" },
    ]);
  });

  test("a dead macro resembling no slot is not forced into one", () => {
    const found = readPresetStructure(
      preset(["{{accentColor}}"]),
      [{ token: "{{accentColor}}", where: "Theme" }],
    );
    expect(found.markerCandidates).toEqual([]);
  });

  test("candidates come only from tokens already known dead, never from live text", () => {
    const found = readPresetStructure(preset(["{{message_history}}"]));
    expect(found.markerCandidates).toEqual([]);
  });
});

describe("choices", () => {
  test("a reference resolves against the preset's own declared group", () => {
    const found = readPresetStructure(preset(["{{choice::lang}}"], {
      choices: [{
        id: "lang",
        key: "lang",
        label: "Language",
        default: "English",
        options: [{ id: "en", label: "English", value: "en" }, { id: "fr", label: "French" }],
      }],
    }));
    expect(found.choices).toHaveLength(1);
    expect(found.choices[0]?.label).toBe("Language");
    expect(found.choices[0]?.defaultValue).toBe("English");
    expect(found.choices[0]?.options).toEqual([
      { id: "en", label: "English", value: "en" },
      { id: "fr", label: "French" },
    ]);
  });

  test("a reference matching no declared group is reported unresolved, not omitted", () => {
    const found = readPresetStructure(preset(["{{choice::ghost}}"], { choices: [] }));
    expect(found.choices).toHaveLength(1);
    expect(found.choices[0]?.reference).toBe("ghost");
    expect(found.choices[0]?.label).toBeNull();
    expect(found.choices[0]?.options).toEqual([]);
  });
});

describe("conditionals", () => {
  test("openers, closers and elses are counted separately", () => {
    const found = readPresetStructure(preset(["{{if a}}x{{else}}y{{/if}}{{if b}}z{{/if}}"]));
    expect(found.conditionals).toEqual({ openers: 2, closers: 2, elses: 1 });
  });
});

test("a body with no prompts is empty, not an error", () => {
  const found = readPresetStructure({ body: {} });
  expect(found.arrays).toEqual([]);
  expect(found.choices).toEqual([]);
  expect(found.limits.length).toBeGreaterThan(0);
});
