/**
 * Persist open/closed state for lore entry dossier folds (page cards + When & where bands).
 * Missing keys default to open. Fail-closed on bad stored blobs.
 */

export type FoldPrefs = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

/** Page-level cards + When & where instrument bands share one prefs blob. */
export const ENTRY_FOLD_PREF = "lorebook.entryFolds";

export type EntryFoldId =
  | "keys"
  | "whenWhere"
  | "passage"
  | "creatorNote"
  | "ww.nums"
  | "ww.rhythm"
  | "ww.group"
  | "ww.rec"
  | "ww.chance"
  | "ww.place";

/** Defaults: main work surfaces open; creator note starts closed (matches prior bfold). */
const DEFAULT_OPEN: Readonly<Record<EntryFoldId, boolean>> = {
  keys: true,
  whenWhere: true,
  passage: true,
  creatorNote: false,
  "ww.nums": true,
  "ww.rhythm": true,
  "ww.group": true,
  "ww.rec": true,
  "ww.chance": true,
  "ww.place": true,
};

export type FoldMap = Readonly<Record<string, boolean>>;

export function loadEntryFolds(prefs: FoldPrefs): FoldMap {
  const raw = prefs.get(ENTRY_FOLD_PREF);
  const out: Record<string, boolean> = { ...DEFAULT_OPEN };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Unknown ids (e.g. platform.* cards) default open. */
export function foldIsOpen(map: FoldMap, id: string): boolean {
  return map[id] !== false;
}

export function withFold(
  map: FoldMap,
  id: string,
  open: boolean,
): Record<string, boolean> {
  return { ...map, [id]: open };
}

export function saveEntryFolds(prefs: FoldPrefs, map: FoldMap): void {
  prefs.set(ENTRY_FOLD_PREF, { ...map });
}
