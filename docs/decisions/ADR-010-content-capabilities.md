# ADR-010: Shared semantic content capabilities

**Status:** accepted, 2026-07-25

## Context

Kit will eventually need more than one hundred content-editing operations. Advertising every schema
on every model request wastes context and makes tool selection less reliable. Implementing the same
mutation separately in Kit and the Workbench would also allow their behavior to drift.

The filesystem is already Hoplight's registry for formats and UI extensions. Content edits need the
same drop-in property, while canonical validation and escrow preservation remain mandatory.

## Decision

- Pure semantic operations live under `src/entities/<kind>/capabilities/`.
- Platform-specific operations may live under `src/formats/<platform>/capabilities/`.
- One immutable catalog validates stable dotted IDs and supports deterministic metadata search.
- Kit keeps a complete runtime registry but exposes only direct tools and up to five successfully
  discovered deferred capabilities to the model.
- The browser uses a generated import seam from the same folders. The generated file is never a
  second hand-maintained catalog.
- A capability produces a validated preview and never writes.
- Kit composes previews into a session-local draft. Applying, stale-revision checks, persistence,
  and verification are separate runtime responsibilities.
- The Web UI imports the same pure operations and keeps presentation-only state such as focus and
  undo locally.

## Consequences

- Adding an operation means adding a capability drop-in and proof, not editing a central registry.
- Models receive small, task-relevant typed tool sets instead of one huge static catalog.
- Kit and the Workbench can share mutation meaning without sharing surface state.
- Capability IDs become compatibility-sensitive once shipped.
- The live apply boundary rejects stale drafts and reports only a verified post-save receipt as
  applied.
