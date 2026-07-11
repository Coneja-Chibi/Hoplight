/**
 * RoleCall regex codec tests. Covers REGEX-JEWEL-PLAN.md R1 musts #3 (script{rules[]} <-> one set,
 * snake_case fields, placements <-> phases) and #6 (unknown fields land in extras and re-emit
 * byte-equal) for the resolved subsystem-A wire (apply-regex.ts).
 */
import { describe, expect, test } from "bun:test";
import { canonicalToRolecallRegex, rolecallRegexToCanonical } from "./regex";

/** A real-shaped subsystem-A RegexScript, snake_case throughout, one rule per known placement. */
function fixtureScript(): Record<string, unknown> {
  return {
    id: "script-1",
    name: "Cleanup pack",
    workspace_note: "kept for the operator, no first-class home",
    rules: [
      {
        id: "rule-1",
        name: "Strip stage directions",
        description: "removes *asterisk* actions from AI replies",
        find_pattern: "\\*[^*]+\\*",
        replace_string: "",
        placement: ["ai_output", "display_only"],
        flags: "g",
        enabled: true,
        min_depth: 0,
        max_depth: 5,
        run_on_edit: true,
        sort_order: 0,
        trim_strings: ["  "],
        custom_flag: true,
      },
      {
        id: "rule-2",
        name: "Prompt-only macro fix",
        find_pattern: "\\{\\{oldmacro\\}\\}",
        replace_string: "{{newmacro}}",
        placement: ["prompt_only", "lorebook", "reasoning", "user_input"],
        flags: "gi",
        enabled: false,
        sort_order: 1,
      },
    ],
  };
}

describe("rolecallRegexToCanonical - must #3: script{rules[]} <-> one set", () => {
  test("maps script name and rule array to a flat RegexSetBody", () => {
    const body = rolecallRegexToCanonical(fixtureScript());
    expect(body.name).toBe("Cleanup pack");
    expect(body.rules).toHaveLength(2);
  });

  test("maps snake_case rule fields to canonical camelCase", () => {
    const body = rolecallRegexToCanonical(fixtureScript());
    const rule = body.rules[0]!;
    expect(rule.id).toBe("rule-1");
    expect(rule.label).toBe("Strip stage directions");
    expect(rule.note).toBe("removes *asterisk* actions from AI replies");
    expect(rule.find).toBe("\\*[^*]+\\*");
    expect(rule.replace).toBe("");
    expect(rule.flags).toBe("g");
    expect(rule.enabled).toBe(true);
    expect(rule.sortOrder).toBe(0);
    expect(rule.minDepth).toBe(0);
    expect(rule.maxDepth).toBe(5);
    expect(rule.runOnEdit).toBe(true);
    expect(rule.trimStrings).toEqual(["  "]);
  });

  test("maps every RC placement to its canonical phase", () => {
    const body = rolecallRegexToCanonical(fixtureScript());
    expect(body.rules[0]!.phases).toEqual(["output", "display"]);
    expect(body.rules[1]!.phases).toEqual(["prompt", "lorebook", "reasoning", "input"]);
  });

  test("an unmapped placement string passes through verbatim (open union, forward-compat)", () => {
    const raw = fixtureScript();
    (raw.rules as Record<string, unknown>[])[1]!.placement = ["slash", "future_phase"];
    const body = rolecallRegexToCanonical(raw);
    expect(body.rules[1]!.phases).toEqual(["slash", "future_phase"]);
  });

  test("tolerant: garbage input never throws and yields an empty set", () => {
    expect(rolecallRegexToCanonical(null)).toEqual({ name: "", rules: [] });
    expect(rolecallRegexToCanonical(undefined)).toEqual({ name: "", rules: [] });
    expect(rolecallRegexToCanonical("not an object")).toEqual({ name: "", rules: [] });
    expect(rolecallRegexToCanonical({ rules: "not an array" })).toEqual({ name: "", rules: [] });
    expect(rolecallRegexToCanonical({ rules: [null, 42, "x"] }).rules).toHaveLength(3);
  });

  test("never carries a substituteFind value: subsystem A's wire has no such field", () => {
    const body = rolecallRegexToCanonical(fixtureScript());
    for (const rule of body.rules) {
      expect(rule.substituteFind).toBeUndefined();
    }
  });
});

describe("must #6: unknown fields land in extras and re-emit byte-equal", () => {
  test("an unknown rule-level key is preserved on RegexRule.extras", () => {
    const body = rolecallRegexToCanonical(fixtureScript());
    expect(body.rules[0]!.extras).toEqual({ custom_flag: true });
    expect(body.rules[1]!.extras).toBeUndefined();
  });

  test("round-trip: toCanonical then fromCanonical reproduces the original wire byte-equal", () => {
    const raw = fixtureScript();
    const body = rolecallRegexToCanonical(raw);
    const wire = canonicalToRolecallRegex(body, raw);
    expect(wire).toEqual(raw);
  });

  test("round-trip preserves the script id and script-level unknown keys via the raw scaffold", () => {
    const raw = fixtureScript();
    const body = rolecallRegexToCanonical(raw);
    const wire = canonicalToRolecallRegex(body, raw);
    expect(wire.id).toBe("script-1");
    expect(wire.workspace_note).toBe("kept for the operator, no first-class home");
  });

  test("a from-scratch canonical set (no raw) serializes clean defaults, no fabricated keys", () => {
    const body = rolecallRegexToCanonical(fixtureScript());
    const wire = canonicalToRolecallRegex(body);
    expect(wire.id).toBe("");
    expect(wire.workspace_note).toBeUndefined();
    expect((wire.rules as Record<string, unknown>[])[0]!.custom_flag).toBe(true);
  });

  test("real fixture round-trip: the whole file (multiple rules, mixed placements) is deep-equal", () => {
    const raw = fixtureScript();
    const wire = canonicalToRolecallRegex(rolecallRegexToCanonical(raw), raw);
    expect(wire).toEqual(raw);
  });
});
