/**
 * Studio bundle save orchestration: persist related lorebooks first, rewrite keep-both IDs on the
 * character, then save the primary. Partial failure is reported explicitly; already-written related
 * entities are retained (data-preserving orphans). No format logic - adapters live in convert.ts.
 */
import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import type { CanonicalRegexSet } from "../entities/regex/schema";
import type { CanonicalEntity } from "../core/canonical";
import {
  safeParseCanonicalEntity,
  type ParsedCanonicalEntity,
} from "../entities/runtime-schema";
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

function requireEntity(raw: unknown, label: string): ParsedCanonicalEntity {
  const parsed = safeParseCanonicalEntity(raw);
  if (!parsed.ok) {
    throw new StudioValidationError(`bundle: invalid ${label}: ${parsed.issues[0] ?? "unknown error"}`);
  }
  return parsed.entity;
}

/** Reject an invalid batch before its first write. */
export function preflightBundle(input: BundleSaveInput): void {
  requireEntity(input.entity, "primary entity");
  for (const raw of input.lorebooks ?? []) {
    const lorebook = requireEntity(raw, "lorebook");
    if (lorebook.kind !== "lorebook") {
      throw new StudioValidationError(`bundle: related entity kind must be lorebook, got ${lorebook.kind}`);
    }
  }
  for (const raw of input.regexSets ?? []) {
    const regex = requireEntity(raw, "regex set");
    if (regex.kind !== "regex") {
      throw new StudioValidationError(`bundle: related entity kind must be regex, got ${regex.kind}`);
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
