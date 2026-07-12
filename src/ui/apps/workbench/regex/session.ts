/**
 * Pure regex-set editing session: one focused rule (the binder shows one rule per page), rule CRUD,
 * set-level fields, dirty/reconcile. Patterned on lore/session.ts (same shape, same op names); the
 * regex set is the lorebook's sibling entity, so the editing grammar is identical - one rule owns
 * the page, the TOC lists the rest.
 */
import type { RegexRule, RegexSetBody } from "../../../../entities/regex/schema";
import { newUiId } from "../../../_shared/new-id";
import { deepEq, reconcileAfterSave } from "../editor-core";

export interface RegexSession {
  body: RegexSetBody;
  /** the rule the page shows; always a member of body.rules (or null on an empty set) */
  focusedId: string | null;
}

/** A blank rule the "+ New rule" flow seeds: no pattern yet, on, running in the two common phases. */
export function emptyRegexRule(id: string): RegexRule {
  return {
    id,
    label: "",
    find: "",
    flags: "g",
    replace: "",
    phases: ["input", "output"],
    enabled: true,
    sortOrder: 0,
  };
}

const hasRule = (body: RegexSetBody, id: string): boolean => body.rules.some((r) => r.id === id);

/** Refocus onto a surviving rule when the focused one is gone. */
function refocus(body: RegexSetBody, focusedId: string | null): string | null {
  if (focusedId !== null && hasRule(body, focusedId)) return focusedId;
  return body.rules[0]?.id ?? null;
}

export function normalizeSession(body: RegexSetBody): RegexSession {
  const rules = Array.isArray(body.rules) ? body.rules : [];
  return {
    body: { ...body, rules: [...rules] },
    focusedId: rules[0]?.id ?? null,
  };
}

/** The rule the page is editing (drives the masthead, the cards, the try-it rail). */
export function focusedRule(session: RegexSession): RegexRule | null {
  if (!session.focusedId) return null;
  return session.body.rules.find((r) => r.id === session.focusedId) ?? null;
}

/** TOC row click / pager flip: the picked rule takes the page. */
export function selectRule(session: RegexSession, id: string): RegexSession {
  if (!hasRule(session.body, id)) return session;
  return { ...session, focusedId: id };
}

export function addRule(session: RegexSession): RegexSession {
  const id = newUiId("rule_");
  const rule = emptyRegexRule(id);
  rule.sortOrder = (session.body.rules.at(-1)?.sortOrder ?? 0) + 10;
  const rules = [...session.body.rules, rule];
  return selectRule({ ...session, body: { ...session.body, rules } }, id);
}

/** Append a pre-filled rule (a gallery recipe) at the end and focus it (R5, QOL 4). */
export function addRuleFrom(
  session: RegexSession,
  mint: (id: string, sortOrder: number) => RegexRule,
): RegexSession {
  const id = newUiId("rule_");
  const rule = mint(id, (session.body.rules.at(-1)?.sortOrder ?? 0) + 10);
  const rules = [...session.body.rules, rule];
  return selectRule({ ...session, body: { ...session.body, rules } }, id);
}

export function duplicateRule(session: RegexSession, id: string): RegexSession {
  const src = session.body.rules.find((r) => r.id === id);
  if (!src) return session;
  const copy: RegexRule = {
    ...structuredClone(src),
    id: newUiId("rule_"),
    label: src.label ? `${src.label} (copy)` : "",
    sortOrder: src.sortOrder + 1,
  };
  const idx = session.body.rules.findIndex((r) => r.id === id);
  const rules = [...session.body.rules];
  rules.splice(idx + 1, 0, copy);
  return selectRule({ ...session, body: { ...session.body, rules } }, copy.id);
}

export function deleteRule(session: RegexSession, id: string): RegexSession {
  const rules = session.body.rules.filter((r) => r.id !== id);
  const body = { ...session.body, rules };
  return { body, focusedId: refocus(body, session.focusedId) };
}

export function reorderRule(session: RegexSession, id: string, toIndex: number): RegexSession {
  const from = session.body.rules.findIndex((r) => r.id === id);
  if (from < 0) return session;
  const rules = [...session.body.rules];
  const [row] = rules.splice(from, 1);
  const clamped = Math.max(0, Math.min(toIndex, rules.length));
  rules.splice(clamped, 0, row!);
  return { ...session, body: { ...session.body, rules } };
}

export function updateRule(
  session: RegexSession,
  id: string,
  patch: Partial<RegexRule>,
): RegexSession {
  const rules = session.body.rules.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r));
  return { ...session, body: { ...session.body, rules } };
}

export function updateSet(
  session: RegexSession,
  patch: Partial<Pick<RegexSetBody, "name" | "description">>,
): RegexSession {
  return { ...session, body: { ...session.body, ...patch } };
}

export function sessionDirty(session: RegexSession, baseline: RegexSetBody): boolean {
  return !deepEq(session.body, baseline);
}

/** After save: adopt submitted body as baseline; keep live if a concurrent edit landed. */
export function reconcileRegexAfterSave(args: {
  live: RegexSetBody;
  submitted: RegexSetBody;
}): { current: RegexSetBody; dirty: boolean } {
  return reconcileAfterSave({ live: args.live, submitted: args.submitted });
}
