/**
 * Library core - pure deck math for the shelves (deep browse lives in the Library, not the
 * Workbench). No DOM; unit-tested directly.
 */
import type { InspectResult, StudioEntitySummary } from "../../app-contract";

/** Count entities per kind, preserving the given deck order; unknown kinds appended as found. */
export function deckCounts(entities: StudioEntitySummary[], kindOrder: string[]): { kind: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const kind of kindOrder) counts.set(kind, 0);
  for (const e of entities) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}

export type ImportBundlePayload = {
  entity: unknown;
  related?: { lorebooks?: unknown[] };
};

/**
 * Build a save-bundle payload from an inspect result. Returns null when the file failed or has no
 * primary entity. Pure: no IO.
 */
export function bundlePayloadFromInspect(result: InspectResult): ImportBundlePayload | null {
  if (!result.ok || result.entity === undefined || result.entity === null) return null;
  const lorebooks = result.related?.lorebooks;
  if (lorebooks && lorebooks.length > 0) {
    return { entity: result.entity, related: { lorebooks } };
  }
  return { entity: result.entity };
}
