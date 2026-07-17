/**
 * The bundle/link layer that sits above the single-entity adapters: a card is not just a character,
 * it may bundle an embedded lorebook. Converting one end to end means reading the character, pulling
 * any embedded character_book out as a linked canonical Lorebook (knowledgeRefs), then writing the
 * target - re-embedding that lorebook into the target format's own book slot.
 *
 * This is where "extract at the boundary" (import) meets "inline at the boundary" (export): the
 * extraction is format-agnostic (any CCv2/v3 card), the re-embed is the target adapter's job via the
 * EmitContext it receives. Lives here, at the app layer that already wires adapters together, never
 * in the inward-pointing core. Studio inspect/export must compose the same service as the CLI.
 */
import type {
  AdapterInput,
  AdapterOutput,
  CharacterAdapter,
  FormatAdapter,
} from "./core";
import { primaryOriginalRaw } from "./core";
import type { CanonicalCharacter } from "./entities/character/schema";
import type { CanonicalLorebook } from "./entities/lorebook/schema";

import { extractCharacterBook } from "./formats/_shared/character-book";

export interface ConvertResult {
  out: AdapterOutput;
  /** lorebooks extracted from the source card and linked to the character (0 or 1 for now) */
  lorebooks: CanonicalLorebook[];
}

/** Primary character + related lorebooks produced by one extract pass. */
export interface InspectBundleResult {
  entity: CanonicalCharacter;
  lorebooks: CanonicalLorebook[];
}

/**
 * Read a character file into canonical form and extract any embedded book once. Sets
 * `entity.body.knowledgeRefs` when a book is present. Shared by CLI convert and Studio inspect.
 */
export function inspectBundle(
  source: CharacterAdapter,
  input: AdapterInput,
): InspectBundleResult {
  const entity = source.toCanonical(input);
  // A format whose embedded book is not a CCv2/v3 character_book (Agnai's native MemoryBook) extracts
  // via its own adapter override; every CCv3-lineage card uses the shared extractor.
  const lorebook = source.extractLorebook
    ? source.extractLorebook(entity)
    : extractCharacterBook(primaryOriginalRaw(entity.original));
  const lorebooks = lorebook ? [lorebook] : [];
  if (lorebook) entity.body.knowledgeRefs = [lorebook.id];
  return { entity, lorebooks };
}

/**
 * Write a character through a target adapter, re-embedding resolved lorebooks via EmitContext.
 * Callers that have no linked books may pass an empty array (equivalent to omitting context).
 */
export function emitBundle(
  target: CharacterAdapter,
  entity: CanonicalCharacter,
  lorebooks: CanonicalLorebook[] = [],
  requestedExtension?: string,
): AdapterOutput {
  const ctx =
    lorebooks.length > 0 || requestedExtension
      ? {
          ...(lorebooks.length > 0 ? { lorebooks } : {}),
          ...(requestedExtension ? { requestedExtension } : {}),
        }
      : undefined;
  return target.fromCanonical(entity, ctx);
}

/**
 * Rewrite knowledgeRefs after keep-both renames. `idMap` maps requested id -> actual saved id.
 * Unknown keys pass through unchanged (fail-closed callers should only map known renames).
 */
export function rewriteKnowledgeRefs(
  entity: CanonicalCharacter,
  idMap: ReadonlyMap<string, string>,
): CanonicalCharacter {
  const refs = entity.body.knowledgeRefs;
  if (!refs?.length || idMap.size === 0) return entity;
  entity.body.knowledgeRefs = refs.map((id) => idMap.get(id) ?? id);
  return entity;
}

/**
 * Convert one file to another format of the SAME entity kind. Character conversions also carry any
 * embedded lorebook across the boundary (extract on import, re-embed on export); lorebook conversions
 * are a straight round-trip. Checking BOTH kinds against a literal narrows each adapter to its member,
 * so no cast is needed. Cross-kind (e.g. character -> standalone lorebook) is not a conversion vaud
 * makes today - it fails closed with a clear message rather than producing garbage.
 */
export function convertFile(
  src: FormatAdapter,
  target: FormatAdapter,
  input: AdapterInput,
  opts?: { requestedExtension?: string },
): ConvertResult {
  const req = opts?.requestedExtension;
  if (src.kind === "character" && target.kind === "character") {
    const { entity, lorebooks } = inspectBundle(src, input);
    const out = emitBundle(target, entity, lorebooks, req);
    return { out, lorebooks };
  }
  if (src.kind === "lorebook" && target.kind === "lorebook") {
    return { out: target.fromCanonical(src.toCanonical(input)), lorebooks: [] };
  }
  if (src.kind === "persona" && target.kind === "persona") {
    return { out: target.fromCanonical(src.toCanonical(input)), lorebooks: [] };
  }
  throw new Error(`convert: cannot convert a ${src.kind} to a ${target.kind} (different entity kinds)`);
}
