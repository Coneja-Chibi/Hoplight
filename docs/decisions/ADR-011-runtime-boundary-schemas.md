# ADR-011: Exhaustive runtime schemas at canonical boundaries

**Status:** accepted, 2026-07-26

## Context

Hoplight's canonical entities have rich handwritten TypeScript interfaces under
`src/entities/<kind>/schema.ts`. TypeScript cannot validate JSON received from disk, HTTP, format
adapters, or Kit drafts at runtime.

The original central decoder checked the shared envelope and a required subset of each body. Loose
objects accepted omitted optional families without validating them. A successful parse could
therefore carry values that contradicted the domain interfaces into storage and editing code.

Converting every domain interface to a schema-inferred type would be disruptive and would not itself
prove that adapters, storage, HTTP, and Kit all use the same boundary.

## Decision

- Keep the handwritten domain interfaces as the internal semantic contracts.
- Define one adjacent runtime decoder per content kind under
  `src/entities/<kind>/runtime-schema.ts`.
- Build every decoded object through `defineExhaustiveShape<T>()` from
  `src/entities/_shared/runtime-shape.ts`. It first infers the concrete Zod schemas, then requires
  exact domain-compatible input and output types. Missing or extra keys, narrowed unions, coercion,
  `any` at any nesting depth, and `never` fail typecheck.
- Compose the six strict body decoders into the discriminated canonical union in
  `src/entities/runtime-schema.ts`. This module remains the public parse and safe-parse boundary.
- Reject unknown keys in canonical envelopes, bodies, profiles, and authored nested objects for the
  current schema version. Do not silently strip or retain them.
- Keep a record open only where the domain contract explicitly declares an open carrier. This
  includes format-keyed `original`, unknown `raw`, `unmapped`, platform extras, structured metadata,
  and other named record bags.
- Validate each profile with the matching kind's shallow partial body schema. Profiles may omit
  top-level fields, but any present value must satisfy its complete canonical field type.
- Require adapter-corpus tests, fully populated per-kind fixtures, malformed-family matrices, and
  public-boundary tests to prove the decoder is used by format output, storage, HTTP save, Kit draft
  validation, and the final Kit apply seam.

## Consequences

- A successful canonical parse proves the complete known shape, not only a required floor.
- Schema drift becomes a compile-time failure, including narrower unions and coercing inputs, while
  malformed external data fails at the shared runtime boundary with bounded errors.
- Storage, HTTP, and Kit do not need competing ad hoc canonical validators.
- Adding a canonical field requires the interface, adjacent decoder, positive fixture, and malformed
  value regression to move together.
- Strict same-version keys make schema evolution explicit. A future field requires a schema-version
  decision rather than accidental pass-through.
- Declared escrow and extension bags remain lossless; strictness does not reinterpret or execute
  their values.

ADR-005's canonical-superset model, escrow envelope, and Round-Trip Law remain in force. This ADR
supersedes only its schema-authority wording.
