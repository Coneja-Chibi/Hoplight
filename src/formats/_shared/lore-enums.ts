/**
 * Lorebook shared decoders for the Tavern-family dialects (the standalone SillyTavern worldbook file,
 * the embedded CCv2/v3 character_book, and the RC v1 export). Only truly-identical wire->canonical
 * mappings live here (the two int enums - selective logic and injection role - plus the entry-level
 * character filter), so a codec cannot drift on them. Position and keyword-regex parsing genuinely
 * DIFFER between the dialects (character_book adds `before_char`/`after_char` string positions and a
 * distinct regex grammar), so those stay local; likewise the character-filter EMIT differs (RC emits
 * null, ST emits an empty object), so only the tolerant PARSE is shared here.
 *
 * Codings verified against VAUDEVILLE packages/lorebook parser.ts + apps/rc character-book.ts
 * (interop facts only: enum values, not code).
 */
import type { SelectiveLogic, MessageRole, CharacterFilter } from "../../entities/lorebook/schema";

/** ST selective logic: 0 and_any (default), 1 not_all, 2 not_any, 3 and_all. */
export const parseSelectiveLogic = (v: unknown): SelectiveLogic =>
  v === 1 ? "not_all" : v === 2 ? "not_any" : v === 3 ? "and_all" : "and_any";

export const selectiveLogicToNumber = (l: SelectiveLogic): number =>
  l === "not_all" ? 1 : l === "not_any" ? 2 : l === "and_all" ? 3 : 0;

/** ST injection role: 0 system (default), 1 user, 2 assistant. */
export const parseRole = (v: unknown): MessageRole => (v === 1 ? "user" : v === 2 ? "assistant" : "system");

export const roleToNumber = (r: MessageRole): number => (r === "user" ? 1 : r === "assistant" ? 2 : 0);

/** Tolerant read of an entry's character filter (same on every dialect); null when absent/malformed. */
export const parseCharacterFilter = (v: unknown): CharacterFilter | null => {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  return {
    isExclude: f.isExclude === true,
    names: Array.isArray(f.names) ? (f.names as string[]) : [],
    tags: Array.isArray(f.tags) ? (f.tags as string[]) : [],
  };
};

/**
 * Force entry ids unique, preserving the first claim on any id and suffixing later collisions.
 *
 * Formats in this family derive an id from the source file (`uid` in ST, `id` in Marinara) and fall
 * back to the array index when the field is absent. That fallback collides two ways: a book mixing
 * uid-bearing and uid-less entries can produce an index that some other entry already claims as its
 * uid, and `String()` collapses the number 0 and the string "0" onto the same id.
 *
 * Duplicates are not cosmetic downstream. The activation engine keys its verdict map by entry id, so
 * a collision makes one entry inherit the other's verdict and fire on keywords it does not have; and
 * the ST/Marinara writers index their raw twin by id, so two entries sharing one resolve to the same
 * output key and the second silently overwrites the first, losing an entry on round-trip.
 *
 * Pure, order-preserving, and stable: the same input always yields the same ids.
 */
export function ensureUniqueEntryIds<T extends { id: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  return entries.map((entry) => {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      return entry;
    }
    let suffix = 2;
    while (seen.has(`${entry.id}-${suffix}`)) suffix += 1;
    const id = `${entry.id}-${suffix}`;
    seen.add(id);
    return { ...entry, id };
  });
}
