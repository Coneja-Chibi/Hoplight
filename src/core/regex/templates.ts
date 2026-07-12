/**
 * Starter-recipe types + helpers (REGEX-JEWEL-PLAN.md R5, QOL 4). The DATA lives in
 * ./template-catalog.ts (one concept per file); this file owns the shape, the category order,
 * and the one conversion the gallery needs: template -> a fresh RegexRule for the open set.
 * Engine-truth contract: every catalog before/after pair is execution-verified in
 * template-catalog.test.ts - the gallery never shows an example the engine did not produce.
 */
import type { RegexPhase, RegexRule } from "../../entities/regex/schema";
import { TEMPLATE_CATALOG } from "./template-catalog";

/** One starter recipe: a whole rule plus the plain-language pitch and a proven example. */
export interface RegexTemplateEntry {
  id: string;
  category: RegexTemplateCategory;
  /** Card title, house voice ("Remove text in brackets"). */
  name: string;
  /** The one-line pitch under the title ("drops [anything like this] from the reply"). */
  does: string;
  find: string;
  flags: string;
  replace: string;
  phases: RegexPhase[];
  /** Example input - and the engine's OWN output for it (never hand-written). */
  before: string;
  after: string;
}

/** Gallery display order (the locked wire's grouping; guardrails is the wire's own category). */
export const TEMPLATE_CATEGORIES = [
  "cleanup",
  "guardrails",
  "formatting",
  "style",
  "compatibility",
  "roleplay",
] as const;

export type RegexTemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABELS: Record<RegexTemplateCategory, string> = {
  cleanup: "Cleanup",
  guardrails: "Guardrails",
  formatting: "Formatting",
  style: "Style",
  compatibility: "Compatibility",
  roleplay: "Roleplay",
};

/** The catalog grouped for the gallery, in display order; empty categories drop out. */
export function templatesByCategory(): Array<{
  category: RegexTemplateCategory;
  label: string;
  entries: RegexTemplateEntry[];
}> {
  return TEMPLATE_CATEGORIES.map((category) => ({
    category,
    label: TEMPLATE_CATEGORY_LABELS[category],
    entries: TEMPLATE_CATALOG.filter((t) => t.category === category),
  })).filter((g) => g.entries.length > 0);
}

/** A fresh rule from a template, ready to append to a set (caller supplies identity + order). */
export function templateToRule(entry: RegexTemplateEntry, id: string, sortOrder: number): RegexRule {
  return {
    id,
    label: entry.name,
    find: entry.find,
    flags: entry.flags,
    replace: entry.replace,
    phases: [...entry.phases],
    enabled: true,
    sortOrder,
  };
}
