/**
 * Shell store pure helpers - the Workbench recents map's parse + merge (functional core for
 * shell/store.ts). No DOM, no fetch, no zustand: unit-tested directly.
 */

// Piece identity moved to _shared/piece-key so apps can use it without touching shell modules;
// re-exported here so shell consumers keep one import site.
export { keyOf, paneKey, paneKeyOf } from "../_shared/piece-key";

/** Fail-closed reader: only "key" -> finite-number pairs survive an untrusted persisted blob. */
export function parseRecents(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** The two visible pane keys: `activeKey` is the primary (left) pane, `splitKey` the piece pinned
 * beside it ("" = no split). Invariant everywhere: splitKey !== activeKey. */
export interface PaneKeys {
  activeKey: string;
  splitKey: string;
}

/** Focusing a piece keeps both panes visible: focusing the split piece swaps the panes instead of
 * collapsing to a doubled view (the invariant would break); focusing anything else lands it in the
 * primary pane and leaves the split pinned. */
export function focusKeys(cur: PaneKeys, focused: string): PaneKeys {
  if (focused === cur.activeKey) return cur;
  if (focused === cur.splitKey) return { activeKey: cur.splitKey, splitKey: cur.activeKey };
  return { activeKey: focused, splitKey: cur.splitKey };
}

/** Closing a piece: the split slot empties when its piece closes; a closed primary promotes the
 * split piece into the primary pane; otherwise `fallback` (first remaining piece, "" when none)
 * takes the primary. */
export function removeKeys(cur: PaneKeys, removed: string, fallback: string): PaneKeys {
  if (removed === cur.splitKey) return { activeKey: cur.activeKey, splitKey: "" };
  if (removed !== cur.activeKey) return cur;
  if (cur.splitKey) return { activeKey: cur.splitKey, splitKey: "" };
  return { activeKey: fallback, splitKey: "" };
}

/** Pinning a piece beside the primary: pinning the primary itself is a no-op (a piece cannot sit
 * beside itself); with no primary yet the piece becomes the primary instead of a lone split. */
export function besideKeys(cur: PaneKeys, pinned: string): PaneKeys {
  if (!cur.activeKey) return { activeKey: pinned, splitKey: "" };
  if (pinned === cur.activeKey) return cur;
  return { activeKey: cur.activeKey, splitKey: pinned };
}

/** Stamp the given keys as opened at `now`, pruned to the newest `cap` entries (bounded map). */
export function bumpRecents(
  existing: Record<string, number>,
  keys: string[],
  now: number,
  cap: number,
): Record<string, number> {
  const merged = { ...existing };
  for (const k of keys) merged[k] = now;
  const kept = Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap);
  return Object.fromEntries(kept);
}

/** A minimal piece identity for press-queue ops (the queue stores full summaries; ops key on these). */
export interface PieceRef {
  id: string;
  kind: string;
}

/** Merge a staged batch into the press queue, deduped by kind:id, existing order preserved. */
export function stagePressBatch<T extends PieceRef>(queue: readonly T[], batch: readonly T[]): T[] {
  const have = new Set(queue.map((p) => `${p.kind}:${p.id}`));
  const fresh = batch.filter((p) => {
    const k = `${p.kind}:${p.id}`;
    if (have.has(k)) return false;
    have.add(k);
    return true;
  });
  return fresh.length === 0 ? [...queue] : [...queue, ...fresh];
}

/** Drop one piece from the press queue. */
export function unstagePressPiece<T extends PieceRef>(queue: readonly T[], id: string, kind: string): T[] {
  return queue.filter((p) => !(p.id === id && p.kind === kind));
}
