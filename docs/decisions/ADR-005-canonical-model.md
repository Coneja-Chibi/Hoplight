# ADR-005: Canonical superset model + escrow envelope

**Status:** accepted

**Schema-authority note:** ADR-011 supersedes this document's original statement that canonical
models are defined as Zod schemas under `packages/core`. The superset model, escrow envelope, and
Round-Trip Law remain accepted. Current domain contracts are handwritten interfaces under
`src/entities/<kind>/schema.ts`, paired with exhaustive runtime decoders as specified by ADR-011.

## Decision

One internal ("canonical") model per content type, defined as zod schemas in
`packages/core`, designed as a **superset**: rich enough that parsing any supported
format into it loses nothing that has a canonical home. Fields with no canonical home
survive in an **escrow envelope** attached to the entity, keyed by origin format.

```
parse:      SourceFile -> { data: Canonical, escrow: Escrow, report: ParseReport }
serialize:  (Canonical, Escrow, target) -> { file, report: SerializeReport }
```

- Round-trip to the SAME format: escrow merges back; result is semantically identical
  (the Round-Trip Law, see specs/formats/escrow-and-roundtrip.md).
- Conversion to a DIFFERENT format: codec expresses what it can, and the report
  honestly lists what rode in escrow or was dropped ("2 fields escrowed"). Escrow is
  preserved in the output where the target format tolerates extension fields
  (e.g. V2/V3 `extensions`), so even cross-format trips are recoverable.

## Why not "just use chara_card_v3 internally"

V3 is card-only and still lossy against RC (details/palette/sprites/depth-injections),
Risu extensions, and Backyard fields; lorebooks/presets/personas need models V3 does
not define. A superset with escrow means we never argue with a format author about
whose fields matter.

## Precedents in the author's own earlier code

RoleCall's `LorebookEntry.unsupportedFields` and `origin` fields are this pattern
in miniature; VAUDEVILLE's normalizers already unify V1/V2/V3/rcpersona/RoleOut into
a common shape. This ADR promotes that habit to a system-wide law.

## Consequences

- Every codec ships a `capabilities` table (canonical field -> native/escrow/dropped)
  that powers honest conversion reports and the docs' format-support matrix
  (auto-generated, never hand-maintained).
- `core` schema changes are the most expensive changes in the repo: they require a
  migration note and a fixture sweep, plus explicit design review.
