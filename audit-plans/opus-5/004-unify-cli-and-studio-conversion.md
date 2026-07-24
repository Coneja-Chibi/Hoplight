# Plan 002: Make the CLI convert every kind the studio converts

> Executor contract: Read the entire plan. Follow steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition.
> Report deviations instead of silently improvising.

## Status

- Priority: 4
- Category: correctness, architecture
- Effort: S
- Risk: LOW
- Depends on: nothing
- Planned at: `80451e6`, 2026-07-24
- Finding: F-02 (MEDIUM; lowered from HIGH by adversarial review, see AUDIT.md)

## Outcome

`hoplight convert in.json out.json --to rolecall-preset` succeeds for preset and regex sets, exactly
as the studio already does. `convertFile` becomes the single conversion service both the CLI and the
studio compose, which is what `src/convert.ts:10` already claims. The kind-mismatch error stops
saying "different entity kinds" about two entities of the same kind.

## Why this matters

Nine adapters that `docs/FORMAT-SUPPORT.md:53-70` advertises (4 preset, 5 regex) cannot be reached
from the CLI, so batch or scripted migration of presets and regex sets is impossible while the GUI
does it without complaint. Worse, the failure message is false. A user converting a SillyTavern
preset to a RoleCall preset is told these are "different entity kinds" when both are `preset`. That
message cannot be acted on, because it describes a condition that is not the real one.

## Proven root cause

Live-proven at `80451e6`, same entity and target, same process:

```
STUDIO  /api/export  sillytavern-preset -> rolecall-preset
  HTTP 200, wrote 2867 chars as .json

CLI     convertFile  sillytavern-preset -> rolecall-preset
  FAILED: convert: cannot convert a preset to a preset (different entity kinds)
```

Two implementations of one operation:

```ts
// src/convert.ts:143-160 - explicit per-kind branches, three of five kinds
if (src.kind === "character" && target.kind === "character") { ... }
if (src.kind === "lorebook"  && target.kind === "lorebook")  { ... }
if (src.kind === "persona"   && target.kind === "persona")   { ... }
throw new Error(`convert: cannot convert a ${src.kind} to a ${target.kind} (different entity kinds)`);
```

```ts
// src/ui/server-engine.ts:158-178 - mismatch check, then a generic path for every other kind
if (entity.kind !== target.kind) return err(`cannot write a ${entity.kind} as ${target.id} ...`);
if (target.kind === "character" && entity.kind === "character") { out = emitBundle(...); }
else { out = (target.fromCanonical as (e: AnyEntity) => {...})(entity); }
```

The studio branch is the more capable one and is already proven in production. The CLI path
enumerates kinds and was not extended when preset and regex adapters were added.

`src/cli.ts:363` is the only CLI call site; it surfaces the thrown message verbatim at `:367`.

## Current architecture and authority

`convertFile` is the intended single service. Its own docblock, `src/convert.ts:10`, states the
invariant this plan restores: "Studio inspect/export must compose the same service as the CLI."

The `FormatAdapter` union is discriminated on `kind` (`src/core/adapter.ts`), which is why the
existing code checks both sides against a literal: it narrows each adapter to its member so no cast
is needed. That is a deliberate type-safety decision and the reason the generic path in
`server-engine.ts:173` needs its `as` cast. Preserve the narrowing where it buys safety; confine the
cast to one place.

Bundle behavior that must not regress:

- character: `inspectBundle` extracts an embedded book and sets `knowledgeRefs`, `emitBundle`
  re-embeds via `EmitContext` (`src/convert.ts:47-104`).
- preset: `inspectPresetBundle` (`src/convert.ts:74-83`) pulls bundled regex via `extractRegex`,
  implemented by `src/formats/rolecall/preset.ts:171` and `src/formats/sillytavern/preset.ts:72`.
  It exists and is tested but no CLI route reaches it.

## Target architecture

One generic same-kind path, with character keeping its bundle special case:

```ts
export function convertFile(
  src: FormatAdapter,
  target: FormatAdapter,
  input: AdapterInput,
  opts?: { requestedExtension?: string },
): ConvertResult {
  if (src.kind !== target.kind) {
    throw new Error(
      `convert: cannot convert a ${src.kind} to a ${target.kind} (different entity kinds)`,
    );
  }
  if (src.kind === "character" && target.kind === "character") {
    const { entity, lorebooks } = inspectBundle(src, input);
    return { out: emitBundle(target, entity, lorebooks, opts?.requestedExtension), lorebooks };
  }
  const parsed = parseCanonicalEntity(src.toCanonical(input));
  if (parsed.kind !== src.kind) {
    throw new Error(`convert: ${src.id} returned a ${parsed.kind}, expected a ${src.kind}`);
  }
  const emit = target.fromCanonical as (e: typeof parsed) => AdapterOutput;
  return { out: reportedOutput(target, parsed, emit(parsed)), lorebooks: [] };
}
```

Two behavior changes beyond reachability, both deliberate:

1. The mismatch guard moves to the top, so its message is only ever emitted when the kinds actually
   differ. The false "different entity kinds" for same-kind pairs becomes impossible.
2. The wrong-kind-returned check reports which adapter misbehaved and what it returned, replacing
   three near-identical hand-written strings.

Then `handleExport` composes the service instead of duplicating dispatch, which is the part that
actually restores the `src/convert.ts:10` invariant. Its extra responsibilities (resolving
`knowledgeRefs` from the store, the 422 for missing refs) stay in `server-engine.ts`; only the
emit dispatch is delegated.

## Files

### Modify
- `src/convert.ts`: `convertFile` (`:136`). Replace the three-branch body as above. Keep
  `inspectBundle`, `inspectPresetBundle`, `emitBundle`, `reportedOutput`, and
  `rewriteKnowledgeRefs` unchanged.
- `src/ui/server-engine.ts`: `handleExport` (`:150`). Replace the inline `else` cast at `:173` with
  a call into the shared service. Preserve the `resolveLorebooksFromStore` path and the 422.
- `src/convert.test.ts`: extend. It already has a cross-kind refusal case; keep it and add same-kind
  preset and regex cases.
- `docs/reference/` page for the CLI convert surface: state that all five kinds convert.

### Do not touch
- `src/cli.ts`: no change needed. `:363` already calls `convertFile` and surfaces the message. If
  you find yourself editing the CLI, the fix is in the wrong layer.
- Any `src/formats/**` adapter mapping. This plan changes routing only.
- `src/entities/runtime-schema.ts`: F-03 owns validation. Do not widen schemas here.

## API and compatibility

No wire or storage contract changes. `/api/export` request and response shapes are unchanged; only
its internal dispatch moves. Conversions that worked before must produce byte-identical output
after, which the existing round-trip suites already assert.

`pack` is a registered entity kind (`src/entities/runtime-schema.ts`) with zero adapters. The
generic path must not make it appear supported: with no pack adapter registered, no pack conversion
can be requested, and `registry.get()` returns undefined. Add a test asserting that stays true.

## Implementation steps

### Step 1: Red first, at the public boundary

Add to `src/convert.test.ts`, before touching `src/convert.ts`:

- `sillytavern-preset` -> `rolecall-preset` produces non-empty output with a serialize report.
- `sillytavern-regex` -> `rolecall-regex` likewise.
- a genuine cross-kind pair (character -> lorebook) still throws, and the message contains
  "different entity kinds".

Verify: `bun test src/convert.test.ts` -> the two new same-kind cases FAIL with
"cannot convert a preset to a preset (different entity kinds)". Record that output verbatim; it is
the honest RED. The cross-kind case must pass already.

### Step 2: Rewrite the dispatch

Apply the `convertFile` body from Target architecture.

Verify: `bun test src/convert.test.ts` -> all pass, including the unchanged cross-kind expectation
from step 1. Do not modify that assertion.

### Step 3: Delegate the studio path

In `handleExport`, replace the `:173` cast with a call into the shared service so both callers run
one code path.

Verify: `bun test src/ui/server-bundle.test.ts src/ui/server.test.ts` -> pass.

### Step 4: Guard the empty-kind case

Add a test asserting a kind with no registered adapters cannot be requested through either path.

Verify: `bun test src/convert.test.ts` -> pass.

### Step 5: Live journey

```bash
bun run hoplight -- convert samples/sillytavern/presets/plain.preset.json \
  --to rolecall-preset /tmp/out-preset.json
```

Verify: exit 0, `/tmp/out-preset.json` non-empty and valid JSON, and the printed serialize report
lists carried and escrowed fields. Then re-import it:
`bun run hoplight -- inspect /tmp/out-preset.json` -> detects `rolecall-preset`, kind `preset`.

### Step 6: Full wall

Verify: `bun run verify:ci` -> EXIT 0.

## Test plan

- Baseline: `bun run verify:ci` green at `80451e6`.
- Honest RED: step 1, recorded verbatim.
- Unchanged GREEN: the same assertions from step 1 pass after step 2, unedited.
- Named cases: preset same-kind convert; regex same-kind convert; cross-kind still refused;
  wrong-kind-returned message names the adapter; no-adapter kind unreachable.
- Exemplar: `src/convert.test.ts` existing cross-kind refusal case.
- Adjacent: `bun run test:m1`, `bun test src/ui/server-bundle.test.ts`, `bun test src/formats`.
- Broad: `bun run verify:ci`.

## Documentation and operations

- Update the `docs/reference/` CLI page to state that all five kinds convert, replacing any text
  that implies characters and lorebooks only.
- `docs/FORMAT-SUPPORT.md` is generated; re-run `bun run matrix` only if adapter metadata changed.
  It should not have.

## Done criteria

- `bun run verify:ci` -> EXIT 0.
- The step 5 live journey succeeds and the output re-imports.
- `hoplight convert` on a preset no longer prints "different entity kinds".
- The cross-kind refusal test is byte-identical to what step 1 wrote.
- `src/ui/server-engine.ts` no longer contains its own `fromCanonical` dispatch cast.
- No files outside the Files section changed.
- Independent review returns SHIPPABLE.

## STOP conditions

- A preset or regex adapter throws inside `fromCanonical` once reachable. That is a latent adapter
  bug this plan merely exposed. Stop and report it as a new finding; do not patch the adapter here.
- Any existing character or lorebook conversion changes its output bytes. The generic path must be
  behavior-preserving for kinds that already worked.
- `handleExport` delegation would require moving `resolveLorebooksFromStore` into `src/convert.ts`.
  That would pull studio storage into the app layer and invert the dependency direction. Stop and
  re-plan.
- The `as` cast cannot be confined to one site without weakening the discriminated union's
  guarantees elsewhere.

## Rollback and recovery

Pure routing change, no persisted state. Revert the two source files and the test additions.
Anything converted with the new path remains valid, since the output is produced by the same adapter
`fromCanonical` the studio already used.

## Maintenance notes

- The reason this bug existed is that a *list of kinds* was duplicated in two places. The fix
  removes the list. If a future change reintroduces per-kind branching in either caller, it
  reintroduces this class of bug.
- Reviewer trap: it is tempting to "fix" this in `src/cli.ts` by special-casing presets. That leaves
  the two implementations divergent and the invariant still broken.
- When a `pack` adapter eventually ships, it should need zero changes here. If it does need changes,
  the generic path was not generic enough.
