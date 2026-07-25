# Plan 10: Add lifecycle, transfer, and publishing tools

> Executor contract: Complete Plan 09 first. Read the canonical format, content detection, bundle
> import, and affected format specs. Reuse the same engines as the CLI and Web UI. Never expose raw
> filesystem access or write before an explicit reviewed apply.

## Status

- Priority: High
- Category: Creative workflow parity
- Effort: Large
- Risk: High
- Depends on: Plan 09
- Planned at: `052be627518754f749ebab2d133fc5d23b112804`, 2026-07-25
- Status: READY AFTER PLAN 09

## Outcome

Kit can carry a creator through the full ordinary artifact lifecycle: create, clone, rename, inspect,
import, organize, validate export readiness, and publish. Mutating or external-write actions always
have a typed plan, explicit confirmation boundary, and truthful receipt.

## Current authority

- Blank entity factories and create flows live under `src/ui/apps/library/`.
- Duplicate, rename, and delete orchestration lives in the Library.
- Inspect, bundle save, format coverage, conversion, and export already exist through
  `src/ui/api.ts`, `src/ui/server-engine.ts`, `src/ui/server.ts`, and `src/cli.ts`.
- Press already computes target rows, readiness, riders, skip reasons, and batch export receipts.

The new tools must extract reusable orchestration where it is UI-owned. They must not reproduce
format conversion or storage logic inside Kit.

## Tool families

- `studio.create`: make a validated blank canonical piece of a supported kind.
- `studio.clone`: clone with a new identity and explicit link policy.
- `studio.rename`: rename display identity without moving arbitrary paths.
- `studio.delete`: review dependencies and require confirmed apply.
- `transfer.inspect`: detect content and return a bounded import plan.
- `transfer.import`: apply a reviewed import plan through canonical adapters.
- `publish.inspect`: report formats, coverage, losses, riders, and skipped targets.
- `publish.export`: execute one reviewed target plan.
- `publish.batch`: execute a frozen reviewed set and return per-item receipts.

Names are conceptual. Final IDs must follow the Plan 09 descriptor contract and folder discovery.

## Files

Likely modify or extract from:

- `src/ui/apps/library/new-in-deck-button.tsx`
- `src/ui/apps/library/delete-flow.tsx`
- `src/ui/apps/press/press-core.ts`
- `src/ui/apps/press/index.tsx`
- `src/ui/server-engine.ts`
- `src/ui/app-contract.ts`
- `src/kit/bridge.ts`
- `src/kit/session.ts`
- `docs/reference/kit/tools.md`
- `docs/reference/ui.md`

Create drop-in workflow folders under:

- `src/entities/lifecycle/`
- `src/kit/workflows/studio/`
- `src/kit/workflows/transfer/`
- `src/kit/workflows/publish/`

Use a more specific existing shared home if repository boundaries prove one. Do not create duplicate
blank factories or converter implementations.

## Implementation

1. Add red parity tests that compare Kit workflow planning with existing Library, server-engine, CLI,
   and Press outcomes on representative fixtures.
2. Extract blank creation, identity-safe clone, rename planning, and dependency-aware delete planning
   into pure shared operations.
3. Add deferred lifecycle descriptors and separate read-only plan from gated apply.
4. Add an opaque input-resource contract for files selected by the user or host. Do not accept
   arbitrary paths from a model.
5. Adapt content detection and bundle inspection into bounded import plans with recognized pieces,
   rejected members, warnings, and escrow guarantees.
6. Apply imports only through existing adapters and Studio storage. Return a receipt per piece.
7. Adapt Press readiness and target planning. Preserve representability warnings and skip reasons.
8. Export through existing server-engine or shared conversion authority. Use explicit overwrite
   policy and return output handles or user-authorized destinations.
9. Update docs and live-verify equivalent flows in the running Studio.

## Test plan

- Blank creation for every implemented canonical kind
- Clone identity and relationship policy
- Delete dependency review and canceled apply
- Unreadable and ambiguous import rejection
- Multi-piece bundle receipts and escrow preservation
- Same-format and cross-format export coverage
- Unsupported target skip reasons
- Binary and archive output bounds
- Overwrite refusal and partial batch receipts
- Path containment and server tests required by `AGENTS.md`

## Verification

- Relevant focused tests, including server and path-policy suites
- `bun run typecheck`
- `bun run test`
- `bun run test:node-core`
- Live Studio verification for user-facing flows
- `bun run verify:ci`

## Done criteria

- Kit supports the ordinary lifecycle without raw shell or filesystem tools.
- Every write has a prior typed plan and a truthful receipt.
- The CLI, Web UI, and Kit share conversion and lifecycle authority.
- Import preserves escrow and imported scripts remain sealed.
- Export reports representability and every skipped or failed target.

## Stop conditions

- Stop if a workflow needs arbitrary model-selected paths.
- Stop if a proposed operation rewrites source escrow.
- Stop if Press and Kit would compute target readiness differently.
- Stop if a batch is described as atomic without a matching transactional boundary.

## Recovery and maintenance

Lifecycle applies use the existing revision and draft checks. External writes use temporary output
plus atomic replacement where supported. Batch receipts must make partial outcomes explicit. Format
registry and capability-manifest checks remain the long-term parity guards.
