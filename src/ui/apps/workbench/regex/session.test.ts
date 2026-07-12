/**
 * Pure regex-set session ops + the computed doesLine. Mirrors lore/session.test.ts: exercise CRUD,
 * focus movement, dirty tracking, and the tolerant does-line assembly.
 */
import { describe, expect, it } from "bun:test";
import { buildFromPhrases } from "../../../../core/regex";
import type { RegexRule, RegexSetBody } from "../../../../entities/regex/schema";
import { doesLine } from "./does-line";
import {
  addRule,
  addRuleFrom,
  deleteRule,
  duplicateRule,
  emptyRegexRule,
  focusedRule,
  normalizeSession,
  reconcileRegexAfterSave,
  reorderRule,
  selectRule,
  sessionDirty,
  updateRule,
  updateSet,
} from "./session";

const rule = (id: string, over: Partial<RegexRule> = {}): RegexRule => ({
  ...emptyRegexRule(id),
  label: id,
  ...over,
});

const bodyOf = (...rules: RegexRule[]): RegexSetBody => ({ name: "Set", rules });

describe("normalizeSession", () => {
  it("focuses the first rule", () => {
    const s = normalizeSession(bodyOf(rule("a"), rule("b")));
    expect(s.focusedId).toBe("a");
    expect(focusedRule(s)?.id).toBe("a");
  });

  it("focuses null on an empty set", () => {
    const s = normalizeSession(bodyOf());
    expect(s.focusedId).toBeNull();
    expect(focusedRule(s)).toBeNull();
  });
});

describe("addRule", () => {
  it("appends a blank rule, focuses it, and steps sortOrder by 10", () => {
    const s0 = normalizeSession(bodyOf(rule("a", { sortOrder: 10 })));
    const s1 = addRule(s0);
    expect(s1.body.rules).toHaveLength(2);
    const added = s1.body.rules[1]!;
    expect(added.sortOrder).toBe(20);
    expect(added.find).toBe("");
    expect(added.enabled).toBe(true);
    expect(s1.focusedId).toBe(added.id);
  });
});

describe("duplicateRule", () => {
  it("inserts a labeled copy after the source with a fresh id and focuses it", () => {
    const s0 = normalizeSession(bodyOf(rule("a", { label: "One" }), rule("b")));
    const s1 = duplicateRule(s0, "a");
    expect(s1.body.rules.map((r) => r.label)).toEqual(["One", "One (copy)", "b"]);
    const copy = s1.body.rules[1]!;
    expect(copy.id).not.toBe("a");
    expect(s1.focusedId).toBe(copy.id);
  });

  it("no-ops on an unknown id", () => {
    const s0 = normalizeSession(bodyOf(rule("a")));
    expect(duplicateRule(s0, "zzz")).toBe(s0);
  });
});

describe("deleteRule", () => {
  it("removes the rule and refocuses onto a survivor", () => {
    const s0 = selectRule(normalizeSession(bodyOf(rule("a"), rule("b"), rule("c"))), "b");
    const s1 = deleteRule(s0, "b");
    expect(s1.body.rules.map((r) => r.id)).toEqual(["a", "c"]);
    expect(s1.focusedId).toBe("a");
  });

  it("clears focus when the last rule goes", () => {
    const s1 = deleteRule(normalizeSession(bodyOf(rule("a"))), "a");
    expect(s1.body.rules).toHaveLength(0);
    expect(s1.focusedId).toBeNull();
  });
});

describe("reorderRule", () => {
  it("moves a rule to a new index", () => {
    const s0 = normalizeSession(bodyOf(rule("a"), rule("b"), rule("c")));
    const s1 = reorderRule(s0, "c", 0);
    expect(s1.body.rules.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
});

describe("updateRule / updateSet", () => {
  it("patches a rule while preserving its id", () => {
    const s0 = normalizeSession(bodyOf(rule("a")));
    const s1 = updateRule(s0, "a", { id: "hacked", label: "New" } as Partial<RegexRule>);
    expect(s1.body.rules[0]!.id).toBe("a");
    expect(s1.body.rules[0]!.label).toBe("New");
  });

  it("patches set-level fields", () => {
    const s0 = normalizeSession(bodyOf(rule("a")));
    const s1 = updateSet(s0, { name: "Renamed", description: "d" });
    expect(s1.body.name).toBe("Renamed");
    expect(s1.body.description).toBe("d");
  });
});

describe("sessionDirty + reconcile", () => {
  it("is clean against a clone and dirty after an edit", () => {
    const body = bodyOf(rule("a"));
    const s0 = normalizeSession(structuredClone(body));
    expect(sessionDirty(s0, structuredClone(body))).toBe(false);
    const s1 = updateRule(s0, "a", { find: "x" });
    expect(sessionDirty(s1, structuredClone(body))).toBe(true);
  });

  it("adopts the submitted body as the new baseline with no concurrent edit", () => {
    const submitted = bodyOf(rule("a", { find: "x" }));
    const r = reconcileRegexAfterSave({ live: structuredClone(submitted), submitted });
    expect(r.dirty).toBe(false);
    expect(r.current).toEqual(submitted);
  });
});

describe("doesLine", () => {
  it("says so plainly when there is no pattern", () => {
    expect(doesLine(rule("a", { find: "" }))).toBe("no pattern yet - add one to start matching");
  });

  it("names the words for a words-builder pattern and the phases", () => {
    const built = buildFromPhrases(["dash", "sprinted"]);
    const line = doesLine(
      rule("a", { find: built.find, flags: built.flags, replace: "hurries", phases: ["input", "output"] }),
    );
    expect(line).toContain('"dash"');
    expect(line).toContain("as whole words");
    expect(line).toContain('swaps it for "hurries"');
    expect(line).toContain("the user's words and the model's reply");
  });

  it("reports removal and the off state", () => {
    const line = doesLine(rule("a", { find: "\\[x\\]", replace: "", enabled: false, phases: ["output"] }));
    expect(line.startsWith("off · ")).toBe(true);
    expect(line).toContain("removes it");
  });

  it("falls back to a plain clause for a pattern outside the words vocabulary", () => {
    const line = doesLine(rule("a", { find: "^\\[status\\][\\s\\S]*?$", replace: "" }));
    expect(line).toContain("atches its pattern");
  });
});

describe("addRuleFrom (gallery recipes, R5)", () => {
  it("appends the minted rule at the end and focuses it", () => {
    const s0 = normalizeSession({ name: "S", rules: [] });
    const s1 = addRule(s0);
    const s2 = addRuleFrom(s1, (id, sortOrder) => ({
      id,
      label: "Remove text in brackets",
      find: "\s?\[[^\]\n]*\]",
      flags: "g",
      replace: "",
      phases: ["output"],
      enabled: true,
      sortOrder,
    }));
    expect(s2.body.rules.length).toBe(2);
    const minted = s2.body.rules.at(-1)!;
    expect(s2.focusedId).toBe(minted.id);
    expect(minted.label).toBe("Remove text in brackets");
    expect(minted.sortOrder).toBeGreaterThan(s2.body.rules[0]!.sortOrder);
    expect(s1.body.rules.length).toBe(1); // input session untouched
  });
});
