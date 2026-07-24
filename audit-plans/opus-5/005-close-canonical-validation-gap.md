# Plan 003: Close the canonical validation gap and make schema drift impossible

> Executor contract: Read the entire plan. Follow steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition.
> Report deviations instead of silently improvising.

## Status

- Priority: 5
- Category: correctness, data
- Effort: M
- Risk: MEDIUM (tightening a validation boundary can reject data that currently round-trips)
- Depends on: nothing
- Planned at: `80451e6`, 2026-07-24
- Finding: F-03 (MEDIUM; lowered from HIGH and the security framing withdrawn by adversarial
  review, since no untrusted actor can reach the boundary. See AUDIT.md)

## Outcome

Every field the canonical model declares is validated at the storage and HTTP boundary, and a future
change that adds a field to the TypeScript interface without adding it to the runtime schema fails a
gate instead of shipping silently.

## Why this matters

`CLAUDE.md:57` states that `src/entities/runtime-schema.ts` validates at the storage and HTTP
boundaries and that TS interfaces are never runtime validation. That is true for 11 of the 16
top-level fields of `CharacterBody`. It is not true for `behavior`, `bias`, `presentation`,
`settings`, or `variants`.

Live-proven at `80451e6`: an entity carrying shapes the interfaces forbid outright was accepted and
persisted verbatim.

```
runtime-schema safeParse -> ok=true
POST /api/studio/save    -> HTTP 200 ACCEPTED

Read back from disk:
  variants      = "not-an-array-at-all"      (declared CharacterVariant[])
  behavior      = {"conditions":12345,...}   (declared CharacterBehavior)
  presentation  = [1,2,3]                    (declared Presentation)
  settings      = "a string where an object belongs"
  bias          = {"logitBias":"should-be-structured"}
```

`variants` and `behavior` drive real editor features. A consumer doing `body.variants.map(...)`
throws on a string, with no useful error, and `AGENTS.md` rule 8 ("untrusted input is parsed once
into a known type; anything unreadable is rejected at the boundary") is not upheld at the boundary
the docs name.

Being precise about what this is **not**: `z.looseObject` passes unknown keys through by design, so
nothing is silently dropped and escrow is unaffected. Sealed-script rules still prevent execution of
card payloads. This is a data-integrity and fail-closed problem, not a demonstrated escalation path.

## Proven root cause

The canonical shape is defined **twice**, by hand, in two files that reference each other not at all:

- `src/entities/character/schema.ts` declares roughly twenty `export interface` types
  (`Identity:14`, `Voice:41`, `Persona:75`, `Prompts:104`, `Media:192`, `Presentation:226`, and so
  on). It imports no zod and derives nothing.
- `src/entities/runtime-schema.ts:37` independently rebuilds the same shapes as zod `looseObject`s.

This directly contradicts the stated convention. `docs/03-CONVENTIONS.md:10`: "zod schemas are the
single source of truth for shapes; TS types derive via [z.infer]". `CLAUDE.md:104` repeats it: "no
duplicate interfaces".

Two hand-maintained definitions of one shape drift. They have. Measured: `CharacterBody` has 16
top-level fields, `characterBodySchema` describes 11.

The control that should have caught it does not cover it. `src/ui/switch/storage-shape-tripwire.test.ts`
hashes exactly three files:

```ts
const SHAPE_FILES = [
  "src/entities/runtime-schema.ts",
  "src/studio/settings-shape.ts",
  "src/core/canonical.ts",
];
```

`src/entities/*/schema.ts` is absent, so a persisted-shape change made in the interfaces does not
trip the wire. Note the tripwire itself is a good control, well documented, and works as designed
for the files it does cover; its scope is the gap, not its logic.

The same duplication exists for `lorebook`, `persona`, `preset`, `regex`, and `pack`. Only the
character drift was measured. The others are unmeasured and plausible.

## Current architecture and authority

- Canonical authority for validation: `parseCanonicalEntity` / `safeParseCanonicalEntity`
  (`src/entities/runtime-schema.ts:260,265`) over `canonicalEntitySchema:248`, a
  `z.discriminatedUnion("kind")` across all six kinds.
- Call sites: `src/ui/server-engine.ts:153` (`/api/export`), `src/ui/server-studio-write.ts`
  (`/api/studio/save`), `src/convert.ts:51,78,149,155`, and `src/studio/store.ts`.
- `z.looseObject` is a deliberate choice consistent with the escrow philosophy: unknown keys survive
  rather than being stripped. Preserve that. The goal is to **describe** the declared fields, not to
  start rejecting unknown ones.

## Target architecture

One source of truth for each canonical shape, with drift caught by a gate rather than by review.

Step 1 is a bounded investigation because the source evidence does not by itself determine which of
three safe shapes is right, and guessing here would be expensive to undo.

### Decision table for step 1

| Option | What it is | Cost | Risk | Choose when |
| --- | --- | --- | --- | --- |
| A. Type-level parity assertion | Keep both definitions; add a compile-time mutual-assignability check between `CharacterBody` and `z.infer<typeof characterBodySchema>` so `bun run typecheck` fails on drift | S | LOW | The `looseObject` catchall infers cleanly enough for mutual assignability |
| B. Derive interfaces from zod | Delete the hand-written interfaces; export `z.infer` aliases. Matches the stated convention exactly | L | MEDIUM | A is not expressible, and the churn across `src/formats/**` consumers is acceptable |
| C. Runtime key-set parity test | A test asserting the zod schema's key set equals a pinned list per kind | S | LOW | A and B both blocked; weakest option, catches only top-level drift |

Prefer A. It satisfies the convention's intent (one checked relationship), costs the least, and
turns drift into a typecheck failure without touching any consumer. Fall back to C only if both A
and B are blocked, and say so explicitly in the PR.

Whichever is chosen, the five missing subtrees get described in zod, and `SHAPE_FILES` grows to
cover the files that define persisted shape.

## Files

### Modify
- `src/entities/runtime-schema.ts`: add schemas for `behavior`, `bias`, `presentation`, `settings`,
  `variants` to `characterBodySchema:37`. Use `z.looseObject` throughout to preserve pass-through.
  Mark each `.optional()` to match the interface.
- `src/ui/switch/storage-shape-tripwire.test.ts`: extend `SHAPE_FILES` with every
  `src/entities/*/schema.ts`, then update `PINNED_SHAPE_HASH`. Read that file's header first; it
  documents exactly when a hash update alone is correct and when `SCHEMA_BUMPS` must also grow.
- `src/entities/character/schema.ts`: only under option B.

### Create
- `src/entities/schema-parity.test.ts` (option A or C): the drift gate. Exemplar
  `src/formats/_shared/platform-parity.test.ts`, which is the repo's existing parity-gate pattern.

### Do not touch
- `src/formats/**`: adapters write these fields today and must keep working. If an adapter emits a
  shape the new schema rejects, that is a finding, not a schema to loosen. See STOP conditions.
- Escrow (`original`) handling anywhere. Untouched by this plan.
- `SCHEMA_BUMPS` in `src/ui/_shared/switch-decision.ts`: this plan describes existing on-disk shape
  more accurately; it does not change it. Adding an entry would falsely warn users on rollback.
  See STOP conditions for when that judgement flips.

## Data and migration

No migration. This plan changes **validation**, not stored shape. `CANONICAL_SCHEMA_VERSION` stays
`"1"`.

The compatibility question that matters: pieces already on disk were written without validation of
these five subtrees. Tightening the schema could make an existing, previously loadable piece fail to
load, which would be a regression worse than the finding. Step 3 exists to prove that does not
happen, and its failure is a STOP condition.

## Implementation steps

### Step 1: Decide the parity mechanism

Prototype option A: express mutual assignability between `CharacterBody` and
`z.infer<typeof characterBodySchema>`. Confirm whether `looseObject`'s inferred catchall and the
optional-versus-required distinctions permit a clean check. Record the result and the chosen option
in the PR.

Verify: `bun run typecheck` -> clean with the prototype in place, and deliberately renaming one
interface field makes it FAIL. If the deliberate break does not fail, option A is not viable; fall
back per the decision table.

### Step 2: Describe the five missing subtrees

Add `behavior`, `bias`, `presentation`, `settings`, `variants` to `characterBodySchema`, mirroring
`src/entities/character/schema.ts` (`CharacterBehavior`, `Presentation:226`, `CharacterSettings`,
`CharacterVariant`). Keep `z.looseObject` so unknown keys still pass.

Verify: `bun run typecheck` -> clean. `bun test src/entities` -> pass.

### Step 3: Prove no existing piece breaks

This is the regression that would matter most. Round-trip every fixture in `samples/` through
`parseCanonicalEntity` and assert every one still parses. Then convert each `samples/` character
through its own adapter and re-validate.

Verify: `bun run test:m1` and `bun test src/formats` -> pass, with zero new parse failures. Any
failure here is a STOP condition, not a schema to loosen.

### Step 4: Red test for the actual finding

Add a test asserting the audit's exact probe is now **rejected**: an entity with
`variants: "not-an-array-at-all"`, `behavior.conditions: 12345`, `presentation: [1,2,3]`,
`settings: "a string"`, `bias.logitBias: "should-be-structured"` must fail
`safeParseCanonicalEntity`, and `POST /api/studio/save` must return 400.

Verify: `bun test src/entities src/ui/server.test.ts` -> pass. Confirm this test FAILS against
`80451e6` before step 2, which is the honest RED.

### Step 5: Install the drift gate

Add the parity check chosen in step 1.

Verify: temporarily add a field to `CharacterBody` without adding it to zod. `bun run typecheck`
(option A) or `bun test src/entities/schema-parity.test.ts` (option C) -> FAILS. Revert. Record the
failure text in the PR.

### Step 6: Widen the storage-shape tripwire

Add every `src/entities/*/schema.ts` to `SHAPE_FILES` and repin `PINNED_SHAPE_HASH`. Read the
file's header comment first and follow its instruction: this change adds coverage and does not
change on-disk shape, so the hash updates but `SCHEMA_BUMPS` stays empty.

Verify: `bun test src/ui/switch/storage-shape-tripwire.test.ts` -> pass. Then touch a byte in
`src/entities/persona/schema.ts` and confirm it FAILS. Revert.

### Step 7: Extend to the remaining kinds

Repeat steps 2 and 5 for `lorebook`, `persona`, `preset`, `regex`, and `pack`. Measure each drift
before fixing it and record the per-kind field counts in the PR, so the audit's "unmeasured and
plausible" becomes measured either way.

Verify: `bun run verify:ci` -> EXIT 0.

## Documentation and operations

- If option A or C is chosen, the hand-written interfaces survive, so `docs/03-CONVENTIONS.md:10`
  and `CLAUDE.md:104` still overclaim ("no duplicate interfaces"). Correct them to describe the
  checked-parity arrangement actually built. Leaving them as-is reproduces the exact
  claim-outruns-gate pattern this audit is about.
- Update the `docs/reference/` page describing canonical validation to list which fields are
  validated, now that the answer is "all of them".

## Done criteria

- `bun run verify:ci` -> EXIT 0.
- The step 4 probe is rejected at both `safeParseCanonicalEntity` and `POST /api/studio/save`.
- The step 5 deliberate drift fails a gate, with the failure output recorded.
- The step 6 deliberate tripwire touch fails, with output recorded.
- Every `samples/` fixture still parses and still round-trips.
- Per-kind field counts for all six kinds recorded in the PR.
- No files outside the Files section changed.
- Independent review returns SHIPPABLE.

## STOP conditions

- **An existing `samples/` fixture stops parsing.** Stop. Either the new schema is wrong or a real
  data defect exists. Do not loosen the schema to get green and do not edit the fixture.
- **A shipped adapter emits a shape the new schema rejects.** Stop and report it. That is a
  separate finding.
- The five subtrees turn out to be **deliberately** unvalidated for a documented reason in an ADR or
  spec. Then F-03 is partly wrong; stop and reduce this plan to the tripwire widening and the
  documentation correction only.
- Option A and option B both prove unworkable, leaving only the weakest gate. Stop and re-plan
  rather than shipping a parity check that cannot catch nested drift.
- Any evidence emerges that on-disk shape actually changes. Then `SCHEMA_BUMPS` must grow and this
  becomes a release-coordinated change, well outside this plan's risk envelope.

## Rollback and recovery

Validation-only, no migration, no stored-shape change, so rollback is reverting the files. The one
irreversible hazard is a user who saved a malformed piece before the fix: it was accepted then and
will be rejected now. Before shipping, confirm the studio surfaces a readable error for an
unloadable piece rather than failing blank, and if it does not, that is a prerequisite to fix first.

## Maintenance notes

- The bug is not the five fields; it is that two hand-maintained definitions existed at all. Fixing
  the fields without installing the gate guarantees this recurs.
- Reviewer trap: making the new subtree schemas `z.any()` would make every test pass while
  validating nothing. Assert the step 4 probe is genuinely rejected.
- The tripwire's `SHAPE_FILES` list must grow whenever a new file starts defining persisted shape.
  That is itself a hand-maintained list with the same failure mode. Consider deriving it from the
  entities directory.
