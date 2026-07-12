/**
 * The catalog's engine-truth contract (R5): every recipe validates, every before/after pair is
 * reproduced by the REAL engine byte-for-byte, every example actually exercises its rule, and the
 * bookkeeping (unique ids, known categories, carried phases) holds. A recipe that cannot prove
 * its own example does not belong on the shelf.
 */
import { describe, expect, test } from "bun:test";
import { applyRules } from "./apply";
import { validateRule } from "./validate";
import { REGEX_ALL_PHASES } from "./platform-fields";
import { TEMPLATE_CATALOG } from "./template-catalog";
import { TEMPLATE_CATEGORIES, templatesByCategory, templateToRule } from "./templates";

describe("template catalog engine truth", () => {
  test("ids are unique and categories are known", () => {
    const ids = TEMPLATE_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATE_CATALOG) {
      expect(TEMPLATE_CATEGORIES).toContain(t.category);
      expect(t.phases.length).toBeGreaterThan(0);
      for (const p of t.phases) expect(REGEX_ALL_PHASES).toContain(p);
    }
  });

  for (const t of TEMPLATE_CATALOG) {
    test(`${t.id}: validates, and the engine reproduces its example`, () => {
      const rule = templateToRule(t, "probe", 0);
      const v = validateRule(rule);
      expect(v.ok).toBe(true);
      // Run in the rule's own first phase so the trace is not a phase skip.
      const phase = rule.phases[0]!;
      const run = applyRules(t.before, [{ ...rule, phases: [phase] }], {
        phase,
        timeoutMs: 5_000,
      });
      expect(run.traces[0]?.error).toBeUndefined();
      expect(run.text).toBe(t.after);
      expect(run.text).not.toBe(t.before); // the example must exercise the rule
    });
  }

  test("templatesByCategory groups in display order with no empty groups", () => {
    const groups = templatesByCategory();
    expect(groups.length).toBeGreaterThan(0);
    const order = groups.map((g) => g.category);
    expect([...order].sort((a, b) => TEMPLATE_CATEGORIES.indexOf(a) - TEMPLATE_CATEGORIES.indexOf(b))).toEqual(order);
    for (const g of groups) expect(g.entries.length).toBeGreaterThan(0);
  });

  test("templateToRule mints an enabled rule with caller identity", () => {
    const t = TEMPLATE_CATALOG[0]!;
    const r = templateToRule(t, "fresh-id", 7);
    expect(r.id).toBe("fresh-id");
    expect(r.sortOrder).toBe(7);
    expect(r.enabled).toBe(true);
    expect(r.label).toBe(t.name);
    expect(r.phases).toEqual(t.phases);
    expect(r.phases).not.toBe(t.phases); // defensive copy, catalog stays immutable
  });
});
