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
import type { CanonicalLorebook } from "./entities/lorebook/schema";
import { extractCharacterBook } from "./formats/_shared/character-book";

export interface ConvertResult {
  out: AdapterOutput;
  /** lorebooks extracted from the source card and linked to the character (0 or 1 for now) */
  lorebooks: CanonicalLorebook[];
}

/** The raw source object an adapter escrowed (the whole card), for embedded-book extraction. */
const escrowedRaw = (escrow: unknown): unknown => {
  if (!escrow || typeof escrow !== "object") return undefined;
  const first = Object.values(escrow as Record<string, unknown>)[0];
  return first && typeof first === "object" ? (first as { raw?: unknown }).raw : undefined;
};

/** Convert one card file to another format, carrying any embedded lorebook across the boundary. */
export function convertCard(src: FormatAdapter, target: FormatAdapter, input: AdapterInput): ConvertResult {
  const entity = src.toCanonical(input);
  const lorebook = extractCharacterBook(escrowedRaw(entity.escrow));
  const lorebooks = lorebook ? [lorebook] : [];
  if (lorebook) entity.body.knowledgeRefs = [lorebook.id];
  const out = target.fromCanonical(entity, lorebooks.length > 0 ? { lorebooks } : undefined);
  return { out, lorebooks };
}
