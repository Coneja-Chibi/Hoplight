/** Pure studio snapshot differ and bounded human-facing summary for stage watchers. */
import type { EntitySummary } from "../bridge";
import { truncateGraphemes } from "../_shared/graphemes";

export interface StudioChange {
  readonly added: readonly EntitySummary[];
  readonly removed: readonly EntitySummary[];
  readonly updated: readonly EntitySummary[];
  readonly after: readonly EntitySummary[];
}

const keyOf = (piece: EntitySummary): string => `${piece.kind}:${piece.id}`;

const fingerprint = (piece: EntitySummary): string =>
  JSON.stringify({
    name: piece.name,
    importedAt: piece.importedAt,
    hasPortrait: piece.hasPortrait,
    accent: piece.accent,
    sourceFormat: piece.sourceFormat,
    sourceVariant: piece.sourceVariant,
  });

export function diffStudio(
  before: readonly EntitySummary[],
  after: readonly EntitySummary[],
): StudioChange | null {
  const old = new Map(before.map((piece) => [keyOf(piece), piece]));
  const next = new Map(after.map((piece) => [keyOf(piece), piece]));
  const added = after.filter((piece) => !old.has(keyOf(piece)));
  const removed = before.filter((piece) => !next.has(keyOf(piece)));
  const updated = after.filter((piece) => {
    const prior = old.get(keyOf(piece));
    return prior !== undefined && fingerprint(prior) !== fingerprint(piece);
  });
  if (added.length + removed.length + updated.length === 0) return null;
  return { added, removed, updated, after: [...after] };
}

const displayName = (piece: EntitySummary): string =>
  truncateGraphemes(piece.name.replace(/\s+/g, " ").trim() || piece.id, 42);

export function watchSummary(change: StudioChange): string {
  if (change.added.length === 1 && change.removed.length === 0 && change.updated.length === 0) {
    const piece = change.added[0]!;
    return `new ${piece.kind} spotted · ${displayName(piece)} · ask me to compare it`;
  }
  if (change.updated.length === 1 && change.added.length === 0 && change.removed.length === 0) {
    return `${displayName(change.updated[0]!)} changed outside Kit · ask me to review it`;
  }
  if (change.removed.length === 1 && change.added.length === 0 && change.updated.length === 0) {
    return `${displayName(change.removed[0]!)} left the studio`;
  }
  const parts = [
    change.added.length > 0 ? `${change.added.length} added` : "",
    change.updated.length > 0 ? `${change.updated.length} changed` : "",
    change.removed.length > 0 ? `${change.removed.length} removed` : "",
  ].filter(Boolean);
  return `studio changed · ${parts.join(" · ")} · ask me to review the batch`;
}
