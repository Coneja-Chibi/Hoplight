/**
 * Library core - pure deck math for the shelves (deep browse lives in the Library, not the
 * Workbench). No DOM; unit-tested directly.
 */
import type { InspectResult, SaveBundleResult, StudioEntitySummary } from "../../app-contract";
import type { ReadFile } from "./import-triage";

/** Count entities per kind, preserving the given deck order; unknown kinds appended as found. */
export function deckCounts(entities: StudioEntitySummary[], kindOrder: string[]): { kind: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const kind of kindOrder) counts.set(kind, 0);
  for (const e of entities) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}

export type ImportBundlePayload = {
  entity: unknown;
  related?: { lorebooks?: unknown[]; regexSets?: unknown[] };
};

/**
 * Build a save-bundle payload from an inspect result. Returns null when the file failed or has no
 * primary entity. Pure: no IO.
 */
export function bundlePayloadFromInspect(result: InspectResult): ImportBundlePayload | null {
  if (!result.ok || result.entity === undefined || result.entity === null) return null;
  const lorebooks = result.related?.lorebooks;
  const regexSets = result.related?.regexSets;
  const related: { lorebooks?: unknown[]; regexSets?: unknown[] } = {};
  if (lorebooks && lorebooks.length > 0) related.lorebooks = lorebooks;
  if (regexSets && regexSets.length > 0) related.regexSets = regexSets;
  if (Object.keys(related).length > 0) return { entity: result.entity, related };
  return { entity: result.entity };
}

/**
 * Reorder checked rows so each archive drop's own lorebooks save BEFORE the characters/personas
 * that reference them (ISC-35). An archive row never carries `related` (M11's flat-rows design -
 * every entity is its own top-level row, unlike a single-file character bundle), so its dependency
 * has to already be on the shelf, under its REAL post-keep-both id, before the referencing row
 * posts. Non-archive rows (`archiveKey` unset) have no cross-references to worry about and keep
 * their original relative order, processed first.
 */
export function orderForCommit(picked: ReadFile[]): ReadFile[] {
  const standalone: ReadFile[] = [];
  const byArchive = new Map<string, ReadFile[]>();
  for (const r of picked) {
    if (!r.archiveKey) {
      standalone.push(r);
      continue;
    }
    const bucket = byArchive.get(r.archiveKey) ?? [];
    bucket.push(r);
    byArchive.set(r.archiveKey, bucket);
  }
  const isBook = (r: ReadFile): boolean => r.result.ok && r.result.kind === "lorebook";
  const ordered = [...standalone];
  for (const bucket of byArchive.values()) {
    ordered.push(...bucket.filter(isBook), ...bucket.filter((r) => !isBook(r)));
  }
  return ordered;
}

/**
 * Mirrors convert.ts's rewriteKnowledgeRefs (the server's own tool for a bundled character save)
 * for a client-side entity, generalized to persona bodies too: saveBundle's own idMap rewrite is
 * character-only (studio/bundle.ts casts `input.entity` to CanonicalCharacter before checking
 * kind), so a persona referencing an archive lorebook would never get rewritten through that path
 * no matter what it was bundled with. Not imported directly from convert.ts: that module pulls the
 * whole format-adapter registry into a browser bundle for a four-line pure function.
 *
 * An id with no entry in `idMap` is DROPPED, not left pointing at an id that will never exist on
 * the shelf - the same precedent as the archive importer's own resolveKnowledgeRef
 * (src/formats/lumiverse-archive/personas.ts): a reference that cannot resolve is worse than none.
 */
export function rewriteKnowledgeRefsFor(entity: unknown, idMap: ReadonlyMap<string, string>): unknown {
  const e = entity as { body?: { knowledgeRefs?: unknown } } | null;
  const refs = e?.body?.knowledgeRefs;
  if (!Array.isArray(refs) || refs.length === 0) return entity;
  const rewritten = refs
    .filter((r): r is string => typeof r === "string")
    .map((r) => idMap.get(r))
    .filter((r): r is string => r !== undefined);
  const nextBody: Record<string, unknown> = { ...e!.body };
  if (rewritten.length > 0) nextBody.knowledgeRefs = rewritten;
  else delete nextBody.knowledgeRefs;
  return { ...(entity as Record<string, unknown>), body: nextBody };
}

export interface CommitOutcome {
  shelved: number;
  errors: string[];
}

/**
 * Save every already-ordered (orderForCommit) row, one at a time, rewriting each archive-derived
 * dependent's knowledgeRefs against the REAL ids its own archive's lorebooks were just saved
 * under. `save` is injected rather than called directly (never `fetch`) so this whole sequence -
 * the actual thing import-flow.tsx's commitImport runs - is testable against a fake studio with
 * real keep-both collision behavior, not just its two pure pieces in isolation. commitImport is a
 * thin wrapper: order the picks, call this, render the result.
 *
 * The idMap resets whenever the archive changes; `picked` is already grouped contiguously by
 * archive, so a simple "did the key change" check is enough - two different uploads can mint the
 * same id and are never comparable.
 */
export async function commitOrderedRows(
  picked: readonly ReadFile[],
  save: (payload: ImportBundlePayload) => Promise<SaveBundleResult>,
  onProgress?: (done: number, total: number) => void,
): Promise<CommitOutcome> {
  const errors: string[] = [];
  let shelved = 0;
  let idMap = new Map<string, string>();
  let currentArchive: string | undefined;
  for (let i = 0; i < picked.length; i++) {
    const r = picked[i]!;
    onProgress?.(i, picked.length);
    if (r.archiveKey !== currentArchive) {
      idMap = new Map();
      currentArchive = r.archiveKey;
    }
    // A book has no knowledgeRefs to rewrite (no-op); a character/persona's refs to ids NOT yet in
    // idMap (unchecked, saved earlier and failed, or never in this drop) are DROPPED.
    const entity = r.archiveKey ? rewriteKnowledgeRefsFor(r.result.entity, idMap) : r.result.entity;
    const payload = bundlePayloadFromInspect({ ...r.result, entity });
    if (!payload) continue;
    try {
      const result = await save(payload);
      if (!result.ok) {
        errors.push(`${r.filename}: ${result.error ?? "could not save"}`);
        continue;
      }
      shelved++;
      if (r.archiveKey && r.result.kind === "lorebook" && result.primary) {
        const mintedId = (r.result.entity as { id?: unknown } | undefined)?.id;
        if (typeof mintedId === "string") idMap.set(mintedId, result.primary.id);
      }
    } catch (e) {
      errors.push(`${r.filename}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { shelved, errors };
}
