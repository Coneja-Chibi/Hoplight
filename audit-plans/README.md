# audit-plans

Systemic audit of Hoplight plus executor-ready implementation plans.

- Scope: whole repository at commit `80451e6` (Mainstage, v0.1.13), 2026-07-24.
- Mode: `audit standard direct` (conductor-only, no shards). Security and privacy categories were
  EXCLUDED by operator instruction; silence on them is not a clean bill.
- Auditor: Claude Fable 5, branch `audit/grumpy-fable-5` (model-benchmark session; a parallel
  Opus session audits the same tree on its own branch).
- Verification baseline at planning: `bun run typecheck` clean; `bun run test` 2250 pass / 1 skip /
  0 fail. Full record: [AUDIT.md](AUDIT.md).

## Recommended execution sequence

1. `002` make the format matrix gate real (smallest, restores gate honesty first)
2. `001` restore regex and preset CLI conversion (highest user-facing value)
3. `003` align front-door docs with the built product (regen lands behind the honest gate)
4. `004` surface damaged entities in the library

## Dependency graph

```
002 ──(soft: regen honesty)──────> 003
002 ──(soft: scope-check hygiene)─> 001
004   independent
```

No hard blockers. Until 002 lands, 001's Step 4 discards the known GATE-01 side-effect diff
before judging scope, and 003 states one STOP tied to 002's landing state.

## Status table

| Plan | Title | Priority | Category | Effort | Risk | Depends on | Status | Last verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [001](001-restore-regex-and-preset-cli-conversion.md) | Restore regex and preset CLI conversion | P1 | correctness | S-M | LOW | none (soft: 002) | READY | 2026-07-24 |
| [002](002-make-the-format-matrix-gate-real.md) | Make the format matrix gate real | P2 | tests/delivery | S | LOW | none | READY | 2026-07-24 |
| [003](003-align-front-door-docs-with-the-built-product.md) | Align front-door docs with the built product | P3 | docs/DX | S | LOW | none (soft: 002) | READY | 2026-07-24 |
| [004](004-surface-damaged-entities-in-the-library.md) | Surface damaged entities in the library | P4 | UX/data | M | LOW-MED | none | READY | 2026-07-24 |

Statuses: TODO, READY, IN PROGRESS, BLOCKED, DONE, STALE, REJECTED.

## Findings without plans

- PERF-01 (LOW, measured): library list/portrait full-parse cost is linear in library bytes;
  88ms per 40 heavyweight entities today. Recorded in AUDIT.md as not worth doing now, with the
  repair boundary named for when archivist-scale libraries become a target.

## Considered and rejected

See the rejected ledger in [AUDIT.md](AUDIT.md): registry detect hardening (probed, holds),
switch-system candidates (read end to end, fail-closed by design), atomic-write layer (sound),
saveBundle comment nit, lore engine spot check, detection tie-breaking.

## Cross-plan conflicts

- 002 and 003 both touch `scripts/format-matrix.ts` (different regions: entry guard vs template
  strings at 66-71 and 80) and 003 regenerates `docs/FORMAT-SUPPORT.md`. Execute serially in the
  recommended order; do not run them as concurrent executors.
- 001 and 004 share no files with any other plan.

## Adversarial review

A blind fresh-context reviewer returned REVISE on all six artifacts (0 CRITICAL, 5 MAJOR,
6 MINOR); every objection was conductor-verified against source, held, and was revised into the
current artifacts. Full record: AUDIT.md's "Adversarial review" section; the raw report lives in
the PR discussion.

## Updating status

Edit only the Status and Last verified cells of the table above (plus a one-line note under the
plan's own Status section when it moves to IN PROGRESS / DONE / BLOCKED). Do not renumber plans,
do not rewrite history; a superseded approach gets a new plan file that links back.
