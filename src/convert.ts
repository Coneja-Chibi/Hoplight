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
  PresetAdapter,
} from "./core";
import { primaryOriginalRaw } from "./core";
import { buildSerializeReport, serializeReport } from "./core";
import type { CanonicalEntity } from "./core/canonical";
import type { CanonicalCharacter } from "./entities/character/schema";
import type { CanonicalLorebook } from "./entities/lorebook/schema";
import type { CanonicalPreset } from "./entities/preset/schema";
import type { CanonicalRegexSet } from "./entities/regex/schema";
import {
  parseCanonicalEntity,
  type ParsedCanonicalEntity,
} from "./entities/runtime-schema";

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
  const parsed = parseCanonicalEntity(source.toCanonical(input));
  if (parsed.kind !== "character") throw new Error("convert: character adapter returned the wrong entity kind");
  const entity = parsed as CanonicalCharacter;
  // A format whose embedded book is not a CCv2/v3 character_book (Agnai's native MemoryBook) extracts
  // via its own adapter override; every CCv3-lineage card uses the shared extractor.
  const lorebook = source.extractLorebook
    ? source.extractLorebook(entity)
    : extractCharacterBook(primaryOriginalRaw(entity.original));
  const lorebooks = lorebook ? [lorebook] : [];
  if (lorebook) entity.body.knowledgeRefs = [lorebook.id];
  return { entity, lorebooks };
}

/** Primary preset + regex sets bundled inside its export (the preset counterpart of inspectBundle). */
export interface InspectPresetBundleResult {
  entity: CanonicalPreset;
  regexSets: CanonicalRegexSet[];
}

/**
 * Read a preset file into canonical form and pull any bundled regex scripts once (ST/RC exports
 * ride them under extensions.regex_scripts). Shared by Studio inspect and any future CLI bundle path.
 */
export function inspectPresetBundle(
  source: PresetAdapter,
  input: AdapterInput,
): InspectPresetBundleResult {
  const parsed = parseCanonicalEntity(source.toCanonical(input));
  if (parsed.kind !== "preset") throw new Error("convert: preset adapter returned the wrong entity kind");
  const entity = parsed as CanonicalPreset;
  const regex = source.extractRegex ? source.extractRegex(entity) : null;
  return { entity, regexSets: regex ? [regex] : [] };
}

/**
 * Write a character through a target adapter, re-embedding resolved lorebooks via EmitContext.
 * Omitted lorebooks mean the relationship was not resolved and preserve the adapter's twin. An
 * explicit empty array is authoritative and removes a stale embedded book.
 */
export function emitBundle(
  target: CharacterAdapter,
  entity: CanonicalCharacter,
  lorebooks?: CanonicalLorebook[],
  requestedExtension?: string,
): AdapterOutput {
  const ctx =
    lorebooks !== undefined || requestedExtension
      ? {
          ...(lorebooks !== undefined ? { lorebooks } : {}),
          ...(requestedExtension ? { requestedExtension } : {}),
        }
      : undefined;
  const out = target.fromCanonical(entity, ctx);
  const report = out.report ?? buildSerializeReport(entity, target);
  if (lorebooks === undefined) return { ...out, report };
  const resolvedIds = new Set(lorebooks.map((book) => book.id));
  const omittedRef = entity.body.knowledgeRefs?.some((id) => !resolvedIds.has(id)) ?? false;
  if (!omittedRef) return { ...out, report };
  return {
    ...out,
    report: serializeReport({
      escrowed: report.escrowed,
      dropped: [...report.dropped, "knowledgeRefs"],
      escrowShadowed: report.escrowShadowed,
      warnings: report.warnings,
    }, report.coverage),
  };
}

/** Attach the required serialize report to a non-character adapter output. */
function reportedOutput(
  target: FormatAdapter,
  entity: CanonicalEntity<string, unknown>,
  out: AdapterOutput,
): AdapterOutput {
  return { ...out, report: out.report ?? buildSerializeReport(entity, target) };
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
 * embedded lorebook across the boundary (extract on import, re-embed on export). Every other
 * same-kind adapter uses the generic canonical path. Cross-kind conversion fails closed.
 */
export function convertFile(
  src: FormatAdapter,
  target: FormatAdapter,
  input: AdapterInput,
  opts?: { requestedExtension?: string },
): ConvertResult {
  const req = opts?.requestedExtension;
  if (src.kind !== target.kind) {
    throw new Error(`convert: cannot convert a ${src.kind} to a ${target.kind} (different entity kinds)`);
  }
  if (src.kind === "character" && target.kind === "character") {
    const { entity, lorebooks } = inspectBundle(src, input);
    const out = emitBundle(target, entity, lorebooks, req);
    return { out, lorebooks };
  }
  const parsed = parseCanonicalEntity(src.toCanonical(input));
  if (parsed.kind !== src.kind) {
    throw new Error(`convert: ${src.kind} adapter returned the wrong entity kind`);
  }
  const out = (
    target.fromCanonical as (entity: ParsedCanonicalEntity) => AdapterOutput
  )(parsed);
  return { out: reportedOutput(target, parsed, out), lorebooks: [] };
}
