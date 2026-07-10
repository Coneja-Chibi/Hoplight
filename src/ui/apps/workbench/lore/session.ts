/**
 * Pure lorebook editing session: open entry panels (the desk shows up to two side by side),
 * focus, entry CRUD, book settings, dirty/reconcile.
 */
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import { emptyLoreEntry } from "../../../../core/lore";
import { newUiId } from "../../../_shared/new-id";
import { deepEq, reconcileAfterSave } from "../editor-core";

/** How many entry panels the desk shows at once (vs-lorebook-desk-f: two, side by side). */
export const MAX_OPEN_PANELS = 2;

export interface LoreSession {
  body: LorebookBody;
  /** entries whose panels are open, in pane order (left first); length 0..MAX_OPEN_PANELS */
  openIds: string[];
  /** the panel keyboard/summary focus rides on; always a member of openIds (or null when none) */
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

/** The entry the focused panel is editing (drives the sidebar quick controls + stagehand). */
export function focusedEntry(session: LoreSession): LorebookEntry | null {
  if (!session.focusedId) return null;
  return session.body.entries.find((e) => e.id === session.focusedId) ?? null;
}

/** The open panels' entries in pane order (missing ids are impossible by construction). */
export function openEntries(session: LoreSession): LorebookEntry[] {
  return session.openIds
    .map((id) => session.body.entries.find((e) => e.id === id))
    .filter((e): e is LorebookEntry => e !== undefined);
}

/** Sidebar row click: an already-open entry just takes focus; otherwise it REPLACES the focused
 * panel's entry (single-panel muscle memory - the second panel never opens by accident). */
export function selectEntry(session: LoreSession, id: string): LoreSession {
  if (!hasEntry(session.body, id)) return session;
  if (session.openIds.includes(id)) return { ...session, focusedId: id };
  if (session.openIds.length === 0) return { ...session, openIds: [id], focusedId: id };
  const at = session.focusedId !== null ? session.openIds.indexOf(session.focusedId) : 0;
  const openIds = [...session.openIds];
  openIds[at < 0 ? 0 : at] = id;
  return { ...session, openIds, focusedId: id };
}

/** The explicit second-panel move (the quick-controls "Open beside"): pushes a new panel while
 * room remains, else replaces the panel that does NOT hold focus. */
export function openEntryBeside(session: LoreSession, id: string): LoreSession {
  if (!hasEntry(session.body, id)) return session;
  if (session.openIds.includes(id)) return { ...session, focusedId: id };
  if (session.openIds.length < MAX_OPEN_PANELS) {
    return { ...session, openIds: [...session.openIds, id], focusedId: id };
  }
  const openIds = session.openIds.map((open) => (open === session.focusedId ? open : id));
  // all panels focused (single panel edge): replace the last slot
  if (!openIds.includes(id)) openIds[openIds.length - 1] = id;
  return { ...session, openIds, focusedId: id };
}

/** Close one panel; focus falls to the surviving panel. The entry itself is untouched. */
export function closeEntryPanel(session: LoreSession, id: string): LoreSession {
  if (!session.openIds.includes(id)) return session;
  const openIds = session.openIds.filter((open) => open !== id);
  const focusedId = session.focusedId === id ? openIds[0] ?? null : session.focusedId;
  return { ...session, openIds, focusedId };
}

export function focusEntryPanel(session: LoreSession, id: string): LoreSession {
  if (!session.openIds.includes(id) || session.focusedId === id) return session;
  return { ...session, focusedId: id };
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
