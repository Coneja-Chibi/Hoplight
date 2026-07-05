/**
 * Workbench core - the pure logic under the bench room (deck grouping, the floated deck's
 * perspective plan, the pack summary line). No DOM: unit-tested directly; index.ts renders it.
 */
import type { StudioEntitySummary } from "../../app-contract";

/** Count entities per kind, preserving the given deck order; unknown kinds appended as found. */
export function deckCounts(entities: StudioEntitySummary[], kindOrder: string[]): { kind: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const kind of kindOrder) counts.set(kind, 0);
  for (const e of entities) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}

/** The floated deck's perspective plan (locked look: center card forward, wings tilt away).
 * Returns per-index { tilt (deg), rise (px) } mirroring the artifact's -16..16 / 0..10 spread. */
export function floatPlan(count: number): { tilt: number; rise: number }[] {
  if (count <= 0) return [];
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => {
    const off = mid === 0 ? 0 : (i - mid) / mid; // -1..1
    return { tilt: Math.round(-16 * off) || 0, rise: Math.round(10 * Math.abs(off)) }; // || 0 kills -0
  });
}

/** "3 pieces · 3 kinds" - the bench header's real summary. */
export function packSummary(pieces: StudioEntitySummary[]): string {
  const kinds = new Set(pieces.map((p) => p.kind)).size;
  const pc = pieces.length === 1 ? "1 piece" : `${pieces.length} pieces`;
  const kc = kinds === 1 ? "1 kind" : `${kinds} kinds`;
  return `${pc} · ${kc}`;
}
