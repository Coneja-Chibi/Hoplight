/**
 * Recents ranking - pure logic for the Workbench's "bring one up" rail. Recency is the later of
 * two honest signals: when a piece was imported/last saved (its importedAt stamp) and when it was
 * last opened on the Workbench (a persisted per-piece timestamp). Currently-open pieces are
 * excluded (no point offering what is already a tab). No DOM; unit-tested directly.
 */
import type { StudioEntitySummary } from "../../app-contract";

const keyOf = (e: StudioEntitySummary): string => `${e.kind}:${e.id}`;

/** Later of importedAt (parsed) and the last-opened stamp; unparseable/absent reads as 0. */
function recencyOf(e: StudioEntitySummary, lastOpened: Record<string, number>): number {
  const importedMs = e.importedAt ? Date.parse(e.importedAt) : 0;
  const imported = Number.isFinite(importedMs) ? importedMs : 0;
  const opened = lastOpened[keyOf(e)] ?? 0;
  return Math.max(imported, opened);
}

/** Newest-first, open pieces removed, capped at `limit`. Stable input order breaks recency ties. */
export function rankRecents(
  entities: StudioEntitySummary[],
  lastOpened: Record<string, number>,
  openKeys: Set<string>,
  limit: number,
): StudioEntitySummary[] {
  return entities
    .filter((e) => !openKeys.has(keyOf(e)))
    .map((e, index) => ({ e, index, score: recencyOf(e, lastOpened) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map((x) => x.e);
}
