# Plan 003: Align the front-door docs with the built product

> Executor contract: Read the entire plan. Follow steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition.
> Report deviations instead of silently improvising.

## Status

- Priority: P3
- Category: docs/DX
- Effort: S
- Risk: LOW
- Depends on: none (soft: run 002 first so the regenerated matrix lands behind an honest gate)
- Planned at: commit `80451e6`, 2026-07-24 (rewritten same day after adversarial review widened
  the defect class)
- Finding: DOCS-01 in AUDIT.md

## Outcome

No committed doc aimed at a runnable-now audience instructs a `vaud <command>` invocation: not the
generated format matrix, not the docs front door, not the shipped-milestone lines of the roadmap.
The planning-vs-reference boundary that docs/README.md already draws is propagated to AGENTS.md
and to the planning docs themselves, and docs/README.md stops contradicting it in its own words.
`specs/**` and the ADRs deliberately keep their design-era `vaud` vocabulary.

## Why this matters

The shipped CLI is `hoplight` (package.json `bin`; script `hoplight`). Yet, live-proven at
planning time, `bun run vaud formats` fails with `error: Script not found "vaud"`, and these
runnable-now surfaces still teach `vaud`:

- `docs/FORMAT-SUPPORT.md:10-13` (usage block) and `:80` ("Prefer `vaud label`"), both generated
  from `scripts/format-matrix.ts:66-71` and `:80`.
- `docs/README.md:12-13`: "Its engine and CLI are called vaud"; `docs/README.md:39`: reference
  row for ui.md says "`vaud ui`, the local server".
- `docs/ROADMAP.md:81-82`: the SHIPPED M1 exit criteria named as `vaud convert / inspect /
  validate / import --bundle / export --all-formats` and `vaud upgrade`.

And the planning boundary leaks: docs/README.md:50-53 correctly labels 01/02/03 "the founding
planning docs" and points at reference/architecture.md as the as-built truth, but AGENTS.md's
required-reading table (section 1, rows 1-3) still presents 02/03 as current contract with no
such caveat, the planning docs themselves carry no banner, and the same docs/README.md sentence
calls 03-CONVENTIONS "the binding code and process conventions", making 03 simultaneously
history and law.

Minor same-family defect: built-in help (`src/cli.ts:126-131`) omits `--strict` from Options
while the usage strings and docs/reference/cli.md:50 document it.

## Proven root cause

The 01/02/03 documents and the roadmap predate the rename to `hoplight` (02's own heading says
"the future `vaudeville-studios` code repo"); docs/README.md was written with the planning label
but not swept for its own `vaud` claims; the matrix generator template was never renamed. Fact
throughout, no inference.

## Current architecture and authority

- Truth-based reference docs: `docs/reference/**`. Docs front door: `docs/README.md`.
- Planning docs: `docs/01-VISION.md`, `docs/02-ARCHITECTURE.md`, `docs/03-CONVENTIONS.md`.
- Command-name authority: package.json (`bin: { hoplight: ./src/cli.ts }`, script `hoplight`)
  and docs/reference/cli.md's Invocation section. (A CLAUDE.md exists only as an untracked local
  file; it is NOT citable authority for an executor.)
- Doc gates: `scan:links`, `scan:emdash`, `docs:index:check` (pre-commit regenerates the index
  from the staged snapshot), `matrix:check`.
- Deliberate non-goals: `specs/**` keeps `vaud` as its internal design vocabulary (100+ sites,
  consistent, milestone contracts; renaming is a maintainer taste decision surfaced in the PR,
  not this plan); `docs/decisions/ADR-003` keeps its decision-era wording (ADRs are history);
  engine docblocks mentioning `vaud convert` (src/formats/{agnai,risu,novelai}/lorebook.ts:2)
  are internal comments, out of scope.

## Target architecture

Label history, fix runnable-now surfaces, keep still-binding law binding.

1. `scripts/format-matrix.ts:66-71`: replace the four usage lines with the working forms:

```
bun run hoplight -- formats
bun run hoplight -- inspect path/to/card.png
bun run hoplight -- convert in.png out.json --to sillytavern
bun run hoplight -- validate path/to/card.json
```

   `scripts/format-matrix.ts:80`: change "Prefer \`vaud label\` when unsure." to
   "Prefer \`bun run hoplight -- label\` when unsure." Then `bun run matrix` and commit the
   regenerated `docs/FORMAT-SUPPORT.md`.

2. `docs/README.md:12-13`: reword to name the product truthfully, e.g. "Its CLI is `hoplight`
   (the engine's historical working name was vaud, which `specs/` still uses)". `docs/README.md:39`:
   "`vaud ui`" becomes "`hoplight ui`". `docs/README.md:50-53`: keep the founding-planning-docs
   sentence, but split 03's description so law and history separate, e.g. "...and
   `03-CONVENTIONS.md` carries the code and process conventions; its testing and code law remain
   binding, while its planning-era names (`vaud`, `fixtures/`, `packages/`) are historical, see
   each file's status note."

3. `docs/02-ARCHITECTURE.md`: after the H1, add:

```markdown
> **Status: planning-era document.** This page records the original product plan and its
> vocabulary (`vaudeville-studios`, `packages/*`, the `vaud` CLI). The repo you are in is the
> built product; the live map is [reference/architecture.md](reference/architecture.md). Where
> this page and the reference docs disagree, the reference docs win.
```

4. `docs/03-CONVENTIONS.md`: after the H1, add a NARROWER note (03 is not demoted; its law
   remains in force):

```markdown
> **Status note.** The conventions here remain binding and are enforced by the gates listed in
> [AGENTS.md](../AGENTS.md) section 4. Names from the planning era are historical: the CLI is
> `hoplight` (not `vaud`), the sample corpus lives in `samples/` plus per-format fixture folders
> (not `fixtures/<format>/<case>/`), and the repo is laid out per
> [reference/architecture.md](reference/architecture.md) (not `packages/*`).
```

5. `AGENTS.md` section 1 table: reword the "Why it's required" cells for rows 1-3 to carry the
   same split (vision and planning context; naming historical; reference docs win on conflict).
   Do NOT claim AGENTS.md restates the testing law; it does not. The deterministic-test law's
   home remains 03-CONVENTIONS, kept binding by item 4's note.

6. `src/cli.ts` HELP Options block: add one `--strict` line beside `--yes`, copy matching
   docs/reference/cli.md ("convert: refuse to write when any field would be dropped").

## Files

### Modify
- `scripts/format-matrix.ts`: usage block lines 66-71 AND Notes line 80.
- `docs/FORMAT-SUPPORT.md`: regenerated output only (never hand-edited).
- `docs/README.md`: lines 12-13, 39, 50-53 as specified.
- `docs/ROADMAP.md`: in the M1 (shipped) lines 81-82, rename the command names to `hoplight`
  forms; leave future-milestone `vaud upgrade` mentions (94, 194) for the maintainer to decide
  with specs vocabulary, and say so in the PR.
- `docs/02-ARCHITECTURE.md`, `docs/03-CONVENTIONS.md`: status notes (items 3-4).
- `AGENTS.md`: three table cells (item 5).
- `src/cli.ts`: one HELP line (item 6).

### Do not touch
- `docs/01-VISION.md`: no wrong commands or paths; aspirational by nature.
- `specs/**`, `docs/decisions/**`: design-era vocabulary is deliberate; surfaced in the PR as a
  question, never bulk-edited here.
- `docs/reference/**` except regenerated FORMAT-SUPPORT.md.

## Implementation steps

### Step 1: Generator template (both sites)

Edit `scripts/format-matrix.ts:66-71` and `:80`. Verify:
`bun run matrix && grep -cE "\bvaud " docs/FORMAT-SUPPORT.md` -> `0`, and
`bun run hoplight -- formats` plus `bun run hoplight -- label samples/sillytavern/characters/v3-full.json`
both exit 0 as pasted (label path proves the Notes line's replacement is real).

### Step 2: docs front door and roadmap

Apply items 2 and the ROADMAP M1 renames. Verify: `grep -nE "\bvaud (convert|inspect|validate|label|ui|upgrade|formats|import|export)\b" docs/README.md` -> no hits;
same grep on `docs/ROADMAP.md` -> hits only on the future-milestone lines deliberately left
(list them in the PR).

### Step 3: Status notes and AGENTS.md cells

Apply items 3-5. Verify: `bun run scan:links` clean; `bun run scan:emdash` clean.

### Step 4: HELP --strict

Apply item 6. Verify: `bun run hoplight -- help | grep -- --strict` -> one line.

### Step 5: Broad checks

Verify: `bun run verify:ci` end to end. Class check (the done criterion, not just the first-found
instance): `grep -rnE "\bvaud (convert|inspect|validate|label|ui|upgrade|formats|import|export)\b" docs/ README.md AGENTS.md CONTRIBUTING.md scripts/`
returns hits ONLY in `docs/02-ARCHITECTURE.md` (status-noted), `docs/decisions/` (history), and
the deliberately-left ROADMAP future lines.

## Test plan

Docs plus one help string; the gates and the greps in each step are the tests. No unit test is
warranted for a help string; state that in the PR rather than manufacturing one.

## Documentation and operations

This plan IS the documentation change. Release note: put `[skip release]` in the squash/merge
commit message itself if maintainers do not want a patch release (per CONTRIBUTING.md the train
reads only the landing commit).

## Done criteria

- Step 5's class grep returns only the named allowed locations.
- All four matrix usage commands and the label command run as pasted from repo root (exit 0).
- 02 and 03 open with their status notes; docs/README.md carries no `vaud` command claims and no
  longer calls 03 binding-without-qualification; AGENTS.md cells updated.
- `bun run hoplight -- help` lists `--strict`.
- `bun run verify:ci` passes.
- Independent review returns SHIPPABLE.

## STOP conditions

- Maintainer signal that the `vaud` name is intended to STAY user-facing (then this plan inverts:
  the bug would be in package.json's `bin`, and that is a product decision, not a docs sweep).
- The Step 5 class grep surfaces runnable-now sites beyond the files this plan names: widen the
  file list in this plan (same PR) or report; never leave a known instance silently.
- Plan 002 not landed AND the regenerated matrix diff contains anything beyond the usage block,
  the Notes line, and the date: reconcile against Plan 002 first.

## Rollback and recovery

Docs and one string: revert the commit. The regenerated matrix reverts with it.

## Maintenance notes

- Future planning documents get a status note from day one.
- The specs/ vocabulary question (rename `vaud` to `hoplight` across design contracts, or keep as
  internal codename) is explicitly handed to the maintainer in the PR; do not let a future sweep
  bulk-edit specs without that decision.
- Reviewer trap: do not hand-edit `docs/FORMAT-SUPPORT.md`; only the generator writes it.
