# Plan 12: Build history-backed batch tools

> Executor contract: This plan is blocked. Do not implement batch apply, restore, or production-wide
> changes until the production manifest, content-addressed object store, snapshot, and recovery engine
> in `specs/engine/productions-and-history.md` exist and pass crash-recovery tests.

## Status

- Priority: Medium
- Category: Production workflows, history, batch safety
- Effort: Extra large
- Risk: High
- Depends on: Plans 09 and 10, plus the production history engine
- Planned at: `052be627518754f749ebab2d133fc5d23b112804`, 2026-07-25
- Status: BLOCKED

## Outcome

After the history engine exists, Kit can select a frozen set of pieces, preview a multi-piece plan,
take a recovery snapshot, apply with explicit all-or-nothing or partial semantics, and report every
outcome. Restore is a first-class reviewed workflow backed by durable history.

## Why it is blocked

`ChangeSession` owns one active draft per exact target. `StudioStore` provides atomic replacement for
one saved entity, not a transaction across many entities. The production manifest, object store,
snapshot, restore, and crash recovery described in the spec have no implementation under `src/`.

Calling a loop of per-file saves one batch would be misleading. A middle failure can leave some
pieces changed and others untouched without one recovery boundary.

## Prerequisite engine

Implement and independently audit:

- production manifest and stable piece references
- content-addressed object storage
- snapshot creation before mutation
- atomic manifest commit
- restore planning and restore receipt
- interrupted-write and crash recovery
- garbage collection that cannot remove reachable history

The engine owns durability. Kit only plans, invokes, and reports it.

## Future tool families

- `production.query`: list, inspect, compare, and traverse production state
- `batch.plan`: resolve a selector to an immutable target snapshot and preview every proposed change
- `batch.apply`: require policy and confirmation, take one recovery snapshot, then apply
- `batch.status`: return per-target results and recovery information
- `history.query`: list and compare snapshots
- `history.restore`: preview and apply a selected restore

Selectors are semantic and bounded: kind, tag, deck, relationship, validation finding, or explicit
piece IDs. They never reuse transient UI selection state.

## Target contracts

A batch plan records:

- frozen target IDs and baseline revisions
- selector and resolution timestamp
- operation descriptors and validated inputs
- per-target preview, warnings, and platform impact
- declared policy: all-or-nothing or allow-partial
- expected output and resource bounds
- recovery snapshot requirement

An apply receipt records every attempted, applied, stale, skipped, failed, and restored target. It
must never collapse partial success into a generic success status.

## Implementation after unblocking

1. Prove production history and recovery independently of Kit.
2. Add red selector tests for deterministic frozen resolution and bounded result sets.
3. Add read-only production and history query descriptors.
4. Add batch planning over existing pure capabilities without writing.
5. Add stale-baseline validation across the complete frozen set.
6. Integrate snapshot creation and explicit policy handling.
7. Add apply, status, compare, and restore workflows with typed receipts.
8. Live-test cancellation, interruption, partial failure, and recovery.
9. Update architecture, production, history, and Kit tool references.

## Verification

- Production engine unit and crash-recovery tests
- Multi-piece stale and partial-failure integration tests
- Restore round-trip tests
- Kit scheduler cancellation and time-budget tests
- `bun run typecheck`
- `bun run test`
- `bun run verify:ci`

## Done criteria

- Every mutating batch has a durable pre-change snapshot.
- Target resolution is frozen and inspectable before apply.
- Policy and partial outcomes are explicit.
- Restore is proven after interruption and process restart.
- No tool claims transactionality beyond the engine's actual guarantee.

## Stop conditions

- Stop if the history engine is absent or not recovery-proven.
- Stop if a selector reads transient UI state.
- Stop if one failed target can be hidden by an aggregate success.
- Stop if restore depends on reconstructing state from model prose.

## Recovery and maintenance

History integrity and reachability checks belong in the authoritative gate. Batch schemas stay small
by composing existing semantic capabilities. New selectors are drop-in resolvers with deterministic
tests, not additions to a central switch.
