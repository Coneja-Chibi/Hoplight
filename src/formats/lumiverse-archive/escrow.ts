/**
 * The archive's own escrow bucket. Every dispatched row already carries the twin its own codec
 * writes (`lumiverse-persona`, `lumiverse`, and so on); this adds a second twin, keyed
 * `lumiverse-archive`, holding the raw SQLite row exactly as the table dump had it. The columns a
 * synthesized wire shape drops (scoping columns, vector-index flags, foreign-platform keys) are
 * still there for anyone who goes looking, satisfying the Round-Trip Law's escrow tier even though
 * this format is import-only and has no serializer.
 *
 * The entry is always appended, never inserted first: `primaryOriginalRaw`
 * (src/core/canonical.ts) reads the first original entry as the entity's source-of-truth wire
 * shape, and that has to stay the codec's own twin, not the row that fed it.
 */
import type { CanonicalEntity } from "../../core/canonical";

/**
 * `extraUnmapped` covers what `table` alone can't say: a regex set's resolved scope target, for
 * instance, has no honest slot on the canonical body (a RegexSetBody carries no cross-reference
 * field at all), so it lands here instead, never on the codec's own twin.
 */
export function addArchiveEscrow<Kind extends string, Body>(
  entity: CanonicalEntity<Kind, Body>,
  table: string,
  raw: Record<string, unknown>,
  extraUnmapped?: Record<string, unknown>,
): CanonicalEntity<Kind, Body> {
  return {
    ...entity,
    original: {
      ...entity.original,
      "lumiverse-archive": { raw, unmapped: { table, ...extraUnmapped } },
    },
  };
}
