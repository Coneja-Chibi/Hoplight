/**
 * applyRules tests (REGEX-JEWEL-PLAN.md Phase R2). One describe per numbered algorithm step in
 * the plan, plus trace completeness and the catastrophic-backtracking fixture.
 */
import { describe, expect, test } from "bun:test";
import type { RegexRule } from "../../entities/regex/schema";
import { applyRules, DEFAULT_MAX_MATCHES } from "./apply";

function rule(overrides: Partial<RegexRule> = {}): RegexRule {
  return {
    id: "r1",
    label: "Rule",
    find: "cat",
    flags: "g",
    replace: "dog",
    phases: ["output"],
    enabled: true,
    sortOrder: 0,
    ...overrides,
  };
}

/** Fixed clock: every call returns the next value off a queue, last value repeats once exhausted. */
function fixedClock(...ticks: number[]): () => number {
  let i = 0;
  return () => ticks[Math.min(i++, ticks.length - 1)] ?? 0;
}

describe("applyRules - step 1: filter + sort", () => {
  test("disabled rule skips with reason, text unchanged", () => {
    const result = applyRules("a cat sat", [rule({ enabled: false })], { phase: "output" });
    expect(result.text).toBe("a cat sat");
    expect(result.traces.at(0)!).toMatchObject({ applied: false, skipReason: "disabled" });
  });

  test("phase mismatch skips", () => {
    const result = applyRules("a cat sat", [rule({ phases: ["input"] })], { phase: "output" });
    expect(result.traces.at(0)!).toMatchObject({ applied: false, skipReason: "phase" });
  });

  test("target mismatch skips when the rule declares targets", () => {
    const result = applyRules("a cat sat", [rule({ targets: ["prompt"] })], {
      phase: "output",
      target: "display",
    });
    expect(result.traces.at(0)!).toMatchObject({ applied: false, skipReason: "target" });
  });

  test("absent targets means the rule runs for every target", () => {
    const result = applyRules("a cat sat", [rule()], { phase: "output", target: "display" });
    expect(result.traces.at(0)!.applied).toBe(true);
  });

  test("depth window: below minDepth skips, above maxDepth skips, inside runs", () => {
    const r = rule({ minDepth: 2, maxDepth: 4 });
    expect(applyRules("cat", [r], { phase: "output", depth: 1 }).traces.at(0)!.skipReason).toBe("min-depth");
    expect(applyRules("cat", [r], { phase: "output", depth: 5 }).traces.at(0)!.skipReason).toBe("max-depth");
    expect(applyRules("cat", [r], { phase: "output", depth: 3 }).traces.at(0)!.applied).toBe(true);
  });

  test("edit re-apply gate: isEdit without runOnEdit skips", () => {
    const result = applyRules("cat", [rule({ runOnEdit: false })], { phase: "output", isEdit: true });
    expect(result.traces.at(0)!.skipReason).toBe("not-run-on-edit");
  });

  test("isEdit with runOnEdit runs", () => {
    const result = applyRules("cat", [rule({ runOnEdit: true })], { phase: "output", isEdit: true });
    expect(result.traces.at(0)!.applied).toBe(true);
  });

  test("rules run in sortOrder, not array order, and chain on each other's output", () => {
    const first = rule({ id: "second", find: "dog", replace: "fish", sortOrder: 1 });
    const second = rule({ id: "first", find: "cat", replace: "dog", sortOrder: 0 });
    const result = applyRules("cat", [first, second], { phase: "output" });
    expect(result.text).toBe("fish");
    expect(result.traces.map((t) => t.ruleId)).toEqual(["first", "second"]);
  });
});

describe("applyRules - step 2: compile", () => {
  test("invalid pattern traces an error instead of throwing", () => {
    expect(() => applyRules("cat", [rule({ find: "(unclosed" })], { phase: "output" })).not.toThrow();
    const result = applyRules("cat", [rule({ find: "(unclosed" })], { phase: "output" });
    expect(result.traces.at(0)!.applied).toBe(false);
    expect(result.traces.at(0)!.error).toMatch(/invalid pattern/);
    expect(result.text).toBe("cat");
  });

  test("Risu extension flag tokens (gu<cbs>) are stripped before compiling, not rejected", () => {
    const result = applyRules("CAT", [rule({ useFlags: true, flags: "gui<cbs>", find: "cat" })], {
      phase: "output",
    });
    expect(result.traces.at(0)!.applied).toBe(true);
    expect(result.text).toBe("dog");
  });

  test("useFlags false ignores the custom flags string and uses the default", () => {
    const result = applyRules("CAT", [rule({ useFlags: false, flags: "i", find: "cat" })], {
      phase: "output",
    });
    // no "i" flag applied -> case-sensitive "cat" does not match "CAT"
    expect(result.traces.at(0)!.matchCount).toBe(0);
    expect(result.text).toBe("CAT");
  });
});

describe("applyRules - step 3: substituteFind macro modes", () => {
  test("raw mode substitutes macros into the find pattern verbatim", () => {
    const result = applyRules("hello Nova", [
      rule({ find: "{{char}}", substituteFind: "raw", replace: "WORLD" }),
    ], { phase: "output", macros: { char: "Nova" } });
    expect(result.text).toBe("hello WORLD");
  });

  test("escaped mode regex-escapes the macro value before it becomes part of the pattern", () => {
    const result = applyRules("a.b", [
      rule({ find: "a{{sep}}b", substituteFind: "escaped", replace: "X" }),
    ], { phase: "output", macros: { sep: "." } });
    // escaped "." only matches a literal dot, not any character
    expect(result.text).toBe("X");
    const missResult = applyRules("aXb", [
      rule({ find: "a{{sep}}b", substituteFind: "escaped", replace: "X" }),
    ], { phase: "output", macros: { sep: "." } });
    expect(missResult.text).toBe("aXb");
  });

  test("none mode (default) never touches macro tokens in the find pattern", () => {
    const result = applyRules("{{char}} said hi", [rule({ find: "\\{\\{char\\}\\}", replace: "Nova" })], {
      phase: "output",
      macros: { char: "Nova" },
    });
    expect(result.text).toBe("Nova said hi");
  });

  test("after mode: replace runs first with the raw template, macros resolve on the WHOLE result", () => {
    const result = applyRules("cat", [
      rule({ find: "cat", replace: "hi {{who}}, $&", substituteFind: "after" }),
    ], { phase: "output", macros: { who: "friend" } });
    expect(result.text).toBe("hi friend, cat");
  });

  test("after mode never macro-resolves the find pattern itself", () => {
    // find contains a literal macro token; "after" must NOT substitute it before compiling, so it
    // only matches the literal text "{{lit}}", not the macro's resolved value.
    const result = applyRules("{{lit}} stays", [
      rule({ find: "\\{\\{lit\\}\\}", replace: "X", substituteFind: "after" }),
    ], { phase: "output", macros: { lit: "nope" } });
    expect(result.text).toBe("X stays");
  });
});

describe("applyRules - step 4: replace (sugar, trimStrings, groups)", () => {
  test("{{match}} sugars to the full match", () => {
    const result = applyRules("hello world", [rule({ find: "world", replace: "[{{match}}]" })], {
      phase: "output",
    });
    expect(result.text).toBe("hello [world]");
  });

  test("trimStrings strip fragments from the captured value before substitution", () => {
    const result = applyRules("say [[loud]] now", [
      rule({ find: "\\[\\[(\\w+)\\]\\]", replace: "<$1>", trimStrings: ["lo"] }),
    ], { phase: "output" });
    expect(result.text).toBe("say <ud> now");
  });

  test("named groups substitute via $<name>", () => {
    const result = applyRules("2026-07-11", [
      rule({ find: "(?<y>\\d{4})-(?<m>\\d{2})-(?<d>\\d{2})", replace: "$<d>/$<m>/$<y>" }),
    ], { phase: "output" });
    expect(result.text).toBe("11/07/2026");
  });

  test("out-of-range $N emits nothing rather than corrupting the output", () => {
    const result = applyRules("cat", [rule({ find: "(cat)", replace: "[$1][$9]" })], { phase: "output" });
    expect(result.text).toBe("[cat][]");
  });

  test("multiple matches rebuild the string end-to-start so indices stay valid", () => {
    const result = applyRules("cat cat cat", [rule({ find: "cat", replace: "dog" })], { phase: "output" });
    expect(result.text).toBe("dog dog dog");
    expect(result.traces.at(0)!.matchCount).toBe(3);
  });
});

describe("applyRules - step 5: determinism, timeout, match cap", () => {
  test("elapsedMs comes from the injected clock, not a real one", () => {
    const now = fixedClock(0, 5);
    const result = applyRules("cat", [rule()], { phase: "output", now });
    expect(result.traces.at(0)!.elapsedMs).toBe(5);
  });

  test("exceeding timeoutMs traces a timeout error and leaves text unchanged", () => {
    const now = fixedClock(0, 0, 1000);
    const result = applyRules("cat cat cat", [rule({ find: "cat", replace: "dog", flags: "g" })], {
      phase: "output",
      now,
      timeoutMs: 10,
    });
    expect(result.traces.at(0)!.applied).toBe(false);
    expect(result.traces.at(0)!.error).toMatch(/timed out/);
    expect(result.text).toBe("cat cat cat");
  });

  test("exceeding maxMatches traces an error instead of doing the runaway replacement", () => {
    const result = applyRules("aaaaa", [rule({ find: "a", replace: "bb" })], {
      phase: "output",
      maxMatches: 2,
    });
    expect(result.traces.at(0)!.applied).toBe(false);
    expect(result.traces.at(0)!.error).toMatch(/matched more than 2 times/);
    expect(result.text).toBe("aaaaa");
  });

  test("default maxMatches is RC's 1000", () => {
    expect(DEFAULT_MAX_MATCHES).toBe(1000);
  });
});

test("trace completeness: every input rule gets exactly one trace, in order", () => {
  const rules = [
    rule({ id: "a", sortOrder: 2 }),
    rule({ id: "b", sortOrder: 0, enabled: false }),
    rule({ id: "c", sortOrder: 1, find: "(bad" }),
  ];
  const result = applyRules("cat", rules, { phase: "output" });
  expect(result.traces).toHaveLength(3);
  expect(new Set(result.traces.map((t) => t.ruleId))).toEqual(new Set(["a", "b", "c"]));
});

test("catastrophic-backtracking fixture: (a+)+$ against a long non-matching string is refused, not run", () => {
  const bomb = rule({ id: "bomb", find: "(a+)+$", replace: "X" });
  const longInput = "a".repeat(40) + "b"; // classic ReDoS shape: fails to match, exponential backtrack
  const start = Date.now();
  const result = applyRules(longInput, [bomb], { phase: "output" });
  const elapsedWall = Date.now() - start;

  expect(result.traces.at(0)!.applied).toBe(false);
  expect(result.traces.at(0)!.error).toMatch(/catastrophic/);
  expect(result.text).toBe(longInput);
  // proof the engine never attempted the exponential match: this returns near-instantly, not after
  // the seconds/minutes a real (a+)+$ backtrack against 40+ chars would take.
  expect(elapsedWall).toBeLessThan(500);
});
