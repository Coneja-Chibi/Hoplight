/**
 * Bundle grouping for the Press queue (the locked vs-press-room-1 wire): a staged piece with LINKS
 * is a bundle - its linked pieces ride with it automatically, droppable per run. A character's
 * lorebooks (body.knowledgeRefs) ride him; a preset's regex sets (body.behaviorRefs) and
 * quick-reply sets (body.quickReplyRefs) ride it, which is what the preset schema has promised
 * since behaviorRefs landed ("export decides whether to embed, and reports a set that could not
 * ride rather than dropping it") - the Press simply never read the field, so a preset's regex left
 * the building alone and the zip looked "stripped". Staged pieces nobody links ride solo. Pure
 * over summaries + fetched bodies; the room owns fetching.
 */
import type { StudioEntitySummary } from "../../app-contract";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const pieceKeyOf = (p: { id: string; kind: string }): string => `${p.kind}:${p.id}`;

/** A link to a rider: which kind it is, and which id. Refs of different kinds must not collide. */
export interface RiderRef {
  kind: string;
  id: string;
}

const stringRefs = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((r): r is string => typeof r === "string") : [];

/** The linked lorebook ids on a fetched character entity (body.knowledgeRefs), tolerant. */
export function knowledgeRefsOf(entity: unknown): string[] {
  if (!isRec(entity) || !isRec(entity.body)) return [];
  return stringRefs(entity.body.knowledgeRefs);
}

/**
 * Every rider a fetched OWNER entity links, kind included. The owner's kind decides which fields
 * are read: characters link lorebooks; presets link regex and quick-reply sets. Anything else
 * links nothing (today), and an unknown shape links nothing rather than guessing.
 */
export function riderRefsOf(owner: { kind: string }, entity: unknown): RiderRef[] {
  if (!isRec(entity) || !isRec(entity.body)) return [];
  if (owner.kind === "character") {
    return stringRefs(entity.body.knowledgeRefs).map((id) => ({ kind: "lorebook", id }));
  }
  if (owner.kind === "preset") {
    return [
      ...stringRefs(entity.body.behaviorRefs).map((id) => ({ kind: "regex", id })),
      ...stringRefs(entity.body.quickReplyRefs).map((id) => ({ kind: "quickreply", id })),
    ];
  }
  return [];
}

export interface PressBundle {
  owner: StudioEntitySummary;
  /** linked lorebooks riding with the owner (resolved against the studio's summaries) */
  riders: StudioEntitySummary[];
}

export interface BundleGrouping {
  bundles: PressBundle[];
  solos: StudioEntitySummary[];
}

/** The kinds that can OWN a bundle; everything else is only ever a solo or a rider. */
const OWNER_KINDS = new Set(["character", "preset"]);

/**
 * Group the staged queue into bundles and solos. Riders resolve from the WHOLE studio's summaries (a
 * linked piece rides even when it was never separately staged); a staged piece that already rides
 * some staged owner's bundle is not doubled as a solo. Queue order is preserved.
 */
export function groupBundles(
  queue: readonly StudioEntitySummary[],
  allSummaries: readonly StudioEntitySummary[],
  refsByOwner: Readonly<Record<string, readonly RiderRef[]>>,
): BundleGrouping {
  const bundles: PressBundle[] = [];
  const ridden = new Set<string>();

  for (const p of queue) {
    if (!OWNER_KINDS.has(p.kind)) continue;
    const refs = refsByOwner[pieceKeyOf(p)] ?? [];
    const riders = refs
      .map((ref) => allSummaries.find((s) => s.kind === ref.kind && s.id === ref.id))
      .filter((s): s is StudioEntitySummary => s !== undefined);
    for (const r of riders) ridden.add(pieceKeyOf(r));
    bundles.push({ owner: p, riders });
  }

  const solos = queue.filter((p) => !OWNER_KINDS.has(p.kind) && !ridden.has(pieceKeyOf(p)));
  return { bundles, solos };
}

/** Every piece a run prints, in order: bundle owners with their (non-dropped) riders, then solos. */
export function runSet(
  grouping: BundleGrouping,
  dropped: ReadonlySet<string>,
): StudioEntitySummary[] {
  const out: StudioEntitySummary[] = [];
  for (const bundle of grouping.bundles) {
    out.push(bundle.owner);
    for (const r of bundle.riders) if (!dropped.has(pieceKeyOf(r))) out.push(r);
  }
  for (const s of grouping.solos) out.push(s);
  return out;
}

/** What a finished run hands the browser: the one file bare, or a zip when there are several. */
export type RunPackaging =
  | { kind: "single"; filename: string; bytes: Uint8Array }
  | { kind: "zip"; files: Record<string, Uint8Array> };

/**
 * ONE PIECE IN, ONE FILE OUT. A run that printed exactly one file downloads that file under its own
 * name - a person exporting one preset was handed a zip with one thing in it, which reads as
 * ceremony and costs an unzip on the other end. The zip earns its place only when there is a
 * bundle to hold together.
 */
export function packageRun(files: Readonly<Record<string, Uint8Array>>): RunPackaging | null {
  const names = Object.keys(files);
  if (names.length === 0) return null;
  if (names.length === 1) {
    const name = names[0]!;
    return { kind: "single", filename: name, bytes: files[name]! };
  }
  return { kind: "zip", files: { ...files } };
}
