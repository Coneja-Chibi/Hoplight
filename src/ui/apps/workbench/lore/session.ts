/**
 * Pure lorebook editing session: one focused entry (the binder shows one entry per screen),
 * entry CRUD, book settings, dirty/reconcile.
 */
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import {
  removeLorebookEntries,
  reorderLorebookEntry,
  setLorebookEntriesEnabled,
  updateLorebookEntry,
  updateLorebookSettings,
  type LorebookSettingsPatch,
} from "../../../../entities/lorebook/capabilities/operations";
import { emptyLoreEntry } from "../../../../core/lore";
import { newUiId } from "../../../_shared/new-id";
import { deepEq, reconcileAfterSave } from "../editor-core";

export interface LoreSession {
  body: LorebookBody;
  /** kept as a list for a future multi-panel view; the binder always holds exactly [focusedId] */
  openIds: string[];
  /** the entry the page shows; always a member of openIds (or null on an empty book) */
  focusedId: string | null;
  /**
   * Bounded undo ring for bulk ops + Fix All (deep-cloned bodies). Cap 20.
   * Not filled on every keystroke - only explicit pushUndo callers.
   */
  undoStack?: LorebookBody[];
}

const UNDO_CAP = 20;

/** Snapshot the current body onto the undo stack (call before bulk/Fix All). */
export function pushUndo(session: LoreSession): LoreSession {
  const stack = [...(session.undoStack ?? []), structuredClone(session.body)];
  while (stack.length > UNDO_CAP) stack.shift();
  return { ...session, undoStack: stack };
}

/** Pop last undo body; no-op if empty. Restores open focus onto surviving ids. */
export function undoSession(session: LoreSession): LoreSession {
  const stack = session.undoStack ?? [];
  if (stack.length === 0) return session;
  const prev = stack[stack.length - 1]!;
  const rest = stack.slice(0, -1);
  const open = pruneOpen(prev, session.openIds, session.focusedId);
  if (open.openIds.length === 0 && prev.entries[0]) {
    return {
      body: prev,
      openIds: [prev.entries[0].id],
      focusedId: prev.entries[0].id,
      undoStack: rest,
    };
  }
  return { body: prev, ...open, undoStack: rest };
}

export function canUndo(session: LoreSession): boolean {
  return (session.undoStack?.length ?? 0) > 0;
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
  const body = removeLorebookEntries(session.body, [id]);
  const entries = body.entries;
  const open = pruneOpen(body, session.openIds, session.focusedId);
  // a fully cleared desk reopens on the first remaining entry (never a blank stage with content)
  if (open.openIds.length === 0 && entries[0]) {
    return { body, openIds: [entries[0].id], focusedId: entries[0].id };
  }
  return { body, ...open };
}

export function reorderEntry(session: LoreSession, id: string, toIndex: number): LoreSession {
  const body = reorderLorebookEntry(session.body, id, toIndex);
  return body === session.body ? session : { ...session, body };
}

export function updateEntry(
  session: LoreSession,
  id: string,
  patch: Partial<LorebookEntry>,
): LoreSession {
  const body = updateLorebookEntry(session.body, id, patch);
  return body === session.body ? session : { ...session, body };
}

export function updateBook(
  session: LoreSession,
  patch: LorebookSettingsPatch,
): LoreSession {
  const body = updateLorebookSettings(session.body, patch);
  return body === session.body ? session : { ...session, body };
}

/** Bulk enable/disable. Empty selection = no-op. Pushes undo. */
export function setEntriesEnabled(
  session: LoreSession,
  ids: readonly string[],
  on: boolean,
): LoreSession {
  if (ids.length === 0) return session;
  const base = pushUndo(session);
  return {
    ...base,
    body: setLorebookEntriesEnabled(base.body, ids, on),
  };
}

/**
 * Bulk delete. Empty selection = no-op. If the focused entry is removed, focus moves to a
 * neighbor (same rule as deleteEntry). Pushes undo.
 */
export function deleteEntries(session: LoreSession, ids: readonly string[]): LoreSession {
  if (ids.length === 0) return session;
  const base = pushUndo(session);
  const body = removeLorebookEntries(base.body, ids);
  const entries = body.entries;
  const open = pruneOpen(body, base.openIds, base.focusedId);
  if (open.openIds.length === 0 && entries[0]) {
    return { ...base, body, openIds: [entries[0].id], focusedId: entries[0].id };
  }
  return { ...base, body, ...open };
}

/** Apply a pure book -> book transform (Health Fix All, import heal, etc.). Pushes undo. */
export function applyBookTransform(
  session: LoreSession,
  fn: (body: LorebookBody) => LorebookBody,
): LoreSession {
  const base = pushUndo(session);
  const body = fn(base.body);
  const open = pruneOpen(body, base.openIds, base.focusedId);
  if (open.openIds.length === 0 && body.entries[0]) {
    return { ...base, body, openIds: [body.entries[0].id], focusedId: body.entries[0].id };
  }
  return { ...base, body, ...open };
}

/** Append a primary keyword to an entry (Rehearsal "copy fired as key"). */
export function addKeywordToEntry(
  session: LoreSession,
  entryId: string,
  keyword: string,
): LoreSession {
  const kw = keyword.trim();
  if (!kw) return session;
  const entry = session.body.entries.find((e) => e.id === entryId);
  if (!entry) return session;
  if (entry.triggers.some((t) => t.keyword === kw && !t.isRegex)) return session;
  return updateEntry(session, entryId, {
    triggers: [...entry.triggers, { keyword: kw, isRegex: false }],
  });
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
