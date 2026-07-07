/**
 * Proves the DATA-format triggerscript interpreter against real cherry-like rules: seeded rolls make
 * numeric effects deterministic, a macro-built threshold condition gates firing, and the input vars are
 * never mutated. Also unit-tests the CBS macro resolver and the from-scratch calc:: evaluator directly.
 */
import { describe, expect, test } from "bun:test";
import type { TriggerScript } from "../../entities/character/schema";
import { resolveCbs, runDataTriggers, safeCalc, type TriggerVars } from "./run-data-trigger";

const zero = () => 0; // roll::N -> 1, random -> first arg

describe("resolveCbs", () => {
  test("getvar reads a variable, unknown var is empty", () => {
    expect(resolveCbs("{{getvar::dep}}", { dep: "42" })).toBe("42");
    expect(resolveCbs("{{getvar::nope}}", {})).toBe("");
  });

  test("setvar mutates vars and expands to empty string", () => {
    const vars: TriggerVars = {};
    expect(resolveCbs("{{setvar::mood::happy}}", vars)).toBe("");
    expect(vars.mood).toBe("happy");
  });

  test("innermost-first: setvar then getvar in one string, left to right", () => {
    const vars: TriggerVars = {};
    expect(resolveCbs("{{setvar::x::7}}{{getvar::x}}", vars)).toBe("7");
    expect(vars.x).toBe("7");
  });

  test("nested macros resolve inside-out", () => {
    expect(resolveCbs("{{getvar::{{getvar::key}}}}", { key: "dep", dep: "9" })).toBe("9");
  });

  test("roll uses the injected rng (deterministic)", () => {
    expect(resolveCbs("{{roll::100}}", {}, { rng: zero })).toBe("1");
    expect(resolveCbs("{{roll::100}}", {}, { rng: () => 0.5 })).toBe("51");
  });

  test("random picks by injected rng", () => {
    expect(resolveCbs("{{random::a::b::c}}", {}, { rng: zero })).toBe("a");
    expect(resolveCbs("{{random::a::b::c}}", {}, { rng: () => 0.9 })).toBe("c");
  });

  test("comparison macros return 1 or empty", () => {
    expect(resolveCbs("{{greater_equal::10::10}}", {})).toBe("1");
    expect(resolveCbs("{{greater_equal::9::10}}", {})).toBe("");
    expect(resolveCbs("{{greater::11::10}}", {})).toBe("1");
    expect(resolveCbs("{{less::1::2}}", {})).toBe("1");
    expect(resolveCbs("{{less_equal::3::2}}", {})).toBe("");
    expect(resolveCbs("{{equal::hi::hi}}", {})).toBe("1");
    expect(resolveCbs("{{equal::hi::ho}}", {})).toBe("");
  });

  test("calc does math with no eval", () => {
    expect(resolveCbs("{{calc::2 + 3}}", {})).toBe("5");
    expect(resolveCbs("{{calc::{{getvar::dep}} + 5}}", { dep: "100" })).toBe("105");
  });

  test("char and user are injectable, default to placeholders", () => {
    expect(resolveCbs("{{char}} loves {{user}}", {})).toBe("char loves user");
    expect(resolveCbs("{{char}} loves {{user}}", {}, { char: "Cherry", user: "you" })).toBe(
      "Cherry loves you",
    );
  });

  test("unknown macros are left literally, never guessed", () => {
    expect(resolveCbs("{{mystery::1}}", {})).toBe("{{mystery::1}}");
    expect(resolveCbs("keep {{weird::{{getvar::x}}}} here", { x: "5" })).toBe("keep {{weird::5}} here");
  });
});

describe("safeCalc", () => {
  test("precedence and associativity", () => {
    expect(safeCalc("2 + 3 * 4")).toBe("14");
    expect(safeCalc("20 - 5 - 5")).toBe("10");
    expect(safeCalc("10 / 4")).toBe("2.5");
  });

  test("parentheses and unary minus", () => {
    expect(safeCalc("(2 + 3) * 4")).toBe("20");
    expect(safeCalc("-3 + 5")).toBe("2");
  });

  test("bad input and divide-by-zero fall back to the literal", () => {
    expect(safeCalc("2 +")).toBe("2 +");
    expect(safeCalc("drop table")).toBe("drop table");
    expect(safeCalc("5 / 0")).toBe("5 / 0");
    expect(safeCalc("2 ** 3")).toBe("2 ** 3");
  });
});

// -- cherry-like rules --

const workingRule: TriggerScript = {
  label: "clingy escalation",
  event: "output",
  conditions: [{ type: "var", var: "status", operator: "=", value: "Working" }],
  effects: [
    { type: "setvar", var: "dep", operator: "+=", value: "10" },
    { type: "setvar", var: "dep", operator: "+=", value: "{{roll::100}}" },
  ],
};

const thresholdRule: TriggerScript = {
  label: "she is gone",
  event: "output",
  conditions: [
    { type: "value", var: "^{{greater_equal::{{getvar::dep}}::10000}}", operator: "=", value: "^1" },
  ],
  effects: [
    { type: "command", value: "/echo she is gone" },
    { type: "impersonate", role: "char", value: "missed {{user}}'s love" },
  ],
};

describe("runDataTriggers", () => {
  test("matching condition fires and applies effects with a seeded rng", () => {
    const result = runDataTriggers(
      [workingRule],
      { status: "Working", dep: "5000" },
      "output",
      { rng: zero },
    );
    expect(result.fired).toEqual(["clingy escalation"]);
    expect(result.vars.dep).toBe("5011"); // 5000 + 10 + roll(=1)
  });

  test("macro-built threshold fires only past 10000", () => {
    const below = runDataTriggers([thresholdRule], { dep: "9999" }, "output");
    expect(below.fired).toEqual([]);
    expect(below.log).toEqual([]);

    const at = runDataTriggers([thresholdRule], { dep: "10000" }, "output", { user: "you" });
    expect(at.fired).toEqual(["she is gone"]);
    expect(at.log).toEqual(["command: /echo she is gone", "impersonate(char): missed you's love"]);
  });

  test("an unmatched event fires nothing", () => {
    const result = runDataTriggers([workingRule, thresholdRule], { status: "Working" }, "input");
    expect(result.fired).toEqual([]);
    expect(result.log).toEqual([]);
  });

  test("a failed condition does not fire", () => {
    const result = runDataTriggers([workingRule], { status: "Resting", dep: "0" }, "output");
    expect(result.fired).toEqual([]);
    expect(result.vars.dep).toBe("0");
  });

  test("the input vars object is never mutated", () => {
    const input: TriggerVars = { status: "Working", dep: "5000" };
    const result = runDataTriggers([workingRule], input, "output", { rng: zero });
    expect(input.dep).toBe("5000"); // untouched
    expect(result.vars.dep).toBe("5011"); // new object carries the change
    expect(result.vars).not.toBe(input);
  });

  test("unknown effect types are noted, never thrown", () => {
    const rule: TriggerScript = {
      label: "sealed",
      event: "output",
      conditions: [],
      effects: [{ type: "runlua", code: "print('hi')" }],
    };
    const result = runDataTriggers([rule], {}, "output");
    expect(result.fired).toEqual(["sealed"]);
    expect(result.log).toEqual(["unsupported effect skipped: runlua"]);
  });

  test("equality is a string compare, not numeric (matches the reference simulator)", () => {
    // "=" / "!=" are string ops, so differently-formatted numbers are NOT equal. This is a
    // deliberate choice: card `=` checks are status-string or macro "1"/"" results, and numeric
    // equality would surprise-match "1e3" to "1000".
    const rule: TriggerScript = {
      label: "exact",
      event: "output",
      conditions: [{ type: "var", var: "code", operator: "=", value: "7" }],
      effects: [{ type: "setvar", var: "hit", operator: "=", value: "yes" }],
    };
    expect(runDataTriggers([rule], { code: "7" }, "output").fired).toEqual(["exact"]);
    expect(runDataTriggers([rule], { code: "7.0" }, "output").fired).toEqual([]);
    expect(runDataTriggers([rule], { code: "07" }, "output").fired).toEqual([]);
  });

  test("ordering operators compare numerically when both sides parse", () => {
    const rule: TriggerScript = {
      label: "gte",
      event: "output",
      conditions: [{ type: "var", var: "dep", operator: ">=", value: "100" }],
      effects: [],
    };
    expect(runDataTriggers([rule], { dep: "9" }, "output").fired).toEqual([]); // "9" < "100" numerically
    expect(runDataTriggers([rule], { dep: "100" }, "output").fired).toEqual(["gte"]);
  });

  test("triggers cascade: a later rule sees an earlier rule's variable change", () => {
    const bump: TriggerScript = {
      label: "bump",
      event: "output",
      conditions: [],
      effects: [{ type: "setvar", var: "dep", operator: "+=", value: "5000" }],
    };
    const gate: TriggerScript = {
      label: "gate",
      event: "output",
      conditions: [{ type: "var", var: "dep", operator: ">=", value: "10000" }],
      effects: [{ type: "command", value: "/echo tipped over" }],
    };
    const result = runDataTriggers([bump, gate], { dep: "6000" }, "output");
    expect(result.fired).toEqual(["bump", "gate"]); // gate fires only because bump ran first
    expect(result.vars.dep).toBe("11000");
    expect(result.log).toEqual(["command: /echo tipped over"]);
  });

  test("multiplication and division setvar operators", () => {
    const rule: TriggerScript = {
      label: "scale",
      event: "output",
      conditions: [],
      effects: [
        { type: "setvar", var: "n", operator: "*=", value: "3" },
        { type: "setvar", var: "n", operator: "/=", value: "2" },
      ],
    };
    const result = runDataTriggers([rule], { n: "10" }, "output");
    expect(result.vars.n).toBe("15"); // 10 * 3 / 2
  });
});
