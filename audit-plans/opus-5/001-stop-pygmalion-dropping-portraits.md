# Plan 001: Stop Pygmalion export dropping portraits behind a clean honesty report

> Executor contract: Read the entire plan. Follow steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition.
> Report deviations instead of silently improvising.

## Status

- Priority: 1
- Category: correctness, data loss
- Effort: S
- Risk: LOW
- Depends on: nothing
- Planned at: `80451e6`, 2026-07-24
- Finding: F-06

## Outcome

Converting a character that has a portrait into Pygmalion either keeps the portrait, or reports it
as dropped. It never does what it does today, which is lose it and report success.

## Why this matters

Hoplight's honesty reporting exists so a user knows what a conversion costs before they accept it.
For this one path it asserts the opposite of the truth. A silent loss behind a clean report is worse
than a loud loss, because the user has been given a reason not to check.

Live-proven on four samples across three source formats:

```
samples/backyard/characters/2.byaf            -> pygmalion  .json  image=NO  portrait reported dropped? false
samples/backyard/characters/3.byaf            -> pygmalion  .json  image=NO  portrait reported dropped? false
samples/sillytavern/characters/v3-full.json   -> pygmalion  .json  image=NO  portrait reported dropped? false
samples/rolecall/characters/vera-casting-card -> pygmalion  .json  image=NO  portrait reported dropped? false
```

Each source entity genuinely populates `body.media.portrait`. Each output carries no image. None
reports the loss.

## Proven root cause

`src/formats/pygmalion/coverage.ts:17` lists `"media.portrait"` in `carries`.

`src/formats/pygmalion/index.ts:150-168` `fromCanonical` emits a PNG carrier **only** when the
entity has Pygmalion's own escrow:

```ts
const sm = esc?.sourceMedia as { b64?: string; mime?: string } | undefined;
if (sm && typeof sm.b64 === "string" && sm.mime === "image/png") {
  // ... embedCharacterJson -> { bytes, suggestedExtension: "png" }
}
return { text, suggestedExtension: "json" };   // :168, portrait gone
```

It never reads `entity.body.media.portrait`. A character imported from any other format has no
`original.pygmalion`, so `sm` is undefined and the JSON branch runs.

`src/core/reports.ts:87` builds the dropped list as everything the target's `CoverageDecl` does not
cover, via `coversPath`. Because `media.portrait` is declared covered, the loss is exempted.

The declaration already contradicts itself. `coverage.ts:22` notes: "PNG carrier pixels when
imported from a Pygmalion-style chara PNG; not a card key". That is accurate and it is the narrower
truth. But `notes` is prose for humans and `carries` is the machine-readable claim `coversPath`
consumes unconditionally, so the honest note has no effect on the report.

`src/core/coverage.ts:7-8` predicts exactly this failure mode: "the round-trip harness that
mechanically pins claims to codec reality is tracked follow-up work - until then a wrong claim is a
bug in that format's folder".

## Target architecture

Two options. They are not equivalent and the choice is a product decision, so make it deliberately.

| Option | Change | User result | Effort |
| --- | --- | --- | --- |
| A. Honor the portrait | `fromCanonical` falls back to `body.media.portrait` when no escrow exists, emitting a PNG carrier | Portrait survives cross-format conversion | S |
| B. Tell the truth | Remove `"media.portrait"` from `carries` | Portrait still lost, but the report says so | XS |

**Prefer A**, because Pygmalion's wire format demonstrably supports an embedded portrait (the escrow
path already produces one via `embedCharacterJson`), so the capability exists and only the fallback
is missing. B alone leaves a real capability gap while merely documenting it.

If A cannot be done safely, ship B immediately rather than leaving the false claim standing. B is
strictly better than today and takes one line.

Under A, the shape is: when `sm` is absent, read `entity.body.media.portrait`, decode it to PNG
bytes, and take the same `embedCharacterJson` path. `media.portrait` is a `MediaAsset`
(`src/entities/character/schema.ts:170`), and `src/formats/pygmalion/index.ts:103` `portraitFromPng`
already shows the inverse conversion, so it is the exemplar for shape and role handling.

## Files

### Modify
- `src/formats/pygmalion/index.ts`: `fromCanonical` (`:150`). Add the fallback. Do not disturb the
  escrow branch, which is correct and is what makes same-format round trips lossless.
- `src/formats/pygmalion/coverage.ts`: under option B, remove `"media.portrait"` from `carries`.
  Under option A, keep it and tighten the note at `:22` to describe the new behavior truthfully.
- `src/formats/pygmalion/pygmalion.test.ts`: add the cases below.

### Do not touch
- `src/core/reports.ts` or `src/core/coverage.ts`. The reporting machinery is correct; it faithfully
  reported what the declaration told it. Changing the engine to compensate for one wrong declaration
  would hide the next one.
- Any other format's `coverage.ts`. Auditing the rest is real work (see Maintenance notes) but it is
  not this plan.
- `samples/**`.

## Implementation steps

### Step 1: Red first, at the public boundary

Add to `src/formats/pygmalion/pygmalion.test.ts`: take a character parsed from a non-Pygmalion
sample that populates `body.media.portrait` (use `samples/sillytavern/characters/v3-full.json`,
proven above), pass it to the Pygmalion adapter's `fromCanonical`, and assert **both**:

1. the output carries the portrait (option A) or the serialize report lists `media.portrait` as
   dropped (option B);
2. `media.assets` still appears in the dropped list, so the test cannot pass by breaking reporting
   generally.

Verify: `bun test src/formats/pygmalion` -> the new case FAILS. Record the output verbatim. This is
the honest RED, and it must fail for the right reason: portrait absent AND unreported.

### Step 2: Implement the chosen option

Apply A or B. If A, keep the escrow branch first so same-format conversions are byte-unchanged.

Verify: `bun test src/formats/pygmalion` -> pass, with the step 1 assertions unedited.

### Step 3: Prove the same-format round trip did not regress

The escrow path is what makes Pygmalion PNG to Pygmalion PNG lossless. Confirm it still is.

Verify: `bun test src/formats/pygmalion src/m1.convert.smoke.test.ts` -> pass, including the
existing round-trip assertion at `src/formats/pygmalion/pygmalion.test.ts:68`.

### Step 4: Re-run the audit's own reproduction

Convert all four samples from the finding and confirm the outcome changed:

```bash
bun run hoplight -- convert samples/sillytavern/characters/v3-full.json --to pygmalion /tmp/p.json
bun run hoplight -- convert samples/backyard/characters/2.byaf --to pygmalion /tmp/p2.json
```

Verify: under A the output is a `.png` carrying the portrait; under B the printed report lists
`media.portrait` among the dropped fields. Either way the silent loss is gone.

### Step 5: Full wall

Verify: `bun run verify:ci` -> EXIT 0.

## Test plan

- Baseline: `bun run verify:ci` green at `80451e6` (2250 pass, 0 fail).
- Honest RED: step 1, recorded verbatim.
- Unchanged GREEN: step 1's assertions after step 2, unedited.
- Named cases: cross-format portrait handling; same-format escrow round trip unchanged;
  `media.assets` still reported dropped (the anti-vacuity assertion).
- Exemplar: `src/formats/pygmalion/pygmalion.test.ts:68` for round-trip style.
- Adjacent: `bun run test:m1`, `bun test src/formats src/core`.
- Broad: `bun run verify:ci`.

## Documentation and operations

- `docs/reference/formats/` page for Pygmalion: state truthfully whether portraits survive a
  cross-format import. This is the surface users read before converting.
- `bun run matrix` only if adapter metadata changed. Coverage edits do not change the matrix.

## Done criteria

- `bun run verify:ci` -> EXIT 0.
- The four-sample reproduction no longer shows a portrait lost without report.
- The same-format Pygmalion round trip still passes.
- `media.assets` still appears in dropped lists, proving reporting was not broadened into silence.
- `coverage.ts` `carries` and its `notes` no longer disagree with each other.
- Independent review returns SHIPPABLE.

## STOP conditions

- Option A produces a PNG that Pygmalion or SillyTavern cannot re-read. A corrupt carrier is worse
  than a missing portrait. Fall back to B and report.
- The fallback would require decoding an arbitrary user-supplied data URI into image bytes without
  a size bound. Bound it or stop; `src/studio/portrait.ts:15-18` has the existing raster-only
  allowlist to reuse, and SVG must stay excluded.
- Other formats turn out to have the same class of over-claim. Record them, do not fix them here.

## Rollback and recovery

Revert the two source files and the tests. No stored data changes. Files already exported with a
missing portrait are unaffected either way; this plan changes future exports only.

## Maintenance notes

- The general defect is that `carries` is an unverified claim. `src/core/coverage.ts:7-8` says so.
  Pygmalion is the instance this audit proved; `marinara`, `novelai`, and `vaud-json` ship **no**
  `coverage.ts` at all and `sillytavern-preset` omits its declaration
  (`src/formats/sillytavern/preset.ts:29`). A harness that pins every declaration against real codec
  behavior would close the class. That is the honest follow-up and it is larger than this plan.
- Reviewer trap: making the test pass by deleting the coverage declaration entirely would also
  delete the true claims. Only `media.portrait` is wrong.
