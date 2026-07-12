/**
 * bench-core tests: the word diff (whole-block removal + the ellipsis case from the wireframe), the
 * per-rule import effect, the fresh-id/sortOrder staging, and the plain-language skip reasons.
 */
import { describe, expect, it } from "bun:test";
import type { RegexRule } from "../../../../entities/regex/schema";
import {
  captureLane,
  diffTokens,
  perRuleEffect,
  skipReasonText,
  stageRules,
} from "./bench-core";

const rule = (over: Partial<RegexRule>): RegexRule => ({
  id: "r1",
  label: "Rule",
  find: "",
  flags: "g",
  replace: "",
  phases: ["output"],
  enabled: true,
  sortOrder: 0,
  ...over,
});

describe("diffTokens", () => {
  it("marks a wholly-removed block as del, the rest same", () => {
    const before = "[status] HP: 42/50 [/status] and rest";
    const after = " and rest";
    const tokens = diffTokens(before, after);
    const del = tokens.filter((t) => t.kind === "del").map((t) => t.text).join("");
    const same = tokens.filter((t) => t.kind === "same").map((t) => t.text).join("");
    expect(del).toContain("[status]");
    expect(del).toContain("[/status]");
    expect(same).toContain("rest");
    expect(tokens.some((t) => t.kind === "ins")).toBe(false);
  });

  it("shows a del + an ins for the ellipsis swap", () => {
    const tokens = diffTokens('"Well..." she said.', '"Well…" she said.');
    expect(tokens.some((t) => t.kind === "del" && t.text.includes("..."))).toBe(true);
    expect(tokens.some((t) => t.kind === "ins" && t.text.includes("…"))).toBe(true);
    expect(tokens.some((t) => t.kind === "same" && t.text.includes("she"))).toBe(true);
  });

  it("is all-same when nothing changed", () => {
    const tokens = diffTokens("no change here", "no change here");
    expect(tokens.every((t) => t.kind === "same")).toBe(true);
  });

  it("rejoins to the original text (before = same+del, after = same+ins)", () => {
    const before = "the quick brown fox";
    const after = "the slow brown fox";
    const tokens = diffTokens(before, after);
    const rebuiltBefore = tokens.filter((t) => t.kind !== "ins").map((t) => t.text).join("");
    const rebuiltAfter = tokens.filter((t) => t.kind !== "del").map((t) => t.text).join("");
    expect(rebuiltBefore).toBe(before);
    expect(rebuiltAfter).toBe(after);
  });
});

describe("perRuleEffect", () => {
  it("applies a matching rule and reports matched", () => {
    const e = perRuleEffect("foo baz", rule({ find: "foo", replace: "bar" }));
    expect(e.before).toBe("foo baz");
    expect(e.after).toBe("bar baz");
    expect(e.matched).toBe(true);
  });

  it("reports no change and matched false when the rule misses", () => {
    const e = perRuleEffect("nothing here", rule({ find: "zzz", replace: "!" }));
    expect(e.after).toBe("nothing here");
    expect(e.matched).toBe(false);
  });

  it("runs an off rule anyway (preview forces it on)", () => {
    const e = perRuleEffect("foo", rule({ find: "foo", replace: "bar", enabled: false }));
    expect(e.after).toBe("bar");
    expect(e.matched).toBe(true);
  });

  it("returns an error, never throws, on an invalid pattern", () => {
    const e = perRuleEffect("foo", rule({ find: "(", replace: "x" }));
    expect(e.error).toBeDefined();
    expect(e.matched).toBe(false);
    expect(e.after).toBe("foo");
  });
});

describe("stageRules", () => {
  it("gives fresh ids and strictly increasing sortOrder past the tail", () => {
    const existing = [rule({ id: "a", sortOrder: 20 })];
    const picked = [rule({ id: "x", label: "One" }), rule({ id: "y", label: "Two" })];
    const staged = stageRules(picked, existing);
    expect(staged).toHaveLength(2);
    expect(staged[0]!.id).not.toBe("x");
    expect(staged[1]!.id).not.toBe("y");
    expect(staged[0]!.id).not.toBe(staged[1]!.id);
    expect(staged[0]!.sortOrder).toBeGreaterThan(20);
    expect(staged[1]!.sortOrder).toBeGreaterThan(staged[0]!.sortOrder);
    expect(staged[0]!.label).toBe("One");
  });

  it("orders from zero when the set is empty", () => {
    const staged = stageRules([rule({ id: "x" })], []);
    expect(staged[0]!.sortOrder).toBe(10);
  });
});

describe("skipReasonText", () => {
  it("names the rule's phases and the current run for a phase skip", () => {
    const text = skipReasonText("phase", {
      rulePhases: ["prompt"],
      currentPhaseLabel: "Model output",
    });
    expect(text).toBe("runs on Prompt only, this is Model output");
  });

  it("has plain lines for off / condition / set-budget", () => {
    const ctx = { rulePhases: [], currentPhaseLabel: "Model output" };
    expect(skipReasonText("disabled", ctx)).toBe("rule is off");
    expect(skipReasonText("condition", ctx)).toContain("waits on");
    expect(skipReasonText("set-budget", ctx)).toContain("time budget");
  });
});

describe("captureLane", () => {
  it("cycles 1..4", () => {
    expect([0, 1, 2, 3, 4].map(captureLane)).toEqual([1, 2, 3, 4, 1]);
  });
});
