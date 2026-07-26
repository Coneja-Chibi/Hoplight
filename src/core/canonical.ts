/**
 * Canonical core - the superset model every format converts through.
 * The STRUCTURE here (wrapper, original, per-app profiles, format ids) is the stable spine.
 * Entity field details live in ../entities/<kind>/schema.ts. Formats live in ../formats/<name>/.
 */

/**
 * A format id. OPEN on purpose (just a string): drop a new adapter folder into src/formats/
 * and it can claim any id it likes. The core never hardcodes the set of formats.
 */
export type FormatId = string;

export const CANONICAL_SCHEMA_VERSION = "1" as const;

const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const STUDIO_ID_MAX = 120;

/**
 * Derive a stable storage-safe id from a display name. One owner for the policy so every
 * adapter mints ids the same way. Always passes studio path-policy (letters/numbers + ._-).
 * Fall back to "character" when empty after sanitization.
 */
export function canonicalId(name: unknown): string {
  const raw = typeof name === "string" ? name.normalize("NFKC").toLowerCase().trim() : "";
  // Keep letters/numbers; turn other runs into single hyphens.
  let slug = raw
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > STUDIO_ID_MAX) {
    slug = Array.from(slug).slice(0, STUDIO_ID_MAX).join("").replace(/-+$/g, "");
  }
  if (!slug) return "character";
  if (WIN_RESERVED.test(slug)) return `${slug}-id`;
  return slug;
}

/** What we preserve from a source format so a round-trip loses nothing. */
export interface OriginalEntry {
  /** The original parsed payload, verbatim. */
  raw: unknown;
  /** Fields the canonical model did not (yet) express. */
  unmapped?: Record<string, unknown>;
  /** The binary CARRIER the payload arrived inside. A PNG card's pixels ARE authored art, so the
   * carrier is kept as a raw-bytes twin - the portrait survives after the source file is gone,
   * and a future same-format re-emit can restore the original file. Absent for text sources. */
  sourceMedia?: { b64: string; mime: string };
}

/** Per-source original. Filled automatically on import, never hand-edited. */
export type Original = Record<FormatId, OriginalEntry>;

/**
 * The raw source payload an entity was imported from: the first original entry's `raw`. One owner for
 * "which original entry is the source", so a reader (labeler) and the bundle layer can't drift on it.
 * Returns undefined for a from-scratch entity that never carried original.
 */
export const primaryOriginalRaw = (original: Partial<Original> | undefined): unknown =>
  original ? Object.values(original)[0]?.raw : undefined;

/**
 * Sparse per-app overrides. Empty by default.
 * You author the entity ONCE; set only the fields you want to DIFFER for a given app.
 * A "per-app version" = canonical body + that app's overrides, projected by its adapter.
 * It is NEVER a full duplicate record.
 */
export type Profiles<Body> = Record<FormatId, Partial<Body>>;

/** The wrapper shared by every canonical entity (character, lorebook, preset, ...). */
export interface CanonicalEntity<Kind extends string, Body> {
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  kind: Kind;
  /** Stable internal id. */
  id: string;
  /** The actual content, in the canonical superset shape. */
  body: Body;
  /** Optional per-app deltas. */
  profiles?: Profiles<Body>;
  /** Lossless carry of source-format specifics. */
  original?: Original;
}
