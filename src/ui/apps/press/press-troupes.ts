/**
 * Troupe grouping for the Press queue (the locked vs-press-room-1 wire): a staged CHARACTER is a troupe -
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

export interface PressTroupe {
  owner: StudioEntitySummary;
  /** linked lorebooks riding with the owner (resolved against the studio's summaries) */
  riders: StudioEntitySummary[];
}

export interface TroupeGrouping {
  troupes: PressTroupe[];
  solos: StudioEntitySummary[];
}

/**
 * Group the staged queue into troupes and solos. Riders resolve from the WHOLE studio's summaries (a
 * linked book rides even when it was never separately staged); a staged lorebook that already rides
 * some staged character's troupe is not doubled as a solo. Queue order is preserved.
 */
export function groupTroupes(
  queue: readonly StudioEntitySummary[],
  allSummaries: readonly StudioEntitySummary[],
  refsByOwner: Readonly<Record<string, readonly string[]>>,
): TroupeGrouping {
  const troupes: PressTroupe[] = [];
  const ridden = new Set<string>();

  for (const p of queue) {
    if (p.kind !== "character") continue;
    const refs = refsByOwner[pieceKeyOf(p)] ?? [];
    const riders = refs
      .map((id) => allSummaries.find((s) => s.kind === "lorebook" && s.id === id))
      .filter((s): s is StudioEntitySummary => s !== undefined);
    for (const r of riders) ridden.add(pieceKeyOf(r));
    troupes.push({ owner: p, riders });
  }

  const solos = queue.filter((p) => p.kind !== "character" && !ridden.has(pieceKeyOf(p)));
  return { troupes, solos };
}

/** Every piece a run prints, in order: troupe owners with their (non-dropped) riders, then solos. */
export function runSet(
  grouping: TroupeGrouping,
  dropped: ReadonlySet<string>,
): StudioEntitySummary[] {
  const out: StudioEntitySummary[] = [];
  for (const troupe of grouping.troupes) {
    out.push(troupe.owner);
    for (const r of troupe.riders) if (!dropped.has(pieceKeyOf(r))) out.push(r);
  }
  for (const s of grouping.solos) out.push(s);
  return out;
}
