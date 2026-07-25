# Plan 11: Add diagnostics and semantic editor parity

> Executor contract: Complete Plan 09 first. Start with deterministic analyzers that already exist,
> then close semantic gaps one content area at a time. Do not invent AI Doctor behavior or mutate
> platform escrow to imitate missing canonical fields.

## Status

- Priority: High
- Category: Creative diagnostics, editor parity
- Effort: Large
- Risk: Medium
- Depends on: Plan 09
- Planned at: `052be627518754f749ebab2d133fc5d23b112804`, 2026-07-25
- Status: READY AFTER PLAN 09

## Outcome

Kit can diagnose content with the same deterministic engines as the Studio and can perform the
remaining high-value semantic editor operations. Analysis uses read-effect capabilities. Mutations
remain typed, previewed, canonical, and escrow-safe.

## First diagnostic capabilities

- Lorebook health and trigger analysis from `src/core/lore/inspect.ts`
- Regex health and ordering analysis from `src/core/regex/inspect.ts`
- Pack and media health from `src/core/media/pack-health.ts`
- Preset build and marker trace from `src/core/preset/build.ts`
- Existing lore and regex rehearsal traces where the engine already exposes deterministic results

Return compact findings first, with a result handle for complete traces. Diagnostic results identify
the source capability or field path but never apply a treatment automatically.

## Editor parity slices

1. Lorebook entry create and duplicate.
2. Lorebook trigger, placement, ordering, and category operations that have canonical homes.
3. Lorebook split and merge using shared pure reducers.
4. Preset advanced blocks, markers, groups, sampler settings, and bulk operations.
5. Remaining persona, regex, and pack operations proven to exist semantically in the Web UI.

Platform-only fields remain excluded until the canonical model or format adapter exposes a typed
semantic contract. Marinara folder edges and similar escrow-owned projections are explicit stop
conditions, not permission to patch `original`.

## Files

Primary sources:

- `src/core/lore/inspect.ts`
- `src/core/regex/inspect.ts`
- `src/core/media/pack-health.ts`
- `src/core/preset/build.ts`
- `src/entities/lorebook/capabilities/`
- `src/entities/preset/capabilities/`
- `src/ui/apps/workbench/lore/session.ts`
- `src/ui/apps/workbench/lore/lore-shelf-ops.ts`
- `src/ui/apps/workbench/preset/session.ts`
- `src/ui/apps/workbench/regex/regex-shelf-ops.ts`
- `docs/reference/kit/tools.md`
- affected Workbench reference pages

Create diagnostics as drop-in read descriptors beside their owning entity or engine. Extract a shared
pure reducer exactly once when an operation is currently UI-owned.

## Implementation

1. Add red tests proving each analyzer runs through a `read` capability without creating a draft.
2. Register deterministic diagnostics through the generalized catalog and bounded-result contract.
3. Add lorebook create and duplicate with identity, order, revision, and escrow tests.
4. Move trigger, placement, split, merge, and category semantics to shared pure operations where the
   canonical model supports them. Keep the Web UI as a consumer.
5. Repeat for preset advanced editing, then close smaller persona, regex, and pack gaps.
6. For every operation, test platform impact and same-format escrow preservation.
7. Add docs that distinguish deterministic inspection, rehearsal trace, and future Doctor treatment.
8. Live-verify the affected Workbench and Kit journeys.

## Test plan

- Read effects never create or mutate a draft
- Complete analyzer findings remain recoverable beyond observation limits
- Lore create and duplicate identity and order
- Trigger and placement canonical validation
- Split and merge reversibility where claimed
- Preset build parity before and after shared reducer extraction
- Web UI and Kit preview parity
- Platform impact for non-representable semantics
- Escrow byte or semantic preservation at each format's declared tier

## Verification

- Focused core, entity capability, Kit runtime, and Workbench tests
- `bun run typecheck`
- `bun run test`
- Live Studio verification
- `bun run capabilities:check`
- `bun run catalog:check`
- `bun run matrix:check`
- `bun run verify:ci`

## Done criteria

- Existing deterministic analyzers are discoverable read capabilities.
- High-value lorebook and preset editing gaps are closed.
- The Web UI and Kit share pure semantic operations.
- No read analysis creates a draft.
- No platform-only escrow field is mutated without a typed semantic home.

## Stop conditions

- Stop if an operation needs to mutate `original`.
- Stop if a diagnostic needs to execute imported scripts outside the approved benches.
- Stop if a proposed treatment depends on an unimplemented Doctor engine.
- Stop if UI parity would require duplicating a reducer.

## Recovery and maintenance

Each parity slice must be independently green and revertible. Generated capability parity prevents
new operations from silently disappearing from one surface. Keep future Doctor and Test Stage work
in their feature specs until real engines and acceptance fixtures exist.
