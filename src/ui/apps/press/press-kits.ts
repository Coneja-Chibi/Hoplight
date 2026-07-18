/**
 * Kit grouping for the Press queue (the locked vs-press-room-1 wire): a staged CHARACTER is a kit -
 * his linked lorebooks (body.knowledgeRefs) ride with him automatically, droppable per run. Staged
 * non-characters (and staged lorebooks nobody links) ride solo. Pure over summaries + fetched
 * bodies; the room owns fetching.
 */
import type { StudioEntitySummary } from "../../app-contract";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const pieceKeyOf = (p: { id: string; kind: string }): string => `${p.kind}:${p.id}`;

/** The linked lorebook ids on a fetched character entity (body.knowledgeRefs), tolerant. */
export function knowledgeRefsOf(entity: unknown): string[] {
  if (!isRec(entity) || !isRec(entity.body)) return [];
  const refs = entity.body.knowledgeRefs;
  return Array.isArray(refs) ? refs.filter((r): r is string => typeof r === "string") : [];
}

export interface PressKit {
  owner: StudioEntitySummary;
  /** linked lorebooks riding with the owner (resolved against the studio's summaries) */
  riders: StudioEntitySummary[];
}

export interface KitGrouping {
  kits: PressKit[];
  solos: StudioEntitySummary[];
}

/**
 * Group the staged queue into kits and solos. Riders resolve from the WHOLE studio's summaries (a
 * linked book rides even when it was never separately staged); a staged lorebook that already rides
 * some staged character's kit is not doubled as a solo. Queue order is preserved.
 */
export function groupKits(
  queue: readonly StudioEntitySummary[],
  allSummaries: readonly StudioEntitySummary[],
  refsByOwner: Readonly<Record<string, readonly string[]>>,
): KitGrouping {
  const kits: PressKit[] = [];
  const ridden = new Set<string>();

  for (const p of queue) {
    if (p.kind !== "character") continue;
    const refs = refsByOwner[pieceKeyOf(p)] ?? [];
    const riders = refs
      .map((id) => allSummaries.find((s) => s.kind === "lorebook" && s.id === id))
      .filter((s): s is StudioEntitySummary => s !== undefined);
    for (const r of riders) ridden.add(pieceKeyOf(r));
    kits.push({ owner: p, riders });
  }

  const solos = queue.filter((p) => p.kind !== "character" && !ridden.has(pieceKeyOf(p)));
  return { kits, solos };
}

/** Every piece a run prints, in order: kit owners with their (non-dropped) riders, then solos. */
export function runSet(
  grouping: KitGrouping,
  dropped: ReadonlySet<string>,
): StudioEntitySummary[] {
  const out: StudioEntitySummary[] = [];
  for (const kit of grouping.kits) {
    out.push(kit.owner);
    for (const r of kit.riders) if (!dropped.has(pieceKeyOf(r))) out.push(r);
  }
  for (const s of grouping.solos) out.push(s);
  return out;
}
