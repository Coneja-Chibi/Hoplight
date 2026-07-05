/**
 * Character editor core - the pure logic under the Workbench's writable pane. The BONES are
 * transcribed from RoleCall's CharacterEditorBento (field-order ids and reconcile, adjacent-swap
 * reorder, edits-vs-baseline dirty), re-homed onto the canonical character body. UI lives in
 * editor.ts; nothing here touches the DOM.
 *
 * Field-order ids are RC's verbatim, so a card that traveled RC -> Studios keeps its saved card
 * order and can round-trip. Ids we do not render yet (alternateGreetings, creators-note) are KEPT
 * in place, never dropped: reorder swaps skip over them so their saved positions survive a save.
 */

/** One editable card: an RC-interop order id bound to a canonical body path. */
export interface CardDef {
  /** RC field-order id, verbatim (cross-app order interop) */
  id: string;
  /** display label, also the inspector label it replaces */
  label: string;
  /** canonical body path */
  path: string[];
  /** render the value in the mono voice (chat-formatted fields) */
  mono?: boolean;
}

/** Every order id the format family knows (RC DEFAULT_FIELD_ORDER, verbatim). */
export const KNOWN_FIELD_ORDER: string[] = [
  "description",
  "personality",
  "scenario",
  "firstMes",
  "alternateGreetings",
  "mesExample",
  "creators-note",
];

/** The reorderable prose cards this slice renders (the rest of KNOWN_FIELD_ORDER comes in later slices). */
export const PROSE_CARDS: CardDef[] = [
  { id: "description", label: "description", path: ["identity", "description"] },
  { id: "personality", label: "personality", path: ["persona", "personality"] },
  { id: "scenario", label: "scenario", path: ["persona", "scenario"] },
  { id: "firstMes", label: "first message", path: ["greetings", "firstMessage"], mono: true },
  { id: "mesExample", label: "example messages", path: ["examples", "exampleMessages"], mono: true },
];

/** Identity-card inputs (fixed first card, not reorderable - RC's rule). */
export const IDENTITY_FIELDS: CardDef[] = [
  { id: "name", label: "name", path: ["identity", "name"] },
  { id: "tagline", label: "tagline", path: ["identity", "tagline"] },
  { id: "fullName", label: "full name", path: ["identity", "fullName"] },
  { id: "title", label: "title", path: ["identity", "title"] },
  { id: "age", label: "age", path: ["identity", "age"] },
  { id: "pronouns", label: "pronouns", path: ["identity", "pronouns"] },
];

/**
 * Saved order -> working order: keep saved ids that are still known (in their saved positions),
 * append known ids the save predates. Junk and unknown ids drop; null/absent reads as the default.
 */
export function reconcileOrder(saved: unknown): string[] {
  if (!Array.isArray(saved) || saved.length === 0) return [...KNOWN_FIELD_ORDER];
  const valid = saved.filter((f): f is string => typeof f === "string" && KNOWN_FIELD_ORDER.includes(f));
  const missing = KNOWN_FIELD_ORDER.filter((f) => !valid.includes(f));
  const merged = [...valid, ...missing];
  return merged.length ? merged : [...KNOWN_FIELD_ORDER];
}

/**
 * Swap `id` one step toward `dir` past the nearest RENDERED neighbour; unrendered ids between them
 * stay exactly where they are (their saved order survives even though no card shows them yet).
 * Returns the same array reference when the move is impossible (edge of the rendered list).
 */
export function moveCard(order: string[], id: string, dir: -1 | 1, rendered: ReadonlySet<string>): string[] {
  const at = order.indexOf(id);
  if (at < 0) return order;
  let j = at + dir;
  while (j >= 0 && j < order.length && !rendered.has(order[j]!)) j += dir;
  if (j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[at], next[j]] = [next[j]!, next[at]!];
  return next;
}

const rec = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

/** Read a string field off a body path; absent/non-string reads as "" (the editor's empty). */
export function getAtPath(body: unknown, path: string[]): string {
  let cur: unknown = body;
  for (const key of path) cur = rec(cur)[key];
  return typeof cur === "string" ? cur : "";
}

/**
 * Apply text edits onto a body, returning a NEW body: set non-empty values, DELETE keys edited to
 * empty (canonical stores absence, not ""). Every untouched field - escrow, behavior, media, all of
 * it - survives byte-identical; this is the no-data-loss property the tests pin down.
 */
export function applyEdits(body: unknown, edits: ReadonlyMap<string, string>, defs: CardDef[]): Record<string, unknown> {
  const out = structuredClone(rec(body));
  for (const def of defs) {
    const value = edits.get(def.id);
    if (value === undefined) continue; // never touched
    let host = out as Record<string, unknown>;
    for (const key of def.path.slice(0, -1)) {
      const next = rec(host[key]);
      host[key] = next;
      host = next;
    }
    const leaf = def.path[def.path.length - 1]!;
    if (value === "") delete host[leaf];
    else host[leaf] = value;
  }
  return out;
}

/** Any edit that differs from the baseline? ("" and absent are the same emptiness.) */
export function computeDirty(
  baseline: unknown,
  edits: ReadonlyMap<string, string>,
  defs: CardDef[],
  orderBaseline: string[],
  order: string[],
): boolean {
  if (JSON.stringify(order) !== JSON.stringify(orderBaseline)) return true;
  for (const def of defs) {
    const value = edits.get(def.id);
    if (value !== undefined && value !== getAtPath(baseline, def.path)) return true;
  }
  return false;
}
