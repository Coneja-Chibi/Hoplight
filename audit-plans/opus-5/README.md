# Audit plan set: Opus 5

Systemic audit of Hoplight at commit `80451e6`, 2026-07-24, produced by Claude Opus 5 running the
`grumpy-systemic-audit` skill in `audit standard direct` mode.

Namespaced by model because this was a benchmark: a Fable 5 session audited the same commit in
parallel, in a separate worktree and branch. No notes or artifacts were shared.

- **Audit record, evidence, corrections, and rejections:** [AUDIT.md](AUDIT.md)
- **Read the coverage section of AUDIT.md before trusting this set.** Roughly 60-70% of the
  repository was never examined. This is a scoping pass over about a third of the code.

## Verification baseline

`bun run verify:ci` at `80451e6`: **EXIT 0**, 2250 pass, 1 skip, 0 fail, 25560 expect() calls.
Every finding is a gap between a promise and the gate meant to enforce it, not a broken build.

## Findings and plans

Five MEDIUM findings have plans. Three LOW findings are recorded without plans, with rationale.

| Plan | Finding | Title | Priority | Category | Effort | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [001](001-stop-pygmalion-dropping-portraits.md) | F-06 | Stop Pygmalion export dropping portraits behind a clean report | 1 | correctness, data loss | S | LOW | READY |
| [002](002-lint-every-ui-typescript-file.md) | F-07 | Lint every TypeScript file under `src/ui` | 2 | tests, delivery | M | LOW | READY |
| [003](003-run-sidecar-tests-in-ci.md) | F-08 | Run the sidecar's authorization tests in CI | 3 | tests, delivery, security | S | LOW | READY |
| [004](004-unify-cli-and-studio-conversion.md) | F-02 | Make the CLI convert every kind the studio converts | 4 | correctness, architecture | S | LOW | READY |
| [005](005-close-canonical-validation-gap.md) | F-03 | Close the canonical validation gap and stop schema drift | 5 | correctness, data | M | MEDIUM | READY |

### Recorded without a plan

| Finding | Severity | Why no plan |
| --- | --- | --- |
| F-04: "Loopback only" inaccurate once LAN access is enabled | LOW | A wording fix in three summary documents. Real, but a one-sitting edit that does not need a plan artifact. My original impact claim was wrong and is corrected in AUDIT.md: `SECURITY.md:28-30` reads "Reports most valuable here:", a prioritization rather than a scope fence. |
| F-01: No gate compels a *new* adapter to ship round-trip evidence | LOW | The Law **is** enforced for shipping codecs, which I verified by breaking one (8 test failures). The residual is contributor discipline plus a stale line at `specs/formats/escrow-and-roundtrip.md:16-17` describing a harness that does not exist. Worth a spec edit, not a plan. |
| F-05: `packagedSwitch` orchestration has no direct test | LOW | Its security-critical guards (`resolveAsset`, `isAllowedDownloadHost`) **are** tested in `release-download.test.ts`. The residual is the checksum-compare and staging orchestration, plus `git-runner.ts` and `setup.ts`. Ordinary coverage backlog. |

## Execution sequence

Every plan is independent. No two touch the same file, so they can run in parallel by different
people. Order below is by leverage.

```
001 pygmalion portraits   (user-facing data loss, smallest fix)
002 lint coverage         (exposes a backlog; size it before committing)
003 sidecar CI            (needs a maintainer to add the required status check)
004 convert unification   (capability gap, fail-closed today)
005 validation gap        (highest fix risk: tightening a boundary)
```

| Plan | Primary files |
| --- | --- |
| 001 | `src/formats/pygmalion/{index,coverage,pygmalion.test}.ts` |
| 002 | `eslint.config.mjs`, `package.json`, the `src/ui/**/*.ts` backlog |
| 003 | `.github/workflows/ci.yml`, `AGENTS.md` |
| 004 | `src/convert.ts`, `src/ui/server-engine.ts`, `src/convert.test.ts` |
| 005 | `src/entities/runtime-schema.ts`, `src/ui/switch/storage-shape-tripwire.test.ts` |

Two plans touch `AGENTS.md`/`CLAUDE.md` gate tables (002 and 003). Land one, then rebase the other.
That is the only cross-plan contact point.

## Reviewer verdicts

Sixteen independent fresh-context reviewers: three lenses per finding (evidence accuracy, by-design
check, impact realism) plus a completeness critic. Each got the raw repository instructions, the raw
finding, and the source, and was told to assume the finding was wrong. None saw a preferred verdict.

| Finding | Refuted | Conductor action |
| --- | --- | --- |
| F-01 | 3/3 | Withdrawn as stated, re-verified myself, downgraded to LOW, plan deleted |
| F-05 | 3/3 | Withdrawn as stated, downgraded to LOW, plan deleted |
| F-02 | 0/3 | HIGH -> MEDIUM, invariant claim softened |
| F-03 | 1/3 | HIGH -> MEDIUM, security framing withdrawn |
| F-04 | 1/3 | MEDIUM -> LOW, impact claim corrected |

The completeness critic raised four leads. Three were chased to confirmation and became F-06, F-07,
and F-08, which are now the three highest-priority plans in this set. The fourth (an archive
entry-count denial of service) **could not be reproduced** and is recorded in AUDIT.md as an open
lead, explicitly not a finding.

Every objection was verified against primary source before I accepted it. I did not take the
reviewers on trust any more than I expected them to take me.

## Updating status

Edit the Status column here and add a dated line to the plan's own Status block. Do not delete
history: a finding that turns out to be wrong becomes `REJECTED` **with the evidence that killed
it**. This set already contains two such reversals, and they are the most useful entries in it.

## What this audit did not do

No source changes. `audit` mode is read-only on source; these plans are artifacts, not
implementations. Nothing has been merged, deployed, or applied. Five throwaway probes were run to
prove or disprove findings, and every one was reverted; `git status` in the audit worktree shows
only this directory.
