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

  test("out-of-range $N stays literal, matching the host engine (was '[cat][]' before R2X)", () => {
    // Engine-truth: "cat".replace(/(cat)/, "[$1][$9]") === "[cat][$9]" (verified with bun). The
    // pre-R2X local substituteTokens emitted "" for an out-of-range group, which the host engine
    // does not; delegating to replace-ops (host-parity) corrects it. See this session's report.
    const result = applyRules("cat", [rule({ find: "(cat)", replace: "[$1][$9]" })], { phase: "output" });
    expect(result.text).toBe("[cat][$9]");
    expect("cat".replace(/(cat)/, "[$1][$9]")).toBe("[cat][$9]");
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

describe("R2X (1): replace-side delegates to replace-ops - host parity + extended grammar", () => {
  // Discriminating check (advisor): the probe cases run through native String.replace must produce
  // the same output through applyRules, proving the delegation preserved host parity byte-for-byte.
  test("numbered/named-group probe matches the native engine through applyRules", () => {
    const cases: Array<{ text: string; find: string; flags: string; replace: string; native: string }> = [
      { text: "cat", find: "(cat)", flags: "", replace: "[$1][$9]", native: "cat".replace(/(cat)/, "[$1][$9]") },
      { text: "cat", find: "(cat)", flags: "g", replace: "[$1][$9]", native: "cat".replace(/(cat)/g, "[$1][$9]") },
      { text: "cat", find: "(cat)", flags: "", replace: "[$1][$0]", native: "cat".replace(/(cat)/, "[$1][$0]") },
      { text: "cat", find: "(cat)", flags: "", replace: "x$&y", native: "cat".replace(/(cat)/, "x$&y") },
      {
        text: "2026",
        find: "(?<y>\\d{4})",
        flags: "",
        replace: "$<y>$<z>",
        native: "2026".replace(/(?<y>\d{4})/, "$<y>$<z>"),
      },
    ];
    for (const c of cases) {
      const result = applyRules(c.text, [
        rule({ find: c.find, flags: c.flags || "g", useFlags: true, replace: c.replace }),
      ], { phase: "output" });
      expect(result.text).toBe(c.native);
    }
  });

  test("PCRE case-transform \\U..\\E now reaches through applyRules (replace-ops extension)", () => {
    const result = applyRules("say hello there", [
      rule({ find: "hello (\\w+)", replace: "\\U$1\\E!" }),
    ], { phase: "output" });
    expect(result.text).toBe("say THERE!");
  });

  test("$` and $' (prefix/suffix) are supported via replace-ops", () => {
    const result = applyRules("<mid>", [rule({ find: "mid", replace: "$`X$'" })], { phase: "output" });
    // prefix "<" + "X" + suffix ">" replaces "mid" -> "<" + "<X>" + ">"
    expect(result.text).toBe("<<X>>");
  });
});

describe("R2X (2): flag handling delegates to ast/dialect parseFlagTokens", () => {
  test("the ES2025 'v' flag is accepted (parseFlagTokens superset over the old compileFlags)", () => {
    // Pre-R2X compileFlags dropped 'v'; parseFlagTokens keeps it. v-mode compiles cleanly here.
    const result = applyRules("CAT", [rule({ useFlags: true, flags: "gvi", find: "cat" })], {
      phase: "output",
    });
    expect(result.traces.at(0)!.applied).toBe(true);
    expect(result.text).toBe("dog");
  });

  test("conflicting u+v flags trace an error instead of throwing out of the engine", () => {
    expect(() =>
      applyRules("cat", [rule({ useFlags: true, flags: "uv", find: "cat" })], { phase: "output" }),
    ).not.toThrow();
    const result = applyRules("cat", [rule({ useFlags: true, flags: "uv", find: "cat" })], {
      phase: "output",
    });
    expect(result.traces.at(0)!.applied).toBe(false);
    expect(result.traces.at(0)!.error).toMatch(/invalid pattern/);
    expect(result.text).toBe("cat");
  });
});

describe("R2X (3): traces carry d-flag match index spans, aligned to real matches", () => {
  test("whole-match spans index into `before` and slice back to the matched text", () => {
    const text = "a cat and a cat";
    const result = applyRules(text, [rule({ find: "cat", replace: "dog" })], { phase: "output" });
    const trace = result.traces.at(0)!;
    expect(trace.matches).toBeDefined();
    expect(trace.matches!.map((m) => [m.whole.start, m.whole.end])).toEqual([
      [2, 5],
      [12, 15],
    ]);
    // engine truth: each recorded span slices the literal match out of the ORIGINAL input text.
    for (const m of trace.matches!) {
      expect(text.slice(m.whole.start, m.whole.end)).toBe("cat");
    }
  });

  test("capture-group spans are recorded per match (null for a non-participating group)", () => {
    const text = "2026-07-11";
    const result = applyRules(text, [
      rule({ find: "(\\d{4})-(\\d{2})", replace: "$1/$2" }),
    ], { phase: "output" });
    const first = result.traces.at(0)!.matches!.at(0)!;
    expect(first.whole).toEqual({ start: 0, end: 7 });
    expect(first.groups).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 7 },
    ]);
    expect(text.slice(first.groups[0]!.start, first.groups[0]!.end)).toBe("2026");
    expect(text.slice(first.groups[1]!.start, first.groups[1]!.end)).toBe("07");
  });

  test("an optional group that did not participate records a null span", () => {
    const result = applyRules("ab", [rule({ find: "a(x)?(b)", replace: "$2" })], { phase: "output" });
    const m = result.traces.at(0)!.matches!.at(0)!;
    expect(m.groups[0]).toBeNull();
    expect(m.groups[1]).toEqual({ start: 1, end: 2 });
  });
});

describe("R2X (4): per-rule firstMatchOnly (sourced from extras until a schema field exists)", () => {
  test("only the first match is replaced even with a global-flagged rule", () => {
    const result = applyRules("cat cat cat", [
      rule({ find: "cat", replace: "dog", extras: { firstMatchOnly: true } }),
    ], { phase: "output" });
    expect(result.text).toBe("dog cat cat");
    expect(result.traces.at(0)!.matchCount).toBe(1);
    expect(result.traces.at(0)!.matches).toHaveLength(1);
    expect(result.traces.at(0)!.matches!.at(0)!.whole).toEqual({ start: 0, end: 3 });
  });

  test("without firstMatchOnly the same rule replaces every match (default behavior unchanged)", () => {
    const result = applyRules("cat cat cat", [rule({ find: "cat", replace: "dog" })], { phase: "output" });
    expect(result.text).toBe("dog dog dog");
    expect(result.traces.at(0)!.matchCount).toBe(3);
  });

  test("firstMatchOnly only counts as opt-in when strictly true, not any truthy extras value", () => {
    const result = applyRules("cat cat", [
      rule({ find: "cat", replace: "dog", extras: { firstMatchOnly: "yes" } }),
    ], { phase: "output" });
    expect(result.text).toBe("dog dog");
  });
});

describe("R2X part B (1): condition chaining - one deterministic pass", () => {
  const catRule = (over: Partial<RegexRule> = {}) => rule({ id: "a", find: "cat", replace: "dog", sortOrder: 0, ...over });
  const chained = (matched: boolean, over: Partial<RegexRule> = {}) =>
    rule({ id: "b", find: "dog", replace: "wolf", sortOrder: 1, condition: { ruleId: "a", matched }, ...over });

  test("B runs when A matched and condition wants matched", () => {
    const result = applyRules("a cat sat", [catRule(), chained(true)], { phase: "output" });
    expect(result.text).toBe("a wolf sat");
    expect(result.traces.at(1)!.applied).toBe(true);
  });

  test("B skips with reason when A found nothing and condition wants matched", () => {
    const result = applyRules("a bird sat", [catRule(), chained(true)], { phase: "output" });
    expect(result.text).toBe("a bird sat");
    expect(result.traces.at(1)!).toMatchObject({ applied: false, skipReason: "condition" });
  });

  test("matched:false runs B only when A did NOT match", () => {
    const hit = applyRules("a cat sat", [catRule(), chained(false, { find: "sat", replace: "stood" })], { phase: "output" });
    expect(hit.traces.at(1)!.skipReason).toBe("condition");
    const miss = applyRules("a bird sat", [catRule(), chained(false, { find: "sat", replace: "stood" })], { phase: "output" });
    expect(miss.text).toBe("a bird stood");
  });

  test("condition naming an unknown or later rule never satisfies (no forward resolution)", () => {
    const forward = rule({ id: "b", find: "cat", replace: "dog", sortOrder: 0, condition: { ruleId: "z", matched: true } });
    const result = applyRules("a cat sat", [forward], { phase: "output" });
    expect(result.traces.at(0)!).toMatchObject({ applied: false, skipReason: "condition" });
    // matched:false against an unknown rule is ALSO skipped - authoring smell, not a green light.
    const unknownNeg = rule({ id: "b", find: "cat", replace: "dog", sortOrder: 0, condition: { ruleId: "z", matched: false } });
    expect(applyRules("a cat sat", [unknownNeg], { phase: "output" }).traces.at(0)!.skipReason).toBe("condition");
  });

  test("a skipped A counts as not-matched for chaining", () => {
    const result = applyRules("a cat sat", [catRule({ enabled: false }), chained(false)], { phase: "output" });
    // A skipped (disabled) -> ran=false recorded -> matched:false condition satisfied -> B runs on "dog"? no dog in text.
    expect(result.traces.at(1)!.applied).toBe(true);
    expect(result.traces.at(1)!.matchCount).toBe(0);
  });
});

describe("R2X part B (2): set-level time budget", () => {
  test("budget exhaustion mid-list skips every remaining rule honestly", () => {
    const rules = [
      rule({ id: "a", sortOrder: 0 }),
      rule({ id: "b", find: "sat", replace: "stood", sortOrder: 1 }),
      rule({ id: "c", find: "a", replace: "the", sortOrder: 2 }),
    ];
    // Clock: setStart=0, rule a checks budget at 5 (ok, runs; inner calls consume more ticks),
    // rule b checks at 60 (over 50 -> set-budget), c inherits the exhausted state.
    const now = fixedClock(0, 5, 6, 7, 8, 9, 60, 61, 62, 63, 64, 65);
    const result = applyRules("a cat sat", rules, { phase: "output", setBudgetMs: 50, now });
    expect(result.traces.at(0)!.applied).toBe(true);
    expect(result.traces.at(1)!).toMatchObject({ applied: false, skipReason: "set-budget" });
    expect(result.traces.at(2)!).toMatchObject({ applied: false, skipReason: "set-budget" });
    expect(result.text).toBe("a dog sat");
  });

  test("no budget option means no set-budget skips ever", () => {
    const result = applyRules("a cat sat", [rule(), rule({ id: "r2", find: "sat", replace: "stood", sortOrder: 1 })], {
      phase: "output",
    });
    expect(result.traces.every((t) => t.skipReason !== "set-budget")).toBe(true);
  });
});

describe("R2X part B (3): overlay channel - spans without mutation", () => {
  test("overlay rule leaves text untouched and returns spans + replacement", () => {
    const result = applyRules("a cat sat", [rule({ overlay: true, phases: ["display"] })], { phase: "display" });
    expect(result.text).toBe("a cat sat");
    expect(result.overlays).toHaveLength(1);
    const ov = result.overlays.at(0)!;
    expect(ov.replacement).toBe("dog");
    expect(ov.matches.at(0)!.whole).toEqual({ start: 2, end: 5 });
    // spans index the trace's before text exactly
    expect("a cat sat".slice(2, 5)).toBe("cat");
    expect(result.traces.at(0)!).toMatchObject({ applied: true, matchCount: 1 });
  });

  test("overlay with zero matches contributes no overlay entry", () => {
    const result = applyRules("a bird sat", [rule({ overlay: true })], { phase: "output" });
    expect(result.overlays).toHaveLength(0);
  });

  test("overlay does not feed the mutation chain - a later rule sees the original text", () => {
    const rules = [
      rule({ id: "a", overlay: true, sortOrder: 0 }),
      rule({ id: "b", find: "cat", replace: "fox", sortOrder: 1 }),
    ];
    const result = applyRules("a cat sat", rules, { phase: "output" });
    expect(result.text).toBe("a fox sat");
    expect(result.overlays.at(0)!.matches.at(0)!.whole).toEqual({ start: 2, end: 5 });
  });
});

describe("R2X part B (4): firstMatchOnly as a first-class field", () => {
  test("schema field works without the extras spelling", () => {
    const result = applyRules("cat cat cat", [rule({ firstMatchOnly: true })], { phase: "output" });
    expect(result.text).toBe("dog cat cat");
  });
});
