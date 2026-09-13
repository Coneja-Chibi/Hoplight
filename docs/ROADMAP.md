# Roadmap

This roadmap separates code that exists in the repository from work that has passed a release
bar. Detailed future designs live under `specs/`; a spec is not evidence that its feature ships.

## Current foundation

Hoplight already has:

- a canonical content model with escrowed source data;
- format detection and adapters for the formats listed in `docs/FORMAT-SUPPORT.md`;
- import, validation, conversion, and export through the CLI and Studio;
- local Studio storage and editors for the content types documented in
  `docs/reference/ui.md`;
- sealed Lua and regex analysis and user-invoked test benches;
- the source-preview Kit agent, including provider setup, staged changes, sessions, content
  capabilities, and indexed documentation retrieval.

The support matrix, UI reference, and CLI reference are the authorities for exact current
behavior. Kit runs from a source checkout with `bun run kit`; current GitHub releases do not
package it.

## Near-term release work

### Make verification complete and quiet

- remove React `act(...)` warning noise from the OpenTUI harness;
- make Node and packaged-binary smoke tests exercise the artifacts users receive.

### Make public contracts exact

- keep architecture, security, CLI, and UI documentation synchronized with implementation;
- prove same-format semantic round trips at the fidelity tier claimed by each adapter;

### Make releases reproducible

- embed the remote-access sidecar in supported release artifacts;
- run the full verification wall before tagging;
- audit transitive production dependencies;
- pin build actions and tools exactly;
- authenticate the published checksums and add signatures for release artifacts.

### Finish Kit as a distributable product

- replace source-checkout-only startup with a supported packaged entry point;
- finish native create and edit flows for every supported content kind;
- preserve staged preview, explicit approval, and deterministic validation around mutations;
- test provider setup, recovery, documentation retrieval, and content lifecycles in real
  terminals on supported operating systems.

## Product work after the release foundation

### Script Doctor

Build deterministic content analysis first, then optional model-assisted treatment plans. Findings
must cite the affected field and proposed edits must remain staged. The governing contracts are
under `specs/features/`.

### Table Read

Create an interview-driven authoring flow that emits ordinary canonical edits. It must share the
same storage, validation, and history paths as direct editing.

### Test Stage and productions

Extend prompt assembly, replay, history, and multi-piece workspace support without creating a
second content model. Imported scripts remain sealed except in the existing isolated test benches.

### Archives and World Forge

Add evidence-backed extraction from large conversation archives and cross-piece continuity tools.
Every derived claim must retain a source citation.

## Release bars

A milestone is complete only when all of the following are true:

1. The public behavior exists outside a test fixture.
2. Boundary, regression, and adjacent tests pass.
3. User-facing flows are verified live in a real install.
4. Reference documentation describes the shipped behavior without future-tense substitution.
5. The release artifact, not only the source tree, passes its smoke test.

Historical jewel labels and dates are available in Git history. They are not used here as current
status evidence.
