# Plan 09: Generalize Kit's tool runtime

> Executor contract: Read `AGENTS.md`, the required repository docs, ADR-010, Plan 06, and this
> entire plan before editing. Begin with failing tests. Preserve provider-safe capability IDs and
> existing content capability behavior. Stop rather than introduce a second tool router.

## Status

- Priority: Critical
- Category: Architecture, correctness, agent UX
- Effort: Large
- Risk: Medium
- Depends on: Plan 06
- Planned at: `052be627518754f749ebab2d133fc5d23b112804`, 2026-07-25
- Completed: 2026-07-25
- Status: DONE

## Outcome

Kit has one folder-derived, progressively disclosed catalog for content edits and broader Studio
workflows. Large observations are fully recoverable through bounded traversal or session-local spill
handles. A model can list, inspect, and validate the complete accumulated change draft before apply.

## Proven root causes

- `ContentCapability` and `capability_find` require an existing content target, so lifecycle,
  transfer, diagnostics, and history workflows cannot use progressive disclosure.
- `src/kit/tools/_shared/format.ts` slices canonical content at 4,000 characters with no continuation.
- `ChangeDraft` drops `CapabilityPreview.platformImpact`.
- The capability adapter returns only the latest operation's changes and forces every capability
  through the draft lane even though `read` is a declared effect.
- Apply and discard are the only provider-visible draft controls.

## Target architecture

Keep one runtime registry and one search, browse, and describe entry point. Add a discoverable
descriptor union with explicit domains such as `content`, `studio`, `transfer`, and `diagnostics`.
`ContentCapability` remains the pure existing-entity subtype. Adapters remain the only bridge into
`HarnessTool`.

Add bounded, session-local result storage. Handles are opaque IDs, never paths. They support stat,
read with offset and limit, and bounded search. Entries have byte caps, count caps, and session
lifetime. `studio_read` gains outline, path, offset, and limit modes and spills only when needed.

Preserve complete draft evidence. Store platform impact with each operation and expose one compact
`change_query` workflow with list, show, and validate actions. Do not add operation rollback until
deterministic replay is specified and proven.

## Files

Modify:

- `src/entities/capabilities/types.ts`
- `src/entities/capabilities/search.ts`
- `src/entities/capabilities/exposure.ts`
- `src/entities/capabilities/index.ts`
- `src/kit/capabilities/discover.ts`
- `src/kit/capabilities/adapter.ts`
- `src/kit/capabilities/runtime.ts`
- `src/kit/changes/types.ts`
- `src/kit/changes/session.ts`
- `src/kit/tools/capability-find.ts`
- `src/kit/tools/read.ts`
- `src/kit/session.ts`
- `docs/reference/kit/tools.md`
- `docs/reference/architecture.md`

Create as drop-in concepts:

- `src/entities/capabilities/descriptor.ts`
- `src/kit/results/store.ts`
- `src/kit/tools/result-query.ts`
- `src/kit/tools/change-query.ts`

Do not touch:

- format escrow payloads
- Studio file layout
- imported script execution boundaries
- provider adapters except where a typed tool-result budget requires it

## Implementation

1. Add red catalog tests proving non-content descriptors can be discovered, searched, described,
   revealed for one turn, and hidden with the existing exposure rules.
2. Introduce the descriptor union and adapt existing content capabilities without changing their
   stable IDs or generated Workbench imports.
3. Add red read tests for a body beyond 4,000 characters, structural outline and path reads, offsets,
   invalid paths, bounded limits, spill eviction, expired handles, and path non-disclosure.
4. Implement traversal and the bounded result store. Return compact metadata that tells the model
   exactly how to continue.
5. Add red draft tests proving composed operations retain every change, warning, and platform impact.
6. Implement `change_query` list, show, and validate. Validation re-runs canonical validation and
   stale-revision checks without writing.
7. Make the adapter honor `read` effects. A read capability must not create a draft.
8. Update the Kit tool reference and architecture reference with truthful schemas, budgets, lifetime,
   and visibility rules.

## Verification

- Focused tests for capability exposure, runtime snapshots, result storage, reads, and change tools
- `bun run typecheck`
- `bun run test`
- `bun run capabilities:check`
- `bun run scan:lines`
- `bun run scan:headers`
- `bun run scan:links`
- `bun run verify:ci`

## Done criteria

- One progressive catalog serves every deferred workflow domain.
- No canonical content is irrecoverably truncated.
- Opaque spill handles are bounded and session-local.
- A composed draft can be fully listed, shown, and validated before apply.
- Platform impact survives composition.
- Read capabilities produce no draft or write.
- Existing content IDs and provider names remain compatible.

## Stop conditions

- Stop if the design needs a handwritten central workflow list.
- Stop if a result handle can reveal or accept a filesystem path.
- Stop if content compatibility requires renaming stable provider tools.
- Stop if operation rollback cannot be implemented by deterministic replay.

## Recovery and maintenance

All new state is session-local and disposable. If rollout fails, content capabilities continue
through the existing adapter while non-content descriptors remain undiscoverable. Catalog parity,
result-store bounds, and generated manifest checks belong in `verify:ci`.

## Completion evidence

- One validated descriptor catalogue now projects content capabilities and folder-derived Studio,
  transfer, and diagnostics workflows through the existing progressive-disclosure runtime.
- `studio_read` supports complete canonical reads, RFC 6901 paths, outlines, offsets, and bounded
  result handles. `result_query` provides session-local stat, read, and literal search operations.
- Composed drafts retain every operation, warning, and platform impact. `change_query` lists, shows,
  and validates complete drafts without writing.
- Read-effect capabilities cannot create drafts or alter canonical content. Deferred apply
  descriptors fail closed until a safety-owned apply contract exists.
- Focused Plan 09 verification passed with 83 tests and 0 failures; the complete Kit suite passed
  with 483 tests and 0 failures. The full `verify:ci` wall passed with 2,786 tests, one documented
  skip, and no failures. The blind implementation re-review returned SHIPPABLE. The independent
  semantic reviewer approved both changed reference pages, restoring the documentation catalogue
  to 86 of 86 approved pages.
