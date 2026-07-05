/**
 * Library core - pure deck math for the shelves (moved from the workbench when Chi re-homed the
 * browse room, 2026-07-05: deep-browse IS the Library). No DOM; unit-tested directly.
 */
import type { StudioEntitySummary } from "../../app-contract";

/** Count entities per kind, preserving the given deck order; unknown kinds appended as found. */
export function deckCounts(entities: StudioEntitySummary[], kindOrder: string[]): { kind: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const kind of kindOrder) counts.set(kind, 0);
  for (const e of entities) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}
