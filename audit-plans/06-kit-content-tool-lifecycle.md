# Plan 06: Build Kit's canonical content capability loop

> Executor contract: Read this entire plan and the repository instructions. Follow steps in order.
> Touch only in-scope files. Run every verification gate. Stop on any STOP condition. Report
> deviations instead of silently improvising.

## Status

- Priority: High
- Category: Architecture, CLI UX, correctness
- Effort: XL, delivered as independently green phases
- Risk: High because it moves editor mutation authority below the Web UI
- Depends on: Plans 01 through 04 done; non-security provider work from Plan 05 done
- Planned at: `d18c65e`, 2026-07-25
- Evidence: [PROFESSIONAL-TOOLFLOW-REFERENCE.md](PROFESSIONAL-TOOLFLOW-REFERENCE.md)
- Scope: non-security content tools and tool-loop behavior only

### Implementation progress

In progress on `Backstage`:

- Steps 1 and 2 are implemented and focused-test proven.
- Step 3 has a shared lorebook slice: settings plus entry update, reorder, enable, and remove.
- Step 4 has session-local draft composition, revision capture, escrow enforcement, one-shot
  compare-and-save, post-save verification, discard, and typed receipts.
- Step 5 has the complete runtime registry, turn-scoped exposure, a dynamic loop snapshot, live
  `capability_find`, typed capability drafts, `change_discard`, and confirmed `change_apply`.
- The security stop was lifted by explicit user authorization. The security-owned resolver trusts
  only exact names derived from the validated capability catalog; lookalikes remain unknown.
- Step 6 is implemented with a pure lifecycle reducer, explicit effect-driven scheduler, ordered
  concurrent read observations, serialized mutation batches, observation-aware no-progress
  detection, and model/tool/time/cancellation budgets.
- Step 7 has the drop-in `/tools` command and target, area, action Panel Deck browser with keyboard,
  mouse, empty, wide, and compact render coverage. Backstage now carries scheduler-owned discovery,
  read, draft, preview, apply, verify, discarded, and terminal receipt state through live and sealed traces. The
  fake-provider-to-saved-piece journey is integration proven; the live terminal journey remains.
- Step 8 has all six canonical bundles. Character's ten typed capabilities cover identity, prompts,
  greetings, metadata, presentation, media, links, variants, authored settings, and sealed embedded
  script lists. Persona, preset, standalone regex, and pack/media capabilities cover their canonical
  Workbench mutation families. Shared operations replace UI-only reducers where those editors exist.
  Manifest parity is green and integration journeys prove escrow preservation and no preview writes.
- Kit has one bounded read-only `docs_query` meta-tool over the generated Hoplight docs catalog.
  Catalog IDs and heading slugs are accepted; arbitrary paths are not.
- Platform-native fields that live only in `original` escrow remain outside the capability lifecycle.
  Editing them would violate the plan's escrow STOP condition until adapters provide typed semantic
  homes.

## Outcome

Kit can discover and perform every supported semantic content edit without advertising a hundred
tools at once or making users memorize commands. The Web UI and Kit share the same pure capability
implementations. Every mutation creates a visible preview, applies once through the canonical store,
re-reads the saved entity, and reports a truthful receipt.

The first shipping slice proves the complete lifecycle for lorebook entries. Later slices add the
remaining content kinds without changing the catalog, scheduler, preview, or apply contracts.

## Why this matters

Kit currently discovers a small flat folder and passes every discovered tool schema on every model
call. That works for three read tools and fails structurally at the planned 100-plus operation scale.
Meanwhile, most editor mutations live under `src/ui/apps/workbench`, making the Web UI the accidental
authority for behavior Kit also needs.

A field-per-tool design would create an unusable prompt catalog. A generic JSON patch tool would hide
domain rules, platform carry behavior, and meaningful previews. A separate Kit implementation would
drift from the Web UI.

## Proven current architecture

### Tool visibility is static for the session

- `src/kit/tools/discover.ts`, `discoverTools`: scans only top-level tool files.
- `src/kit/loop/dispatch.ts`, `toolSpecs`: serializes every discovered tool.
- `src/kit/session.ts`, `createSession`: discovers tools once and passes one static `specs` array to
  every model call.
- `src/kit/loop/loop-core.ts`, `runTurn`: receives a static `tools` array and executes every returned
  call sequentially.

### Editor semantics are UI-owned

- `src/ui/apps/workbench/editor-core.ts`: character path updates and shared editor logic.
- `src/ui/apps/workbench/lore/session.ts`: lorebook entry CRUD, ordering, bulk actions, and book
  updates.
- `src/ui/apps/workbench/preset/session.ts`: prompt blocks, markers, groups, samplers, and bulk
  actions.
- `src/ui/apps/workbench/regex/session.ts`: rule CRUD, ordering, and set updates.
- `src/ui/apps/workbench/persona/session.ts`: identity, sections, injection, portrait, and traits.
- `src/ui/apps/workbench/media/session.ts`: pack and named-media projections.

### Platform metadata is split from format adapters

- `src/ui/apps/workbench/platforms/index.ts`: character native-field manifests.
- `src/ui/apps/workbench/lore/platforms/registry.ts`: lore native-field cards.
- `src/formats/*`: canonical format adapters and their source-field knowledge.

### Storage saves atomically but has no stale-draft contract

- `src/studio/store.ts`, `StudioStore.read` and `StudioStore.save`
- `src/kit/bridge.ts`, `KitBridge.read` and `KitBridge.save`

The store validates canonical entities and writes atomically. A draft created from an older read can
still overwrite a newer saved entity. The capability loop needs an expected-revision correctness
check before apply.

## Target architecture

### Ownership

`src/entities/capabilities/` owns the catalog contract, search, preview shape, draft composition,
receipt shape, and provider-safe names. This keeps entity semantics out of the UI without making
`src/core` depend outward on Studio storage types. Pure content operations live beside their entity
under `src/entities/<kind>/capabilities/`. Platform-native capability metadata lives in the
corresponding `src/formats/<platform>/capabilities/` folder.

The Web UI imports those operations. Kit discovers them at its filesystem edge. Neither surface owns
a second implementation.

### Core types

Create these load-bearing contracts in `src/entities/capabilities/types.ts`:

```ts
export type CapabilityEffect = "read" | "draft";
export type CapabilityExposure = "direct" | "deferred" | "hidden";
export type ContentKind = ParsedCanonicalEntity["kind"];

export interface CapabilityTarget {
  kind: ContentKind;
  id: string;
  revision: string;
}

export interface CapabilityChange {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface CapabilityPreview<Entity> {
  entity: Entity;
  changes: readonly CapabilityChange[];
  warnings: readonly string[];
  platformImpact: readonly {
    platform: string;
    disposition: "carried" | "changed" | "not-representable";
    detail: string;
  }[];
}

export interface ContentCapability<Input, Entity extends ParsedCanonicalEntity> {
  id: `${ContentKind}.${string}`;
  kind: ContentKind;
  area: string;
  action: string;
  summary: string;
  aliases: readonly string[];
  platforms: readonly string[] | "canonical";
  exposure: CapabilityExposure;
  effect: CapabilityEffect;
  input: z.ZodType<Input>;
  concurrencyKey(input: Input): string;
  preview(entity: Entity, input: Input): CapabilityPreview<Entity>;
}
```

`preview` is pure. It must preserve `original` escrow and return a complete validated canonical
entity. It never writes.

### Catalog and exposure

Create:

- `src/entities/capabilities/catalog.ts`: immutable lookup by ID, duplicate rejection, kind filtering,
  provider-safe name derivation.
- `src/entities/capabilities/search.ts`: deterministic weighted search over kind, area, action, summary,
  aliases, and platform. Return at most five unless a caller explicitly requests fewer.
- `src/entities/capabilities/exposure.ts`: direct, deferred, and hidden classification plus a
  turn-scoped visible set.
- `src/entities/capabilities/index.ts`: public pure exports.
- `src/kit/capabilities/discover.ts`: recursive filesystem discovery across entity and format
  capability folders, with duplicate and malformed-module rejection.
- `src/kit/capabilities/adapter.ts`: adapt one selected domain capability to the existing
  `HarnessTool` runtime contract and provider `ToolSpec`.

Do not create a handwritten master array. Folders remain the schema. For the browser bundle, add
`scripts/capability-manifest.ts` to generate a checked TypeScript manifest from the same folders.
The generated `src/ui/apps/workbench/capabilities/generated.ts` file is an import seam, not an
independently edited catalog. Add
`capabilities:check` to `package.json` and `verify:ci`.

### Draft session

Create:

- `src/kit/changes/types.ts`
- `src/kit/changes/session.ts`
- `src/kit/changes/revision.ts`
- `src/kit/changes/apply.ts`
- `src/kit/changes/verify.ts`

One `ChangeSession` is owned by `createSession`. A draft contains:

```ts
interface ChangeDraft {
  id: string;
  target: CapabilityTarget;
  baseline: ParsedCanonicalEntity;
  proposed: ParsedCanonicalEntity;
  operations: readonly {
    capabilityId: string;
    input: unknown;
    changes: readonly CapabilityChange[];
  }[];
  warnings: readonly string[];
  status: "draft" | "applying" | "applied" | "stale" | "discarded" | "failed";
}
```

Each additional capability call against the same target previews over `proposed`, not `baseline`.
Applying performs exactly one save. Before save, re-read the entity and compare its canonical revision
to `target.revision`. A mismatch marks the draft stale and performs no write.

After save, re-read and validate that the canonical fields described by `CapabilityChange` match the
proposal. The receipt reports applied, stale, discarded, or failed. Do not add undo in this plan.

### Model tool surface

Keep these direct tools:

- existing `list`, renamed at the model boundary to `studio_list`;
- existing `search`, renamed at the model boundary to `studio_search`;
- existing `read`, renamed at the model boundary to `studio_read`;
- new `capability_find`;
- new `change_apply`;
- new `change_discard`.

`capability_find` takes a target plus plain-language query and returns up to five matches. It also
adds those matching capability specifications to the turn-scoped visible set for the next model
call. A content capability call creates or updates a draft and returns a terminal summary plus full
preview observation.

Modify `HarnessTool` rather than introduce a second runtime registry. Add explicit metadata for
exposure, effect (`read`, `draft`, or `apply`), and concurrency. `ContentCapability` is a pure domain
operation, not another runtime tool type; `src/kit/capabilities/adapter.ts` is the only conversion to
`HarnessTool`. The full runtime registry stays available to dispatch even when a tool is not
currently model-visible.

### Loop state machine

Replace the implicit static loop state with a pure reducer in `src/kit/loop/state.ts`:

```text
thinking
  -> discovering
  -> reading
  -> drafting
  -> preview-ready
  -> applying
  -> verifying
  -> completed | failed | stale | cancelled | stopped
```

Not every read-only turn visits every state. Transitions are driven by actual tool and draft events,
not model prose.

Change `LoopDeps.tools` from a static array to `toolSnapshot(): ToolSpec[]`. Call it immediately
before each model request so a successful `capability_find` can expose typed matches on the next
iteration.

Add budgets:

- maximum model round trips;
- maximum total tool calls;
- maximum elapsed turn time;
- repeated call plus identical observation digest;
- cancellation.

Preserve the existing 12-round-trip default until tests establish a reason to change it. A stop
result includes the budget name, observed value, and next recovery action.

### Batch scheduling

Create `src/kit/loop/scheduler.ts` with this contract:

- a batch containing only `effect: "read"` calls may run concurrently;
- preserve provider call order in the returned tool messages and terminal rows;
- a batch containing any draft or apply call runs in declared order;
- draft operations for one target compose in order;
- applying a missing, stale, failed, or discarded draft returns a typed terminal result without
  calling the store.

Do not infer effect from a tool name.

### Terminal journey

Add `/tools` as a drop-in command under `src/kit/commands/tools/`. It opens a Panel Deck browser:

1. piece or current target;
2. area;
3. actions with plain-language summaries;
4. details showing platform applicability and preview behavior.

The existing bare `/` popup remains a command menu and gains only the `/tools` row. The model can
discover capabilities without opening this screen.

The Backstage box renders scheduler events:

- searching capability catalog;
- reading target;
- drafting `<plain action>`;
- preview ready with change count;
- applying once;
- verifying saved piece;
- completed, stale, discarded, or failed receipt.

Reuse the locked Kit terminal treatment in `wireframes/DECISIONS.md`. Do not introduce a second status
surface.

## Files

### Create

- `src/entities/capabilities/types.ts`
- `src/entities/capabilities/catalog.ts`
- `src/entities/capabilities/search.ts`
- `src/entities/capabilities/exposure.ts`
- `src/entities/capabilities/index.ts`
- `src/entities/lorebook/capabilities/entries.ts`
- `src/entities/lorebook/capabilities/settings.ts`
- `src/ui/apps/workbench/capabilities/generated.ts`
- `src/kit/capabilities/discover.ts`
- `src/kit/capabilities/adapter.ts`
- `src/kit/changes/types.ts`
- `src/kit/changes/session.ts`
- `src/kit/changes/revision.ts`
- `src/kit/changes/apply.ts`
- `src/kit/changes/verify.ts`
- `src/kit/loop/state.ts`
- `src/kit/loop/scheduler.ts`
- `src/kit/tools/capability-find.ts`
- `src/kit/tools/change-apply.ts`
- `src/kit/tools/change-discard.ts`
- `src/kit/commands/tools.ts`
- `src/kit/session-capabilities.test.ts`
- `src/kit/render/tools/` split by model, browser, detail, and tests
- `scripts/capability-manifest.ts`
- `docs/reference/kit/README.md`
- `docs/reference/kit/tools.md`

Every authored TypeScript file gets the required purpose docblock and stays below 500 lines. Put tests
beside the owned concept.

### Modify

- `src/kit/tools/tool.ts`: explicit exposure, effect, and concurrency metadata.
- `src/kit/tools/discover.ts`: recursive drop-in discovery and duplicate rejection.
- `src/kit/loop/dispatch.ts`: runtime registry separate from visible specifications.
- `src/kit/loop/loop-core.ts`: dynamic tool snapshots, scheduler, budgets, and state events.
- `src/kit/session.ts`: own catalog, exposure, draft session, and scheduler for one Kit session.
- `src/kit/bridge.ts`: expected-revision apply seam without exposing filesystem paths.
- `src/studio/store.ts`: compare-and-save correctness contract or an equivalent atomic store-owned
  method.
- `src/ui/apps/workbench/lore/session.ts`: import shared lore capability reducers and retain only
  UI selection and undo-session behavior.
- `docs/reference/ui.md`: built `/tools`, preview, Backstage, and receipt behavior.
- `docs/reference/architecture.md`: capability authority and dependency direction.
- `package.json`: capability manifest generation and CI check.

### Later slices after the lore vertical slice

- `src/entities/character/capabilities/`
- `src/entities/persona/capabilities/`
- `src/entities/preset/capabilities/`
- `src/entities/regex/capabilities/`
- `src/entities/pack/capabilities/`
- `src/formats/<platform>/capabilities/`

Each slice replaces the corresponding Web UI reducer implementation rather than wrapping a duplicate.

### Do not touch

- `src/sandbox/`: script execution is not part of content capability work.
- `src/kit/tools/safety/`: security and approval implementation is explicitly out of scope.
- `external-refs/`: evidence only.
- escrow payloads under `original`: capability previews and applies must preserve them untouched.

## Implementation steps

### Step 1: Lock contracts with pure RED tests

Add tests for duplicate IDs, deterministic search ranking, five-result cap, provider-safe names,
turn-scoped exposure, invalid metadata, and folder discovery. Add tests that a deferred capability is
dispatchable but absent from the first model snapshot.

Verify: `bun test src/entities/capabilities src/kit/capabilities` -> new tests fail only for missing
implementation.

### Step 2: Build the catalog and generated browser manifest

Implement the core contracts, recursive Kit loader, and generated browser import manifest. Prove the
generated and filesystem catalogs contain the same IDs. Add the CI drift check.

Verify: `bun run capabilities:check` and focused catalog tests pass.

### Step 3: Extract the lorebook semantic vertical slice

Move lorebook book-setting and entry mutation logic from the UI session into capability modules.
Preserve ID creation, order, bulk behavior, and untouched canonical fields. Make the Web UI call the
shared operations. Keep focus, checked-row state, and session-local undo in the UI.

Create capability previews for:

- `lorebook.settings.update`
- `lorebook.entries.create`
- `lorebook.entries.update`
- `lorebook.entries.delete`
- `lorebook.entries.reorder`
- `lorebook.entries.bulk`
- `lorebook.entry.triggers.update`
- `lorebook.entry.placement.update`

Verify: existing lore session tests plus new capability equivalence tests pass unchanged.

### Step 4: Implement drafts, revision checks, apply, and verification

Build `ChangeSession` and store-owned compare-and-save behavior. Add tests for multiple composed
operations, one physical save, stale baseline, write failure, verification mismatch, discard, and
reapply refusal. Capture filesystem writes through the existing injected `StudioFs` test seam.

Verify: focused studio, bridge, changes, and capability tests pass.

### Step 5: Make tool exposure turn-scoped

Separate registered tools from visible specs. Make `toolSnapshot()` dynamic. Implement
`capability_find`, convert matches to typed provider tool specs, and create drafts when those
capabilities are called.

Test the complete provider transcript:

1. first request contains only the direct tool belt;
2. model calls `capability_find`;
3. second request contains no unrelated content capabilities and at most five matches;
4. model calls the selected typed capability with schema-validated input;
5. result contains a preview and draft ID.

Verify: `bun test src/kit/tools src/kit/loop src/kit/session-capabilities.test.ts` passes.

### Step 6: Add the explicit scheduler and loop budgets

Implement pure state transitions and the scheduler. Preserve ordered observations for concurrent read
batches. Serialize any batch containing draft or apply calls. Replace call-only stuck detection with
call plus observation digest.

Add tests for:

- parallel reads;
- ordered messages despite out-of-order completion;
- serialized mixed and draft batches;
- changed observations resetting no-progress detection;
- unchanged observations stopping at the configured threshold;
- model, tool, elapsed, and cancellation stops;
- no final success event after stale or failed apply.

Verify: focused loop tests pass with deterministic fake clocks and deferred promises.

### Step 7: Build `/tools` and Backstage lifecycle rendering

Implement the target-aware browser using the existing Panel Deck navigation primitives and theme
tokens. Render scheduler events in the locked Backstage box. Add container-based compact behavior,
keyboard and mouse paths, empty search, missing target, stale draft, failure, and cancellation states.

Verify live in `bun run kit` at wide and compact terminal sizes. Capture the exact journey in the
handoff:

1. type `/tools`;
2. select a lorebook and entry action;
3. return to the composer;
4. ask Kit to edit that entry;
5. inspect the preview;
6. apply;
7. observe the verified receipt;
8. reopen the Web UI and confirm the same canonical state.

### Step 8: Expand by semantic bundle

Add one content kind at a time in this order:

1. character;
2. persona;
3. preset;
4. regex;
5. pack and media;
6. platform-native extensions.

For each kind:

- inventory Web UI mutations;
- implement shared pure capabilities;
- replace UI-owned reducers;
- add manifest parity tests;
- add one Kit integration journey;
- update `docs/reference/kit/tools.md`;
- run the affected editor and format suites before starting the next kind.

Do not create all 100-plus operations in one change.

### Step 9: Run the complete wall and cold review

Run `bun run verify:ci`. Inspect the complete diff for UI-only mutation remnants, hand-maintained
catalog duplication, escrow changes, false receipts, and files over 500 lines. Independently
cold-review the plan's invariants against the implementation.

Expected verdict: `SHIPPABLE`, or stop with a source-backed blocker.

## Test plan

### Pure contract tests

- catalog uniqueness and deterministic order;
- search relevance, aliases, platform filters, and result cap;
- visibility changes only after successful discovery;
- every capability parses input and returns a valid canonical entity;
- preview changes match actual before and after values;
- untouched fields and `original` escrow remain deeply equal.

### Draft and store tests

- composition order;
- one save per apply;
- stale revision performs zero writes;
- read or write failure cannot produce an applied receipt;
- post-save mismatch cannot produce a verified receipt;
- discarded and already-applied drafts cannot apply again.

### Loop tests

- static runtime catalog with dynamic model-visible specs;
- read concurrency and mutation serialization;
- every state transition and terminal state;
- every budget and cancellation;
- truthful ordered events for the Backstage renderer.

### UI and integration tests

- `/tools` is discovered automatically and shown in the slash popup;
- keyboard and mouse navigation;
- compact container layout;
- target, area, and action filters;
- preview and receipt accessibility labels;
- full lorebook edit from natural language through saved canonical state.

### Regression matrix

- existing Web UI editor tests;
- existing format round-trip suites for the edited kind;
- studio store and bridge tests;
- all Kit command, tool, loop, render, and session tests;
- `bun run verify:ci`.

## Documentation and decisions

Update truth-based references only as each slice ships. Record the architectural choice in a new ADR
when the catalog foundation is implemented:

- one shared semantic capability authority;
- runtime catalog separated from visible prompt surface;
- turn-scoped progressive disclosure;
- preview and one-save apply boundary;
- generated browser manifest as the folders-as-schema bridge.

Do not describe later content slices as built before their tests and live journey pass.

## Done criteria

- The initial provider request contains no more than the direct tool belt.
- Discovery exposes at most five relevant typed content capabilities.
- A complete lorebook entry edit previews, applies once, re-reads, verifies, and emits a receipt.
- The same lorebook operation powers Kit and the Web UI.
- Stale drafts perform no write.
- Independent reads can run concurrently; mutation batches are serialized.
- `/tools` is keyboard and mouse usable at wide and compact container sizes.
- Existing round-trip and escrow tests remain green.
- `bun run verify:ci` passes.
- Cold review verdict is `SHIPPABLE`.

## STOP conditions

- A capability needs to modify `original` escrow to implement a canonical edit.
- The Web UI mutation cannot be extracted without changing its current user-visible semantics.
- Provider adapters cannot accept a different tool-spec array on successive model calls.
- The generated browser manifest cannot be made deterministic and CI-verifiable.
- Compare-and-save cannot be owned atomically by `StudioStore`.
- A planned operation would add a script execution path.
- Work requires changing `src/kit/tools/safety/` or otherwise enters security scope.
- A prerequisite Kit plan has regressed.
- A verification gate fails twice without a source-confirmed explanation.

## Rollback and recovery

Ship the catalog and lorebook slice before expanding other kinds. If the dynamic exposure adapter
must roll back, retain the shared capability catalog and drafts, and temporarily expose only the
lorebook capability bundle directly. Do not restore duplicate UI reducers.

No durable migration is required for drafts in this plan. If an apply fails before save, the draft
remains available for inspection or discard. If save returns but verification fails, report an
unknown verification outcome and re-read before any retry.

## Maintenance notes

- Adding a content operation means adding one capability module and tests, not editing several
  registries.
- Slash commands are shell navigation, not a mirror of model tools.
- Capability IDs are stable public identifiers once shipped.
- Search ranking is deterministic and evaluation-tested.
- Undo remains unavailable until a real recovery snapshot can restore state.
- The harness owns loop state and evidence. The model never self-declares an operation verified.
