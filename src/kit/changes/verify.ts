/**
 * Post-save verification for a capability draft, excluding only Studio-owned timestamp metadata.
 *
 * WHY THE COMPARISON IS KEY-ORDER BLIND, which is not a detail. This used to compare two entities
 * with JSON.stringify, and JSON.stringify is order-sensitive. A proposed entity is built as
 * {schemaVersion, kind, id, body} and gains `original` last; a stored one already carries `original`
 * in the middle, so overwriting it keeps its position. Same content, different key order, and every
 * create reported `failed` after successfully writing the piece.
 *
 * That is the worst direction for this particular lie. A caller told the write failed retries, hits
 * "that piece id now exists", and concludes the studio is broken - while the piece sits on the shelf
 * exactly as asked. Object key order carries no meaning in canonical storage, so it must carry none
 * here either. Array order is a different matter and is preserved: block order IS the preset.
 *
 * The unit tests did not catch it because their fake bridge returns the object it was handed, so
 * proposed and saved had the same key order by construction. Only a real StudioStore reorders.
 */
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";

/**
 * Serialize with object keys in a stable order, leaving array order alone.
 *
 * Depth is not a concern: the value is a canonical entity, which is already bounded by its schema
 * and has been parsed before it reaches here.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    // An absent key and a key set to undefined are the same absence to storage, so neither is
    // allowed to make a difference to the verdict.
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

const withoutStudioMetadata = (
  entity: ParsedCanonicalEntity,
): ParsedCanonicalEntity => {
  const original = { ...(entity.original ?? {}) };
  delete original["vaud-studio"];
  return { ...entity, original };
};

/** Verify every capability-owned canonical field and non-Studio escrow after persistence. */
export function verifySavedEntity(
  proposed: ParsedCanonicalEntity,
  saved: ParsedCanonicalEntity,
): boolean {
  return stableStringify(withoutStudioMetadata(proposed))
    === stableStringify(withoutStudioMetadata(saved));
}
