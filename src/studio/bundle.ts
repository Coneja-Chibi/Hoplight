/**
 * Studio bundle save orchestration: persist related lorebooks first, rewrite keep-both IDs on the
 * character, then save the primary. Partial failure is reported explicitly; already-written related
 * entities are retained (data-preserving orphans). No format logic - adapters live in convert.ts.
 */
import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import type { CanonicalRegexSet } from "../entities/regex/schema";
import type { CanonicalEntity } from "../core/canonical";
import { rewriteKnowledgeRefs } from "../convert";
import type { EntitySummary } from "./store";
import type { StudioStoreLike } from "./contracts";
import { StudioValidationError } from "./errors";

type AnyEntity = CanonicalEntity<string, unknown>;

export interface BundleSaveInput {
  entity: AnyEntity;
  lorebooks?: CanonicalLorebook[];
  /** Regex sets bundled with a preset import (ST/RC exports); saved beside the primary. */
  regexSets?: CanonicalRegexSet[];
  /** When true, primary and related overwrite by id (editor path). Import uses keep-both. */
  overwrite?: boolean;
}

export interface BundleSaveResult {
  ok: boolean;
  primary?: EntitySummary;
  related: EntitySummary[];
  /** Actual knowledgeRefs after keep-both rewrites. */
  knowledgeRefs?: string[];
  /** True when some related writes succeeded and a later write failed. */
  partial?: boolean;
  error?: string;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Preflight: reject before any write when the payload is not a savable character bundle. */
export function preflightBundle(input: BundleSaveInput): void {
  const e = input.entity;
  if (!e || typeof e !== "object") throw new StudioValidationError("bundle: missing entity");
  if (typeof e.kind !== "string" || !e.kind) {
    throw new StudioValidationError("bundle: entity kind required");
  }
  if (typeof e.id !== "string" || !e.id) {
    throw new StudioValidationError("bundle: entity id required");
  }
  if (e.body === null || typeof e.body !== "object" || Array.isArray(e.body)) {
    throw new StudioValidationError("bundle: entity body required");
  }
  const books = input.lorebooks ?? [];
  for (const lb of books) {
    if (!lb || typeof lb !== "object") throw new StudioValidationError("bundle: invalid lorebook");
    if (lb.kind !== "lorebook") {
      throw new StudioValidationError(`bundle: related entity kind must be lorebook, got ${String(lb.kind)}`);
    }
    if (typeof lb.id !== "string" || !lb.id) {
      throw new StudioValidationError("bundle: lorebook id required");
    }
    if (lb.body === null || typeof lb.body !== "object" || Array.isArray(lb.body)) {
      throw new StudioValidationError("bundle: lorebook body required");
    }
  }
  for (const rs of input.regexSets ?? []) {
    if (!rs || typeof rs !== "object") throw new StudioValidationError("bundle: invalid regex set");
    if (rs.kind !== "regex") {
      throw new StudioValidationError(`bundle: related entity kind must be regex, got ${String(rs.kind)}`);
    }
    if (typeof rs.id !== "string" || !rs.id) {
      throw new StudioValidationError("bundle: regex set id required");
    }
    if (rs.body === null || typeof rs.body !== "object" || Array.isArray(rs.body)) {
      throw new StudioValidationError("bundle: regex set body required");
    }
  }
}

/**
 * Persist a character plus related lorebooks. Lorebooks first; keep-both renames rewrite
 * knowledgeRefs before the character write.
 */
export async function saveBundle(
  store: StudioStoreLike,
  input: BundleSaveInput,
): Promise<BundleSaveResult> {
  preflightBundle(input);
  const overwrite = input.overwrite === true;
  const books = input.lorebooks ?? [];
  const related: EntitySummary[] = [];
  const idMap = new Map<string, string>();

  for (const lb of books) {
    const requestedId = lb.id;
    try {
      const summary = await store.save(lb as AnyEntity, { overwrite });
      related.push(summary);
      if (summary.id !== requestedId) idMap.set(requestedId, summary.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        partial: related.length > 0,
        related,
        error: `bundle: failed saving lorebook "${requestedId}": ${message}`,
      };
    }
  }

  // Regex sets bundled with a preset: keep-both saves, no ref rewriting (presets do not link them).
  for (const rs of input.regexSets ?? []) {
    try {
      related.push(await store.save(rs as AnyEntity, { overwrite }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        partial: related.length > 0,
        related,
        error: `bundle: failed saving regex set "${rs.id}": ${message}`,
      };
    }
  }

  // Clone character shallowly so we can rewrite refs without mutating the caller's object unexpectedly
  // beyond the knowledgeRefs field they expect to be authoritative post-save.
  const character = input.entity as CanonicalCharacter;
  if (character.kind === "character" && idMap.size > 0) {
    rewriteKnowledgeRefs(character, idMap);
  }

  try {
    const primary = await store.save(character as AnyEntity, { overwrite });
    const knowledgeRefs =
      character.kind === "character" && isRec(character.body) && Array.isArray(character.body.knowledgeRefs)
        ? (character.body.knowledgeRefs as string[])
        : undefined;
    return { ok: true, primary, related, knowledgeRefs };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      partial: related.length > 0,
      related,
      error: `bundle: failed saving primary "${character.id}": ${message}`,
    };
  }
}
