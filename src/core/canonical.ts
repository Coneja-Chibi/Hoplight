/**
 * Canonical core - the superset model every format converts through.
 * The STRUCTURE here (wrapper, escrow, per-app profiles, format ids) is the stable spine.
 * Entity field details live in ../entities/<kind>/schema.ts. Formats live in ../formats/<name>/.
 */

/**
 * A format id. OPEN on purpose (just a string): drop a new adapter folder into src/formats/
 * and it can claim any id it likes. The core never hardcodes the set of formats.
 */
export type FormatId = string;

export const CANONICAL_SCHEMA_VERSION = "1" as const;

/**
 * Derive a stable canonical id from a display name. One owner for the policy so every
 * adapter mints ids the same way (slug the name, fall back to "character" when empty).
 */
export function canonicalId(name: unknown): string {
  const slug = typeof name === "string" ? name.toLowerCase().trim().replace(/\s+/g, "-") : "";
  return slug || "character";
}

/** What we preserve from a source format so a round-trip loses nothing. */
export interface EscrowEntry {
  /** The original parsed payload, verbatim. */
  raw: unknown;
  /** Fields the canonical model did not (yet) express. */
  unmapped?: Record<string, unknown>;
}

/** Per-source escrow. Filled automatically on import, never hand-edited. */
export type Escrow = Record<FormatId, EscrowEntry>;

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
  profiles?: Partial<Profiles<Body>>;
  /** Lossless carry of source-format specifics. */
  escrow?: Partial<Escrow>;
}
