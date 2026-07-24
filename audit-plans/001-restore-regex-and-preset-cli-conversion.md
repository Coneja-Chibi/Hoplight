# Plan 001: Restore regex and preset conversion through the CLI

> Executor contract: Read the entire plan. Follow steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition.
> Report deviations instead of silently improvising.

## Status

- Priority: P1
- Category: correctness
- Effort: S-M
- Risk: LOW
- Depends on: none (soft: run 002 first, or apply Step 4's side-effect note)
- Planned at: commit `80451e6`, 2026-07-24 (revised same day after adversarial review)
- Finding: CORR-01 (+ TEST-01) in AUDIT.md

## Outcome

`hoplight convert` succeeds for every same-kind pair of registered adapters, including regex and
preset; a cross-kind attempt still fails closed with an accurate message; a registry-driven test
makes it impossible to add an entity kind that the conversion wiring silently cannot route.

## Why this matters

Five regex adapters and four preset adapters are registered, advertised in docs/FORMAT-SUPPORT.md,
and fully exportable in the studio, yet the CLI refuses to convert them and blames "different
entity kinds" for a same-kind request. Live proof at planning time (both exit 1):

```
hoplight convert src/formats/_fixtures/regex/marinara-essentials.json out.json --to sillytavern-regex
  convert: cannot convert a regex to a regex (different entity kinds)
hoplight convert samples/sillytavern/presets/plain.preset.json out.json --to rolecall-preset
  convert: cannot convert a preset to a preset (different entity kinds)
```

## Proven root cause

`src/convert.ts` `convertFile` (lines 136-161) enumerates same-kind branches for `character`,
`lorebook`, and `persona` only, then falls through to the cross-kind throw for everything else,
including same-kind regex and preset. Fact, not inference: the registry registers regex/preset
adapters (see `src/formats/*/regex.ts`, `*/preset.ts`), and the studio's `handleExport`
(`src/ui/server-engine.ts:172-177`) already performs the generic non-character export the CLI
lacks. The kind union grew (adapter.ts added `RegexAdapter`, `PresetAdapter`) and this function was
not updated; the persona branch shows the same copy-paste pattern that invites the omission.

## Current architecture and authority

- Canonical source of truth for conversions: `src/convert.ts` `convertFile`, called by
  `src/cli.ts:363`. The studio does NOT use `convertFile` for export; it uses
  `handleExport` in `src/ui/server-engine.ts`, whose generic branch is the proven exemplar:

```ts
// src/ui/server-engine.ts:172-177 (current)
} else {
  out = (target.fromCanonical as (e: AnyEntity) => {
    bytes?: Uint8Array;
    text?: string;
    suggestedExtension: string;
  })(entity);
}
```

- Current convertFile same-kind branches (src/convert.ts:143-159) each do:
  parse via `parseCanonicalEntity(src.toCanonical(input))`, assert kind, call
  `target.fromCanonical`, wrap with `reportedOutput` (character path adds bundle context through
  `emitBundle`).
- Repository doctrines that bind this change: hub-and-spoke only; fail closed with honest
  messages; red test first; kinds are a closed union discriminated on `kind`
  (`src/core/adapter.ts:124-129`).

## Target architecture

One generic same-kind path with the character bundle special case. The invariant: for any two
registered adapters `a`, `b` with `a.kind === b.kind`, `convertFile(a, b, input)` routes; for
`a.kind !== b.kind` it throws the cross-kind message. Kind growth no longer touches this function.

Exact replacement for the body of `convertFile` (src/convert.ts:136-161), keeping the existing
signature and docblock intent (update the docblock's kind list sentence accordingly):

```ts
export function convertFile(
  src: FormatAdapter,
  target: FormatAdapter,
  input: AdapterInput,
  opts?: { requestedExtension?: string },
): ConvertResult {
  const req = opts?.requestedExtension;
  if (src.kind !== target.kind) {
    throw new Error(`convert: cannot convert a ${src.kind} to a ${target.kind} (different entity kinds)`);
  }
  if (src.kind === "character" && target.kind === "character") {
    const { entity, lorebooks } = inspectBundle(src, input);
    const out = emitBundle(target, entity, lorebooks, req);
    return { out, lorebooks };
  }
  const parsed = parseCanonicalEntity(src.toCanonical(input));
  if (parsed.kind !== src.kind) {
    throw new Error(`convert: ${src.kind} adapter returned the wrong entity kind`);
  }
  // Same localized cast the studio export path uses (server-engine.ts): the kinds were proven
  // equal above, but TS cannot correlate two union-typed values.
  const out = (target.fromCanonical as (e: ParsedCanonicalEntity) => AdapterOutput)(parsed);
  return { out: reportedOutput(target, parsed, out), lorebooks: [] };
}
```

Notes that are load-bearing:

- `ParsedCanonicalEntity` is already imported in convert.ts via `parseCanonicalEntity`; add the
  type import if not present.
- `requestedExtension` remains character-only (EmitContext), exactly as today for lorebook and
  persona; the CLI's `assertContainerAgreement` (src/cli-io.ts) still guards container mismatches
  downstream. Do not thread `req` into non-character adapters; their `fromCanonical` takes no
  context by contract (src/core/adapter.ts:84-115).
- This removes the lorebook and persona branches; their behavior is identical under the generic
  path (same parse, same kind assert, same reportedOutput). Confirm by diffing test results, not
  by reasoning alone.

## Files

### Modify
- `src/convert.ts`: replace `convertFile` body as above; update its docblock kind sentence.
- `src/convert.test.ts`: add the RED/GREEN cases and the registry sweep below.

### Do not touch
- `src/ui/server-engine.ts`: already correct; it is the exemplar, not a target.
- `src/core/adapter.ts`, `src/core/registry.ts`: no contract change is needed.
- Any `src/formats/**`: adapters are correct; this is wiring only.
- `docs/FORMAT-SUPPORT.md`: regenerated content is owned by Plans 002/003.

## API and compatibility

CLI behavior change only: previously-failing same-kind invocations now succeed; the cross-kind
error text is unchanged for genuinely cross-kind requests. `--json` report shape is unchanged
(`reportedOutput` attaches the same `SerializeReport` the studio produces). Exit codes unchanged.

## Implementation steps

### Step 1: RED

Add to `src/convert.test.ts` (exemplar style: src/m1.convert.smoke.test.ts, needCharacter helper
pattern):

1. regex: input `src/formats/_fixtures/regex/marinara-essentials.json` read as text, src adapter
   the marinara regex member (id `marinara-regex`, declared `src/formats/marinara/index.ts:64`),
   target `sillytavern-regex`; assert `convertFile` returns output with `report` and non-empty
   `text`.
2. preset: input `samples/sillytavern/presets/plain.preset.json`, src the sillytavern preset
   adapter (id via `FORMAT_ID`, `src/formats/sillytavern/preset.ts:19`, used at `:25`), target
   `rolecall-preset`; same assertions.
3. registry sweep: after `loadFormats()`, for every registered adapter `a`, build a minimal
   canonical entity of `a.kind` (reuse the minimal-entity literals in `src/core/registry.test.ts`
   as the exemplar; add minimal regex/preset/persona/lorebook literals), emit
   `a.fromCanonical(entity)`, feed the emitted text/bytes back as input, and assert
   `convertFile(a, a, input)` does not throw. Skip an adapter only with an inline reason if its
   emit is not re-readable standalone (record any such skip in the test output).

Verify: `bun test src/convert.test.ts` -> the new regex and preset cases FAIL on current code with
the exact message "convert: cannot convert a regex to a regex (different entity kinds)" (honest
RED). If they fail any other way, STOP: the root-cause claim is wrong.

### Step 2: GREEN

Apply the `convertFile` replacement above. Do not modify the new tests.

Verify: `bun test src/convert.test.ts` -> all new cases pass, prior cases unchanged.

### Step 3: Live journey

```
bun run hoplight -- convert src/formats/_fixtures/regex/marinara-essentials.json /tmp/out-regex.json --to sillytavern-regex --yes
bun run hoplight -- convert samples/sillytavern/presets/plain.preset.json /tmp/out-preset.json --to rolecall-preset --yes
```

Verify: both exit 0, print a report line, and the outputs re-detect:
`bun run hoplight -- validate /tmp/out-regex.json` -> OK, kind regex;
`bun run hoplight -- validate /tmp/out-preset.json` -> OK, kind preset.

### Step 4: Broad checks

Verify: `bun run typecheck` clean; `bun run test` -> no regressions from the 2250-pass baseline;
`bun run test:m1` clean.

Known interaction (GATE-01 / Plan 002): until Plan 002 lands, `bun run test` at this commit
rewrites `docs/FORMAT-SUPPORT.md` (date-only) as an import side effect. After Step 4, run
`git checkout -- docs/FORMAT-SUPPORT.md` to discard that unrelated churn before judging scope.
If the diff on that file is anything MORE than the `Generated:` date line, STOP: something else
changed the registry surface.

## Test plan

Covered in steps: honest RED on both live-proven failures; unchanged GREEN; registry-wide same-kind
sweep as the recurrence firewall; existing m0/m1 suites as the regression net. New tests live in
`src/convert.test.ts` (already in the `test` script's path list).

## Documentation and operations

`docs/reference/cli.md` describes convert generically and stays true after this change; step 4 of
its checked-steps section mentions kinds only via convertFile, no edit required. If the executor
finds any doc line claiming regex/preset CLI conversion is unsupported, update it in the same
commit (none was found at planning time).

## Done criteria

- Both Step 3 commands exit 0 and their outputs validate.
- `bun test src/convert.test.ts` includes the registry sweep and passes.
- `bun run verify:ci` passes end to end.
- `git diff --stat` touches only `src/convert.ts` and `src/convert.test.ts` (after discarding the
  GATE-01 date-only side-effect diff on `docs/FORMAT-SUPPORT.md` per Step 4, if Plan 002 has not
  landed yet).
- Independent review returns SHIPPABLE.

## STOP conditions

- The RED tests fail with any error other than the exact cross-kind message.
- Any same-kind pair in the registry sweep fails under the generic path for a reason other than a
  legitimately non-standalone emit (then: report, do not special-case silently).
- The lorebook or persona behavior changes in any existing test.
- Fixing this requires touching any file under `src/formats/`.

## Rollback and recovery

Single-commit revert; no data, schema, or storage contract is touched.

## Maintenance notes

- The registry sweep is the invariant keeper: a future `pack` (or any new) adapter kind gets CLI
  conversion for free or fails the sweep loudly.
- Reviewer trap: do not "improve" the localized cast into per-kind branches; the branches are the
  defect class this plan removes.
