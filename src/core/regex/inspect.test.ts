/**
 * Regex set linter tests (R4). The load-bearing part is the shadowing detector's honesty
 * contract: findings only on engine-proven never-fires, indeterminate anything = silence.
 */
import { describe, expect, test } from "bun:test";
import type { RegexRule, RegexSetBody } from "../../entities/regex/schema";
import { findingsForRule, inspectSet, slowRuleIds } from "./inspect";

let nextId = 0;
function rule(patch: Partial<RegexRule>): RegexRule {
  nextId += 1;
  return {
    id: `r${nextId}`,
    label: `Rule ${nextId}`,
    find: "alpha",
    flags: "g",
    replace: "beta",
    phases: ["output"],
    enabled: true,
    sortOrder: nextId,
    ...patch,
  };
}

const set = (...rules: RegexRule[]): RegexSetBody => ({ name: "Test set", rules });

const LOAD_PROOF = { timeoutMs: 5_000, setBudgetMs: 20_000 }; // deterministic under any machine load
const kinds = (body: RegexSetBody): string[] => inspectSet(body, LOAD_PROOF).map((f) => f.rule);

describe("cheap checks", () => {
  test("a healthy set has no findings", () => {
    expect(inspectSet(set(rule({}), rule({ find: "gamma", replace: "delta" })), LOAD_PROOF)).toEqual([]);
  });

  test("broken-pattern: a refused pattern is a problem and suppresses downstream checks", () => {
    const bomb = rule({ find: "(a+)+$", phases: [] }); // also phase-less: must NOT double-report
    const findings = inspectSet(set(bomb), LOAD_PROOF);
    expect(findings.map((f) => f.rule)).toEqual(["broken-pattern"]);
    expect(findings[0]?.severity).toBe("problem");
  });

  test("slow-pattern: heavy-but-legal patterns wear the chip", () => {
    const heavy = rule({ find: "(?=a)(?=b)(?=c)(?=d)x" }); // 4 lookarounds = complexity 20
    const findings = inspectSet(set(heavy), LOAD_PROOF);
    expect(findings.map((f) => f.rule)).toEqual(["slow-pattern"]);
    expect(findings[0]?.severity).toBe("worth-a-look");
    expect(slowRuleIds(findings)).toEqual([heavy.id]);
  });

  test("no-phase: an empty phases list never runs and says so", () => {
    const silent = rule({ phases: [] });
    const findings = inspectSet(set(silent), LOAD_PROOF);
    expect(findings.map((f) => f.rule)).toEqual(["no-phase"]);
    expect(findings[0]?.severity).toBe("problem");
  });

  test("never-matches: required text beyond a line edge, unless the m flag makes it legal", () => {
    expect(kinds(set(rule({ find: "a$b" })))).toEqual(["never-matches"]);
    expect(kinds(set(rule({ find: "a$b", flags: "gm" })))).toEqual([]);
    expect(kinds(set(rule({ find: "^ok$" })))).toEqual([]);
    expect(kinds(set(rule({ find: "(x$)+y" })))).toEqual(["never-matches"]);
  });

  test("duplicate-rule: later exact copy gets a safe disable fix; the original stays on", () => {
    const a = rule({ label: "Original" });
    const b = rule({ label: "Copy", find: a.find, flags: a.flags, replace: a.replace, phases: [...a.phases] });
    const body = set(a, b);
    const findings = inspectSet(body, LOAD_PROOF);
    expect(findings.map((f) => f.rule)).toEqual(["duplicate-rule"]);
    expect(findings[0]?.ruleId).toBe(b.id);
    expect(findings[0]?.relatedRuleId).toBe(a.id);
    const fixed = findings[0]!.fix!(body);
    expect(fixed.rules.find((r) => r.id === b.id)?.enabled).toBe(false);
    expect(fixed.rules.find((r) => r.id === a.id)?.enabled).toBe(true);
    expect(body.rules.find((r) => r.id === b.id)?.enabled).toBe(true); // input untouched
  });

  test("different replace text is NOT a duplicate", () => {
    const a = rule({});
    const b = rule({ find: a.find, replace: "different" });
    // b is engine-shadowed by a (same find, a rewrites it first) - but never a duplicate
    expect(kinds(set(a, b))).not.toContain("duplicate-rule");
  });

  test("disabled rules are left in peace", () => {
    const off = rule({ find: "(a+)+$", enabled: false, phases: [] });
    expect(inspectSet(set(off), LOAD_PROOF)).toEqual([]);
  });
});

describe("shadowing (engine-proven, QOL 10)", () => {
  test("a rule whose text an earlier rule rewrites never fires and is flagged", () => {
    const eater = rule({ label: "Eater", find: "status", replace: "S" });
    const starved = rule({ label: "Starved", find: "status", replace: "panel" });
    const findings = inspectSet(set(eater, starved), LOAD_PROOF);
    const shadow = findings.find((f) => f.rule === "shadowed");
    expect(shadow).toBeDefined();
    expect(shadow?.ruleId).toBe(starved.id);
    expect(shadow?.relatedRuleId).toBe(eater.id);
    expect(shadow?.severity).toBe("worth-a-look");
    expect(shadow?.fix).toBeUndefined(); // reordering is judgment - never auto-fixed
  });

  test("independent rules do not shadow each other", () => {
    const a = rule({ find: "alpha", replace: "A" });
    const b = rule({ find: "omega", replace: "O" });
    expect(kinds(set(a, b))).toEqual([]);
  });

  test("no shadowing across phases: an input-phase eater cannot starve an output rule", () => {
    const eater = rule({ find: "status", replace: "S", phases: ["input"] });
    const safe = rule({ find: "status", replace: "panel", phases: ["output"] });
    expect(kinds(set(eater, safe))).toEqual([]);
  });

  test("conditioned and overlay rules are gated on purpose, never flagged", () => {
    const eater = rule({ find: "status", replace: "S" });
    const gated = rule({ find: "status", replace: "x", condition: { ruleId: eater.id, matched: true } });
    const painted = rule({ find: "status", replace: "y", overlay: true });
    expect(kinds(set(eater, gated, painted))).toEqual([]);
  });

  test("a disabled earlier rule shadows nothing", () => {
    const eater = rule({ find: "status", replace: "S", enabled: false });
    const fine = rule({ find: "status", replace: "panel" });
    expect(kinds(set(eater, fine))).toEqual([]);
  });

  test("findingsForRule slices the card view for one rule", () => {
    const eater = rule({ find: "status", replace: "S" });
    const starved = rule({ find: "status", replace: "panel" });
    const findings = inspectSet(set(eater, starved), LOAD_PROOF);
    expect(findingsForRule(findings, starved.id).map((f) => f.rule)).toEqual(["shadowed"]);
    expect(findingsForRule(findings, eater.id)).toEqual([]);
  });
});
