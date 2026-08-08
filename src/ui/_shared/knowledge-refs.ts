/**
 * Rewrite an entity's knowledgeRefs against a minted-id-to-real-id map - the ONE implementation,
 * shared by the import sheet's commit loop (deck-core.ts) and the server's staged-row commit
 * (server-staging.ts), so the two can never drift. Mirrors convert.ts's rewriteKnowledgeRefs (the
 * server's tool for a bundled character save) but generalized to any body carrying knowledgeRefs
 * (personas too): saveBundle's own idMap rewrite is character-only, so a persona referencing an
 * archive lorebook would never get rewritten through that path no matter what it was bundled
 * with. Not imported from convert.ts: that module pulls the whole format-adapter registry into a
 * browser bundle for a four-line pure function.
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
