/**
 * Workbench core - the pure logic under the bench (the pack summary line). Deck math moved to the
 * Library with the browse room (2026-07-05); floatPlan died with the carousel view. No DOM.
 */
import type { StudioEntitySummary } from "../../app-contract";

/** "3 pieces · 3 kinds" - the bench header's real summary. */
export function packSummary(pieces: StudioEntitySummary[]): string {
  const kinds = new Set(pieces.map((p) => p.kind)).size;
  const pc = pieces.length === 1 ? "1 piece" : `${pieces.length} pieces`;
  const kc = kinds === 1 ? "1 kind" : `${kinds} kinds`;
  return `${pc} · ${kc}`;
}
