/**
 * The bundle/link layer that sits above the single-entity adapters: a card is not just a character,
 * it may bundle an embedded lorebook. Converting one end to end means reading the character, pulling
 * any embedded character_book out as a linked canonical Lorebook (knowledgeRefs), then writing the
 * target - re-embedding that lorebook into the target format's own book slot.
 *
 * This is where "extract at the boundary" (import) meets "inline at the boundary" (export): the
 * extraction is format-agnostic (any CCv2/v3 card), the re-embed is the target adapter's job via the
 * EmitContext it receives. Lives here, at the app layer that already wires adapters together, never
 * in the inward-pointing core.
 */
import type { AdapterInput, AdapterOutput, FormatAdapter } from "./core";
import { primaryEscrowRaw } from "./core";
import type { CanonicalLorebook } from "./entities/lorebook/schema";
import { extractCharacterBook } from "./formats/_shared/character-book";

export interface ConvertResult {
  out: AdapterOutput;
  /** lorebooks extracted from the source card and linked to the character (0 or 1 for now) */
  lorebooks: CanonicalLorebook[];
}

/**
 * Convert one file to another format of the SAME entity kind. Character conversions also carry any
 * embedded lorebook across the boundary (extract on import, re-embed on export); lorebook conversions
 * are a straight round-trip. Checking BOTH kinds against a literal narrows each adapter to its member,
 * so no cast is needed. Cross-kind (e.g. character -> standalone lorebook) is not a conversion vaud
 * makes today - it fails closed with a clear message rather than producing garbage.
 */
export function convertFile(src: FormatAdapter, target: FormatAdapter, input: AdapterInput): ConvertResult {
  if (src.kind === "character" && target.kind === "character") {
    const entity = src.toCanonical(input);
    // A format whose embedded book is not a CCv2/v3 character_book (Agnai's native MemoryBook) extracts
    // via its own adapter override; every CCv3-lineage card uses the shared extractor.
    const lorebook = src.extractLorebook
      ? src.extractLorebook(entity)
      : extractCharacterBook(primaryEscrowRaw(entity.escrow));
    const lorebooks = lorebook ? [lorebook] : [];
    if (lorebook) entity.body.knowledgeRefs = [lorebook.id];
    const out = target.fromCanonical(entity, lorebooks.length > 0 ? { lorebooks } : undefined);
    return { out, lorebooks };
  }
  if (src.kind === "lorebook" && target.kind === "lorebook") {
    return { out: target.fromCanonical(src.toCanonical(input)), lorebooks: [] };
  }
  throw new Error(`convert: cannot convert a ${src.kind} to a ${target.kind} (different entity kinds)`);
}
