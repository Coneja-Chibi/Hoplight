/**
 * Stated conclusions about how a preset works.
 *
 * The bar these tests hold is not "does it produce text" but "does it stay quiet when it does not
 * know". An invented architecture is worse than none: a reader who is told a preset stages its state
 * will preserve an ordering that does not exist, and the claim is not checkable at a glance. So the
 * staging finding requires all three of its signals, and the absence of any one of them means
 * silence rather than a hedge.
 */
import { describe, expect, test } from "bun:test";
import { explainPreset } from "./explain";

const hook = (id: string, trigger: string, actions: string, extra = ""): string => [
  `  - id: ${id}`,
  `    trigger: '${trigger}'`,
  `    placement: [user_input, ai_output]`,
  ...(extra ? [`    ${extra}`] : []),
  "    actions:",
  ...actions.split("|").map((a) => {
    const [type, key] = a.split(" ");
    return `      - { type: ${type}, key: ${key} }`;
  }),
].join("\n");

const preset = (yaml: string, contents: string[] = []): unknown => ({
  body: { prompts: contents.map((content, i) => ({ id: `b${i}`, name: `B${i}`, content })) },
  original: { rolecall: { raw: { macro_engine_yaml: `hooks:\n${yaml}` } } },
});

const COMMIT = "{{setvar::mood::{{getvar::staging_mood}}}}";

describe("the staging-and-commit cycle", () => {
  const full = preset(
    [
      hook("reset", "^", "set staging_mood|set staging_beat"),
      hook("catch", "\\[MOOD:(.+?)\\]", "set staging_mood"),
    ].join("\n"),
    [COMMIT],
  );

  test("is stated, with the ordering hazard spelled out", () => {
    const found = explainPreset(full).find((o) => o.id.startsWith("staging-cycle"));
    expect(found).toBeDefined();
    expect(found?.severity).toBe("critical");
    expect(found?.says).toContain("RESET MUST RUN BEFORE THE WRITERS");
    // The evidence has to name the hook, or the claim cannot be checked.
    expect(found?.evidence).toContain("reset");
  });

  test("is NOT claimed when nothing resets the family", () => {
    const noReset = preset(hook("catch", "\\[MOOD:(.+?)\\]", "set staging_mood"), [COMMIT]);
    expect(explainPreset(noReset).some((o) => o.id.startsWith("staging-cycle"))).toBe(false);
  });

  test("is NOT claimed when nothing reads the staged values back", () => {
    const noCommit = preset([
      hook("reset", "^", "set staging_mood"),
      hook("catch", "\\[MOOD:(.+?)\\]", "set staging_mood"),
    ].join("\n"), ["plain text with no commit"]);
    expect(explainPreset(noCommit).some((o) => o.id.startsWith("staging-cycle"))).toBe(false);
  });

  test("a specific trigger is not mistaken for an every-passage reset", () => {
    const specific = preset([
      hook("reset", "\\[RESET\\]", "set staging_mood"),
      hook("catch", "\\[MOOD:(.+?)\\]", "set staging_mood"),
    ].join("\n"), [COMMIT]);
    expect(explainPreset(specific).some((o) => o.id.startsWith("staging-cycle"))).toBe(false);
  });
});

describe("hazards a conversion can silently destroy", () => {
  test("list appends are flagged as needing several rules", () => {
    const found = explainPreset(preset(hook("collect", "\\[P:(.+?)\\]", "push plan_items")))
      .find((o) => o.id === "push-hooks");
    expect(found?.severity).toBe("critical");
    expect(found?.evidence).toContain("plan_items");
  });

  test("strip hooks are flagged, since a target that keeps the text shows authoring tags", () => {
    const yaml = hook("tag", "\\[X\\]", "set marker", "strip: true");
    const found = explainPreset(preset(yaml)).find((o) => o.id === "strip-hooks");
    expect(found?.says).toContain("remove their matched text");
  });
});

describe("silence rather than invention", () => {
  test("a preset with no hook machine says nothing at all", () => {
    expect(explainPreset({ body: { prompts: [] } })).toEqual([]);
    expect(explainPreset({ body: { prompts: [{ id: "a", name: "A", content: "hi {{char}}" }] } }))
      .toEqual([]);
  });

  test("an unreadable hook machine is reported as incomplete, not as empty", () => {
    // Counting what parsed and calling it the whole inventory is the failure this guards.
    const damaged = {
      body: { prompts: [] },
      original: { rolecall: { raw: { macro_engine_yaml: "hooks:\n  - id: a\n    ???: broken\n" } } },
    };
    const found = explainPreset(damaged).find((o) => o.id === "unparsed-hook-lines");
    expect(found?.says).toContain("not understood");
  });
});
