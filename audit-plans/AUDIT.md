# Hoplight Systemic Audit

- Mode: audit standard, direct (conductor-only, no shards, per operator instruction)
- Focus: all playbook categories EXCEPT security and privacy (explicitly excluded by the operator)
- Commit: `80451e6` (Mainstage, v0.1.13), audited 2026-07-24
- Auditor: Claude Fable 5 (benchmark session, branch `audit/grumpy-fable-5`)
- Working tree note: `docs/FORMAT-SUPPORT.md` was already dirty (date-only regeneration) before this
  audit began and is left untouched. The cause of that dirt is itself Finding GATE-01.

## Verification baseline

Run in this worktree before any judgment, commands taken from AGENTS.md (never guessed):

| Command | Result |
| --- | --- |
| `bun run typecheck` | clean, exit 0 |
| `bun run test` | 2250 pass, 1 skip, 0 fail, 239 files, 5.28s |

The full wall is `bun run verify:ci`. Note that `bun run test` itself rewrote
`docs/FORMAT-SUPPORT.md` during the baseline run; see GATE-01.

## Authoritative instructions read

AGENTS.md (binding contract), CONTRIBUTING.md, docs/README.md, docs/01-VISION.md,
docs/02-ARCHITECTURE.md, docs/03-CONVENTIONS.md, docs/reference/architecture.md,
docs/reference/cli.md, ADR-001..ADR-009, package.json scripts, .github/workflows (ci,
auto-release), .githooks + scripts/hooks/pre-commit.ts. A CLAUDE.md exists in the primary local
checkout but is untracked (absent at `80451e6`); nothing below relies on it as repo authority.

Settled decisions honored as by-design (not reported as defects): hub-and-spoke only; escrow
immutability; sealed scripts (ADR-009); folders-as-schema; AGPL (ADR-002); single-exe distribution
(ADR-003); React 19 shell (ADR-008 supersedes ADR-007's vanilla stance); Mainstage-as-release-branch
with `[skip release]` escape; the packaged switch engine deliberately staging rather than
self-swapping the running exe.

## Audited surfaces

- Core engine: `src/core/canonical.ts`, `adapter.ts`, `registry.ts`, `loader.ts`, `src/convert.ts`,
  `src/entities/runtime-schema.ts` (full reads).
- Studio storage: `src/studio/store.ts`, `atomic-file.ts`, `bundle.ts`, `portrait.ts` (full reads);
  path-policy and fs-backend skimmed.
- UI server: `src/ui/server.ts`, `server-engine.ts` (full reads); switch system
  (`src/ui/switch/*`: manager, routes, packaged-engine, source-engine, git-runner) as the
  highest-churn recent surface.
- CLI: `src/cli.ts`, cli reference doc.
- Lore engine: `src/core/lore/activation.ts` loop bounds and recursion caps (spot check; the module
  carries its own dense test suite).
- Delivery: CI workflows, release train, pre-commit orchestration, gate scripts
  (`scripts/format-matrix.ts` and test, prose-guards scope, docs-index staging logic).
- Tests: suite composition, m0/m1 smoke scope, detection firewall tests, live garbage-input probe of
  all 28 registered detectors.
- Live reproductions run: regex and preset CLI conversions (fail), `bun run vaud formats` (fails),
  garbage-to-detectors probe (clean), synthetic 40-entity heavyweight library timing.

## Omitted surfaces (explicit)

- Security and privacy categories: excluded by operator instruction. Server auth gates, CSP, path
  containment, sandbox origin, and remote-access trust logic were read only as far as needed for
  correctness context; no security findings are reported and none should be inferred from silence.
- Per-adapter escrow field mapping in the nine format folders: relied on the fixture-backed
  Round-Trip Law suite (CI-blocking) plus structural reads; individual field mappings were not
  re-derived from platform specs.
- The React UI component tree and visual behavior: not live-driven this session (the repo's own
  `bun run audit:*` UI harness needs a browser session). UX findings below are code-read and marked
  as such.
- The OPFS pocket-build twin (`src/studio/opfs/`): read for contract shape only.
- `specs/` for future milestones: treated as design intent, not audited as code.

## Evidence standards

Every finding cites file:line at commit `80451e6` and was verified by opening the cited source.
Labels: live-proven (reproduced by running it), unit-proven (existing/observed test behavior), or
code-read. Severity reflects user or maintainer harm at this repo's actual scale, not theory.

## Findings

| ID | Severity | Category | Title | Proof | Plan |
| --- | --- | --- | --- | --- | --- |
| CORR-01 | HIGH | correctness | CLI cannot convert regex or preset files; error message is false | live-proven | 001 |
| GATE-01 | MEDIUM | tests/delivery | `bun test` rewrites FORMAT-SUPPORT.md, so the matrix gate can never fail in CI | live-proven | 002 |
| DOCS-01 | MEDIUM | docs/DX | Front-door docs describe a product that does not exist; generated doc's commands fail | live-proven | 003 |
| UX-01 | MEDIUM | UX/data | Damaged entity files silently vanish from the library | code-read | 004 |
| TEST-01 | MEDIUM | tests | No conversion-wiring coverage for non-character kinds | code-read | folded into 001 |
| PERF-01 | LOW | performance | Library list and portrait serving re-parse full entity JSON including base64 carriers | measured | recorded, no plan |

### [CORR-01] Restore regex and preset conversion through the CLI

- Severity: HIGH
- Evidence:
  - `src/convert.ts:136-161` `convertFile`: same-kind branches exist for `character` (143),
    `lorebook` (148), `persona` (154) only; everything else falls to line 160's
    "different entity kinds" throw.
  - Registry at HEAD registers 5 regex adapters and 4 preset adapters (sillytavern, rolecall, risu,
    marinara, lumiverse regex; sillytavern, rolecall, marinara, lumiverse preset).
  - `src/ui/server-engine.ts:172-177` `handleExport`: the studio path handles every non-character
    kind through a generic `target.fromCanonical(entity)` call, so the engine itself supports these
    conversions; only the CLI wiring never grew.
  - `docs/FORMAT-SUPPORT.md` advertises the regex and preset adapters with a "writes" column.
- Mechanism: `hoplight convert` routes everything through `convertFile` (`src/cli.ts:363`).
  A regex-to-regex or preset-to-preset conversion is same-kind, but no branch matches, so the
  cross-kind error fires with a self-contradictory message.
- Live proof (this session, exit 1 both times):
  - `hoplight convert src/formats/_fixtures/regex/marinara-essentials.json out.json --to sillytavern-regex`
    prints "convert: cannot convert a regex to a regex (different entity kinds)".
  - `hoplight convert samples/sillytavern/presets/plain.preset.json out.json --to rolecall-preset`
    prints "convert: cannot convert a preset to a preset (different entity kinds)".
- Impact: two of five entity kinds are unconvertible from the CLI while the format matrix and CLI
  docs advertise them; the error actively misinforms the user about the cause.
- Systemic boundary: `convertFile`'s per-kind enumeration. Adding an entity kind requires
  remembering to edit this function; that has now been forgotten twice (preset and regex). The
  repair is one generic same-kind path (the shape `handleExport` already proves), not two more
  copy-paste branches.
- Duplicate manifestations: the false error text; matrix advertising; TEST-01.
- Effort: S-M. Fix risk: LOW (mirrors an existing, shipped code path). Confidence: HIGH.

### [GATE-01] `bun test` rewrites docs/FORMAT-SUPPORT.md, defeating matrix:check

- Severity: MEDIUM
- Evidence:
  - `scripts/format-matrix.ts:13,102-128`: module-scope side effects; when `--check` is absent from
    argv, line 127 `writeFileSync(outPath, body)` runs at import time.
  - `scripts/format-matrix.test.ts:7` imports that module, so every `bun test` run (the `test`
    script includes `scripts/`) executes the write with today's date.
  - `package.json` `verify:ci` runs `bun run test` BEFORE `bun run matrix:check`.
- Mechanism: in CI, the test suite regenerates the file from the live registry, then `matrix:check`
  compares the file on disk against a fresh regeneration of the same registry. Both sides are
  freshly generated, so the comparison can never fail. The committed FORMAT-SUPPORT.md is never
  actually gated.
- Live proof: the baseline `bun run test` in this session rewrote `docs/FORMAT-SUPPORT.md`
  (log line: `wrote .../docs/FORMAT-SUPPORT.md (28 adapters)`); the worktree was already dirty with
  exactly this date-only diff before the audit began.
- Impact: (1) the published FORMAT-SUPPORT.md on GitHub can drift stale from the adapter registry
  with CI green, silently voiding the documented gate "matrix:check: FORMAT-SUPPORT.md matches
  registry"; (2) every developer test run dirties the working tree, violating the repo's own
  deterministic-test law (03-CONVENTIONS: no clock) and producing recurring noise diffs.
- Systemic boundary: generator scripts that are both CLI entry points and test-imported libraries.
  Only format-matrix has this defect today (the other hook tests import pure `-core`/`-lib`
  modules), so the repair is local.
- Effort: S. Fix risk: LOW. Confidence: HIGH.

### [DOCS-01] Runnable-now docs teach the unbuilt `vaud` product; generated doc's commands fail

- Severity: MEDIUM
- Evidence (revised after adversarial review; the class is wider than first written):
  - `docs/FORMAT-SUPPORT.md:10-13,80` (auto-generated, committed) tells users to run
    `bun run vaud formats` / `vaud inspect` / `vaud convert` / `vaud validate` and to "Prefer
    `vaud label`". Live proof: `bun run vaud formats` fails with `error: Script not found "vaud"`.
    Template source: `scripts/format-matrix.ts:66-71` (usage block) and `:80` (Notes line).
  - `docs/README.md:12-13` (the documentation front door, reference audience) states "Its engine
    and CLI are called vaud"; `docs/README.md:39` describes reference/ui.md as "`vaud ui`, the
    local server". The shipped CLI is `hoplight` (package.json `bin`).
  - `docs/ROADMAP.md:81-82` lists the SHIPPED M1 exit criteria under `vaud convert / inspect /
    validate ...` and `vaud upgrade` names.
  - `docs/02-ARCHITECTURE.md` (AGENTS.md required reading #2) describes the future
    `vaudeville-studios` repo: `packages/*`, a `vaud` CLI, a Tauri studio; none of it is this
    repo. `docs/03-CONVENTIONS.md` mandates a `fixtures/<format>/<case>/` corpus (the repo uses
    `samples/` plus per-format fixture folders) and `vaud` CLI conventions.
  - Minor same-family defect: the built-in help (`src/cli.ts:126-131`) omits `--strict` from its
    Options list while convert usage lines and docs/reference/cli.md document it.
- Boundary correction (from review): the planning/reference split is NOT wholly unmarked.
  `docs/README.md:50-53` already labels 01/02/03 "the founding planning docs" and points to
  reference/architecture.md as the as-built truth. Three gaps remain: that marking never reached
  AGENTS.md's required-reading table (which presents 02/03 as current); the marking file itself
  carries the stale `vaud` claims above; and the same sentence calls 03-CONVENTIONS "the binding
  code and process conventions", so 03 is simultaneously history and law.
- Deliberately excluded from the finding: `specs/**` uses `vaud` throughout as the design-era CLI
  name for future milestones (a consistent internal vocabulary, flagged for maintainer taste, not
  a defect), and `docs/decisions/ADR-003` records the decision-era name (ADRs are history).
  Engine docblocks mentioning `vaud convert` (three lorebook codecs) are internal comments, noted
  only.
- Impact: a newcomer following the binding reading order, the docs front door, or the format
  matrix learns wrong architecture and pastes commands that fail.
- Systemic boundary: stale product naming in runnable-now surfaces (generator template, docs
  front door, shipped roadmap lines) plus the unpropagated planning-vs-reference marking.
- Effort: S. Fix risk: LOW. Confidence: HIGH.

### [UX-01] Damaged entity files silently vanish from the library

- Severity: MEDIUM (code-read; frequency unknown, mechanism certain)
- Evidence:
  - `src/studio/store.ts:111-113`: `list()` wraps each per-file read in `catch { continue; }`.
  - `src/studio/store.ts:124-146`: any JSON parse failure, schema rejection, kind mismatch, or id
    mismatch throws `StudioReadError("corrupt entity file")`.
  - `src/entities/runtime-schema.ts:37-102`: the character body schema requires all eight group
    objects to exist, so a hand-edited or partially written file fails whole-cloth.
  - No caller surfaces the skip: `/api/studio/list` (`src/ui/server.ts:326-332`) returns only the
    survivors; the library app renders only what it receives.
- Mechanism: a file that exists on disk in the user's studio folder but fails any read check is
  omitted from every listing with no counter, no log the user sees, and no recovery path.
- Impact: the flagship promise is local-first "files on your disk, yours"; a user whose card file
  is damaged (crash mid-edit predating the atomic layer, hand edit, sync conflict, future schema
  change) sees the card silently missing and has no signal that the bytes still exist and are
  recoverable. This contradicts the repo doctrine of reporting storage and validation failures
  honestly, and the fail-closed rule's spirit: fail closed, but visibly.
- Systemic boundary: `StudioStore.list` owns the knowledge of skipped files; the HTTP list route
  and library shelf must carry it through.
- Effort: M. Fix risk: LOW-MEDIUM (touches store contract, its OPFS twin, one route, one app).
  Confidence: HIGH on mechanism, MEDIUM on real-world frequency.

### [TEST-01] No conversion-wiring coverage for non-character kinds

- Severity: MEDIUM (prevention gap that let CORR-01 ship)
- Evidence: `src/m1.convert.smoke.test.ts` exercises `convertFile` for character pairs only;
  `src/convert.test.ts` and `src/cli-io.test.ts` add no regex/preset conversion; the 2,250-test
  wall tests adapters individually (toCanonical/fromCanonical) but never the CLI wiring for regex,
  preset, or persona kinds.
- Impact: a whole entity kind can be (and was, twice) unreachable from the CLI with the suite
  green.
- Fix direction: registry-driven same-kind conversion smoke: for every registered adapter, emit a
  minimal canonical entity of its kind, feed the output back through `convertFile` with itself and
  with one sibling adapter of the same kind. Folded into Plan 001.

### [PERF-01] Library listing and portrait serving re-parse full entity JSON

- Severity: LOW (measured; recorded for the future, no plan)
- Evidence: `src/studio/store.ts:87-114` (`list()` fully reads and zod-parses every entity,
  including any multi-MB base64 `sourceMedia` carrier, to emit a summary);
  `src/ui/server.ts:333-356` + `src/studio/portrait.ts:42-45` (each portrait request re-reads and
  re-parses the full entity, then base64-decodes); `src/ui/apps/library/index.tsx:50` (the shelf
  requests one portrait per card).
- Measurement (this session, synthetic 40-entity library, ~4MB JSON each, Bun 1.3):
  `list()` 88ms total (2.2ms/entity); portrait read 7.7ms each. Cost is linear in total library
  bytes, dominated by escrow carriers; a 500-card heavyweight library projects to roughly 1.1s per
  shelf load plus per-card portrait parses, with matching transient allocation churn.
- Verdict: not worth a plan today; Bun's parser makes the current design acceptable at realistic
  scale. Record: if archivist-scale libraries (1,000+ carrier-bearing cards) become a target, the
  repair is a summary sidecar or lazy wrapper parse at the `StudioStore.list` boundary, not caching
  in the UI.

## Rejected and by-design candidates (recorded)

- `registry.detect` has no try/catch around adapter `detect()` calls, so one throwing drop-in
  detector would break detection for all formats. Probed live: all 28 registered detectors survive
  malformed JSON, truncated PK/PNG bytes, 50k-deep JSON, null, and empty input without throwing.
  The fail-closed doctrine is enforced by convention and holds today; hardening the registry loop
  is optional polish, not a defect. REJECTED (no observed harm; discipline + detection firewall
  tests cover it).
- `convertFile` cross-kind refusal (character to lorebook, etc.): by design and documented; only
  the same-kind gaps (CORR-01) are defects.
- Version-switch system (highest recent churn): read end to end; deliberately fail-closed
  (checksum verification, host allowlist on every redirect hop, size caps, storage-shape rollback
  tripwire, dirty-tree refusal, prior-ref restore). No findings. The one prior tripwire bug was
  already fixed in `733a2e8`.
- Atomic write layer: exclusive create + fsync + rename-with-retry with a documented Windows live
  repro. Sound. Orphaned `.tmp-*.json` files after a hard crash are invisible to `list()` (leading
  dot fails the id policy) and accumulate harmlessly; not worth a finding.
- `saveBundle` comment claims "Clone character shallowly" but mutates the caller's
  `knowledgeRefs` in place (`src/studio/bundle.ts:126-131`); behavior is intended and harmless at
  its single call site. Comment nit only.
- Lore activation engine: loops bounded by `maxLoops`, recursion delays honored, provenance mapped
  to ST world-info.js line ranges, dense test files. No findings at spot-check depth.
- Detection tie-breaking is first-wins on equal scores (registry iteration order = loader's sorted
  folder order). Deliberate score discipline (specific > generic) plus the cross-adapter firewall
  test makes this a non-issue today.

## Systemic themes

1. Wiring lags the open format system. The format layer is genuinely drop-in, but two closed-union
   seams above it (convertFile kinds; the matrix generator's usage text) fell behind reality
   without any gate noticing. Theme owner: registry-driven property tests (Plan 001) and honest
   generators (Plan 002).
2. The `vaud`-era naming survives in runnable-now surfaces, and the planning-vs-reference marking
   that docs/README.md already carries never propagated to AGENTS.md or to its own sentences; one
   generator is also a test import. Plans 002 and 003 restore "docs move with the code" end to
   end.
3. Fail-closed is done well at parse boundaries, but failure VISIBILITY stops at the store layer
   (UX-01).

## Dependency graph

```
001 (CLI kind conversion)     independent
002 (matrix gate integrity)   independent
003 (docs truth alignment)    soft-after 002 (the regenerated matrix should land behind an honest gate)
004 (damaged-entity surfacing) independent
```

Recommended execution order: 002, 001, 003, 004. Until 002 lands, any plan whose broad checks run
`bun run test` must discard the known GATE-01 side-effect diff on docs/FORMAT-SUPPORT.md before
judging its own scope (each plan says so where it applies).

## Adversarial review

A blind fresh-context reviewer (same model family, no shared conversation state) verified every
citation and attempted falsification. Initial verdicts: all six artifacts REVISE; zero CRITICAL
defects; all four finding mechanisms confirmed (CORR-01, DOCS-01 reproduced live by the reviewer
independently; GATE-01 evidence and the worktree's predicted date-only dirt confirmed; every UX-01
citation opened). Five MAJOR and six MINOR objections were raised; all were re-verified against
source by the conductor and every one held, so all were revised into the current artifacts:

- M1/M2/M3: DOCS-01 under-scoped and mis-attributed (docs/README.md already marks the planning
  docs, itself carries `vaud` claims, and calls 03 binding; `vaud label` in the generator Notes
  line and ROADMAP's shipped lines survived the original plan). Finding and Plan 003 rewritten.
- M4: Plan 004 cited a shared notice-component family that does not exist (the only cataloged
  notice is workbench-local; Settings hand-rolls local classes). UI approach rewritten to an
  app-local band.
- M5: Plan 001's scope done-criterion was unsatisfiable before Plan 002 lands (GATE-01 side
  effect). Step 4 and the criterion now handle it explicitly.
- m1-m6: fabricated evidence wording in Plan 002's do-not-touch note, a type the Plan 002 code
  shape missed (`row`), two stale line anchors in Plan 001, a false "AGENTS.md restates the
  testing law" claim in Plan 003, untracked CLAUDE.md cited as authority, and a wrong test
  exemplar in Plan 004. All corrected.

Post-revision status: the conductor holds the revised artifacts SHIPPABLE for their purpose
(planning artifacts; no plan has been executed). The reviewer's full report is preserved in the
PR discussion.
