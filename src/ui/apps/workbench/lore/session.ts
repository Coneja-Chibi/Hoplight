/**
 * Pure lorebook editing session: one focused entry (the binder shows one entry per screen),
 * entry CRUD, book settings, dirty/reconcile.
 */
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import { emptyLoreEntry } from "../../../../core/lore";
import { newUiId } from "../../../_shared/new-id";
import { deepEq, reconcileAfterSave } from "../editor-core";

export interface LoreSession {
  body: LorebookBody;
  /** kept as a list for a future multi-panel view; the binder always holds exactly [focusedId] */
  openIds: string[];
  /** the entry the page shows; always a member of openIds (or null on an empty book) */
  focusedId: string | null;
}

const hasEntry = (body: LorebookBody, id: string): boolean =>
  body.entries.some((e) => e.id === id);

/** Drop open ids whose entries no longer exist; refocus onto a surviving panel. */
function pruneOpen(body: LorebookBody, openIds: string[], focusedId: string | null): Pick<LoreSession, "openIds" | "focusedId"> {
  const kept = openIds.filter((id) => hasEntry(body, id));
  const focus = focusedId !== null && kept.includes(focusedId) ? focusedId : kept[0] ?? null;
  return { openIds: kept, focusedId: focus };
}

export function normalizeSession(body: LorebookBody): LoreSession {
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const first = entries[0]?.id;
  return {
    body: { ...body, entries: [...entries] },
    openIds: first ? [first] : [],
    focusedId: first ?? null,
  };
}

/** The entry the page is editing (drives the masthead, the cards, and the fine-print rail). */
export function focusedEntry(session: LoreSession): LorebookEntry | null {
  if (!session.focusedId) return null;
  return session.body.entries.find((e) => e.id === session.focusedId) ?? null;
}

/** TOC row click / pager flip: the picked entry takes the page. */
export function selectEntry(session: LoreSession, id: string): LoreSession {
  if (!hasEntry(session.body, id)) return session;
  return { ...session, openIds: [id], focusedId: id };
}

export function addEntry(session: LoreSession): LoreSession {
  const id = newUiId("entry_");
  const entry = emptyLoreEntry(id);
  entry.sortOrder = (session.body.entries.at(-1)?.sortOrder ?? 0) + 10;
  const entries = [...session.body.entries, entry];
  return selectEntry({ ...session, body: { ...session.body, entries } }, id);
}

export function duplicateEntry(session: LoreSession, id: string): LoreSession {
  const src = session.body.entries.find((e) => e.id === id);
  if (!src) return session;
  const copy: LorebookEntry = {
    ...structuredClone(src),
    id: newUiId("entry_"),
    title: src.title ? `${src.title} (copy)` : "",
  };
  const idx = session.body.entries.findIndex((e) => e.id === id);
  const entries = [...session.body.entries];
  entries.splice(idx + 1, 0, copy);
  return selectEntry({ ...session, body: { ...session.body, entries } }, copy.id);
}

export function deleteEntry(session: LoreSession, id: string): LoreSession {
  const entries = session.body.entries.filter((e) => e.id !== id);
  const body = { ...session.body, entries };
  const open = pruneOpen(body, session.openIds, session.focusedId);
  // a fully cleared desk reopens on the first remaining entry (never a blank stage with content)
  if (open.openIds.length === 0 && entries[0]) {
    return { body, openIds: [entries[0].id], focusedId: entries[0].id };
  }
  return { body, ...open };
}

export function reorderEntry(session: LoreSession, id: string, toIndex: number): LoreSession {
  const from = session.body.entries.findIndex((e) => e.id === id);
  if (from < 0) return session;
  const entries = [...session.body.entries];
  const [row] = entries.splice(from, 1);
  const clamped = Math.max(0, Math.min(toIndex, entries.length));
  entries.splice(clamped, 0, row!);
  return { ...session, body: { ...session.body, entries } };
}

export function updateEntry(
  session: LoreSession,
  id: string,
  patch: Partial<LorebookEntry>,
): LoreSession {
  const entries = session.body.entries.map((e) =>
    e.id === id ? { ...e, ...patch, id: e.id } : e,
  );
  return { ...session, body: { ...session.body, entries } };
}

export function updateBook(
  session: LoreSession,
  patch: Partial<Pick<LorebookBody, "name" | "description" | "tags" | "lorebookType" | "genre" | "fandom" | "globalCaseSensitive" | "globalMatchWholeWords" | "globalScanDepth" | "globalRecursion" | "tokenBudget" | "budgetMode" | "entryBudget">>,
): LoreSession {
  return {
    ...session,
    body: { ...session.body, ...patch },
  };
}

/** Bulk enable/disable. Empty selection = no-op. */
export function setEntriesEnabled(
  session: LoreSession,
  ids: readonly string[],
  on: boolean,
): LoreSession {
  if (ids.length === 0) return session;
  const want = new Set(ids);
  return {
    ...session,
    body: {
      ...session.body,
      entries: session.body.entries.map((e) =>
        want.has(e.id) ? { ...e, enabled: on } : e,
      ),
    },
  };
}

/**
 * Bulk delete. Empty selection = no-op. If the focused entry is removed, focus moves to a
 * neighbor (same rule as deleteEntry).
 */
export function deleteEntries(session: LoreSession, ids: readonly string[]): LoreSession {
  if (ids.length === 0) return session;
  const want = new Set(ids);
  const entries = session.body.entries.filter((e) => !want.has(e.id));
  const body = { ...session.body, entries };
  const open = pruneOpen(body, session.openIds, session.focusedId);
  if (open.openIds.length === 0 && entries[0]) {
    return { body, openIds: [entries[0].id], focusedId: entries[0].id };
  }
  return { body, ...open };
}

/** Apply a pure book -> book transform (Health Fix All, import heal, etc.). */
export function applyBookTransform(
  session: LoreSession,
  fn: (body: LorebookBody) => LorebookBody,
): LoreSession {
  const body = fn(session.body);
  const open = pruneOpen(body, session.openIds, session.focusedId);
  if (open.openIds.length === 0 && body.entries[0]) {
    return { body, openIds: [body.entries[0].id], focusedId: body.entries[0].id };
  }
  return { body, ...open };
}

/** Named intent: restore one field on one entry (Changes pane). */
export function revertField(
  session: LoreSession,
  entryId: string,
  field: keyof LorebookEntry,
  value: unknown,
): LoreSession {
  return updateEntry(session, entryId, { [field]: value } as Partial<LorebookEntry>);
}

/** Bring a removed entry back at the end (Changes pane). */
export function restoreEntry(session: LoreSession, entry: LorebookEntry): LoreSession {
  const id = session.body.entries.some((e) => e.id === entry.id)
    ? newUiId("entry_")
    : entry.id;
  const restored: LorebookEntry = { ...structuredClone(entry), id };
  const entries = [...session.body.entries, restored];
  return selectEntry({ ...session, body: { ...session.body, entries } }, restored.id);
}

export function sessionDirty(session: LoreSession, baseline: LorebookBody): boolean {
  return !deepEq(session.body, baseline);
}

/** After save: adopt submitted body as baseline; keep live if concurrent edit. */
export function reconcileLoreAfterSave(args: {
  live: LorebookBody;
  submitted: LorebookBody;
}): { current: LorebookBody; dirty: boolean } {
  return reconcileAfterSave({ live: args.live, submitted: args.submitted });
}
