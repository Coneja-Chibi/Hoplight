# Plan 08: Close the semantic documentation enforcement gaps

> Executor contract: Read `AGENTS.md`, the required repository docs, Plan 07, and this entire repair
> plan before editing. Preserve the 86 authored summaries and their independent review receipts unless
> a source or summary hash genuinely changes. Start with failing tests. Do not weaken a gate.

## Status

- Priority: High
- Category: Documentation correctness, CI enforcement, contributor experience
- Depends on: The uncommitted Plan 07 implementation
- Scope: Enforcement and diagnostics only
- Status: DONE
- Completed: 2026-07-25

## Objective

Make the checked-in semantic catalogue enforce the contract it already claims:

1. Every current authored Markdown page is discovered directly from the `docs/` folder tree.
2. Every page has a valid, current semantic sidecar.
3. Every sidecar has a valid, hash-bound independent `APPROVE` receipt before CI or generated
   navigation metadata treats it as complete.
4. A contributor or agent receives an exact repair workflow when a document is added or edited.
5. The complete Kit test tree runs inside the authoritative `verify:ci` wall.

The existing 56 heuristic warnings are not defects. The independent reviewer already dispositioned
them as harmless word-band differences or lexical matching noise. Do not rewrite summaries merely to
silence those warnings.

## Proven concrete failures

### Failure 1: A new Markdown page is initially invisible to the summary checker

Evidence:

- `scripts/docs-summaries.ts`, `loadIndex`, reads `docs/generated/docs-index.json`.
- `loadCorpus` iterates only `index.docs`.
- Therefore `bun run docs:summaries:check` cannot see a newly added Markdown page until someone first
  regenerates the index.
- In `verify:ci`, `docs:index:check` runs first and stops the `&&` chain with only a generic stale
  artifact message.

Required result:

- Extract folder-derived document discovery and base `DocRecord` construction from
  `scripts/docs-index.ts` into one shared pure module.
- Both `scripts/docs-index.ts` and `scripts/docs-summaries.ts` must consume that module.
- Discovery must remain folders-as-schema. Do not add a central page or folder list.
- Continue excluding generated artifacts, media, semantic sidecars, and review receipts.
- Running the summary check directly after adding `docs/example.md` must report that exact page and its
  missing sidecar without requiring index regeneration first.

Required RED tests:

- A temporary corpus with a new Markdown page absent from its generated index is still discovered by
  the summary inventory.
- Exactly one expected sidecar path is derived for the new page.
- Excluded folders do not become authored pages.

### Failure 2: `docs:summaries:check` does not enforce current approval

Evidence:

- `scripts/docs-summaries.ts`, check mode, calls `checkPage`.
- `scripts/docs-summaries-core.ts`, `checkPage`, validates only the semantic sidecar.
- A fresh sidecar with no receipt, a `REVISE` receipt, a `BLOCK` receipt, or a stale receipt can pass
  the global CI check.
- `derivePageStatus` already recognizes several of these states, but the global check ignores it.

Required result:

- Global `bun run docs:summaries:check` must fail unless every page status is `APPROVED`.
- Focused author validation before review must remain possible through an explicit, documented mode or
  flag. Do not make an unreviewed page appear globally complete.
- A source edit, summary edit, or hash refresh must invalidate the old approval until a new independent
  review is recorded.
- Do not attempt to infer human identity from Git. Enforce the evidence the repository can prove:
  explicit reviewer identity, nonempty notes, `APPROVE`, and exact source and semantic-summary hashes.

Required RED tests:

- Valid sidecar plus no receipt fails the global check as `READY_FOR_REVIEW`.
- `REVISE` and `BLOCK` fail.
- A receipt with an old source hash fails.
- A receipt with an old semantic-summary hash fails.
- A current valid `APPROVE` receipt passes.
- Stamping after a source edit does not resurrect the old approval.

### Failure 3: Review receipt JSON is trusted without runtime schema validation

Evidence:

- `readJsonIfExists<SummaryReviewReceipt>` parses JSON and casts it directly to the TypeScript type.
- `derivePageStatus` checks only verdict and two hashes.
- Receipt schema version, document ID, source path, reviewer, notes, and reviewed timestamp are not
  validated at the read boundary.
- `listExtraSidecars` detects orphan summary sidecars but no equivalent rejects orphan review
  receipts.

Required result:

- Add one shared, fail-closed receipt validator under `src/docs/`.
- Validate schema version, document ID, source path, source hash, semantic-summary hash, verdict,
  nonempty reviewer, nonempty approval notes, and a valid review timestamp.
- Validate binding against the current `DocRecord`, source, and semantic sidecar.
- Malformed JSON must produce a bounded page-specific error, not an unsafe cast or an unexplained
  process crash.
- Detect and fail on extra review receipts just as the current code fails on extra sidecars.

Required RED tests:

- Each malformed or mismatched receipt field is rejected.
- Empty reviewer and empty approval notes are rejected.
- Malformed receipt JSON reports its path.
- A receipt for a removed document is reported as extra.

### Failure 4: The generated index silently accepts or hides unapproved semantic state

Evidence:

- `scripts/docs-index.ts`, `loadSemantic`, validates only the sidecar.
- It never loads the corresponding review receipt.
- `recordFor` merges any structurally valid sidecar.
- Missing or invalid semantic data silently falls back to a first-paragraph/base record.
- The generator can therefore publish unapproved prose, or silently remove semantic navigation, while
  exiting successfully.

Required result:

- Merge semantic summaries into `docs-index.json` and `PAGE-INDEX.md` only when the sidecar and its
  receipt are both valid, current, and `APPROVED`.
- Never silently treat a present invalid, stale, `REVISE`, `BLOCK`, or unreviewed sidecar as approved
  semantic metadata.
- Preserve a workable new-document bootstrap:
  `docs:index` may emit a structural base record for a page that has no sidecar yet, but it must report
  that the page is incomplete, must not merge semantic prose, and the CI checks must remain red.
- `docs:index:check` must fail if any current page lacks approved semantic metadata, even if the
  structural generated files happen to match.
- Error output must name the document ID, source path, status, and next command.

Required RED tests:

- Approved sidecar is merged.
- Missing receipt is not merged and makes check mode fail.
- `REVISE`, `BLOCK`, stale, malformed, and hash-mismatched receipts are not merged.
- A present invalid sidecar is reported rather than silently downgraded.
- A brand-new page can still be structurally indexed so `scaffold` can proceed.

### Failure 5: Generated review status can remain stale

Evidence:

- `docs/generated/summary-review.json` is refreshed by the `review` command.
- Source or summary edits can invalidate a receipt without regenerating that projection.
- Neither `docs:summaries:check` nor `docs:index:check` compares the projection with current derived
  status.

Required result:

- Give review and queue projections one deterministic generation path and one read-only check path.
- CI must fail when checked-in projections differ from current folder-derived documents, sidecars, or
  receipts.
- A stale projection must never continue to report `APPROVED` after source or summary changes.

Required RED tests:

- Editing source changes the derived projection to `READY_FOR_REVIEW`.
- Check mode rejects the formerly approved checked-in projection.
- Regeneration is deterministic and a second check is clean.

### Failure 6: Failure messages do not provide the complete repair workflow

Evidence:

- `docs:index:check` currently says only to regenerate and commit.
- Missing-sidecar output reports only the path.
- Stale page and section output reports hashes but not the author, stamp, focused validation, and
  independent review sequence.

Required result:

Every failing page must print a concise status-specific repair block:

- `TODO`: scaffold the named document, author the whole page and section sidecar, stamp it, run focused
  validation, then obtain independent review.
- `IN_PROGRESS` or invalid: edit the named sidecar, stamp, validate, then obtain independent review.
- Stale: read the changed complete source ranges, update affected summaries, stamp, validate, then
  obtain independent review. Never instruct users to stamp without reviewing the prose.
- `READY_FOR_REVIEW`: print the review command and state that the author must not self-review.
- `REVISE` or `BLOCKED`: print the existing review notes and require correction or escalation.

Use actual document IDs and paths in commands. Keep output bounded when many pages fail, then print the
inventory command for the complete list.

Required RED tests:

- Snapshot or exact-substring tests cover the new-page, edited-page, stale-review, and revise paths.
- The new-page message includes the exact scaffold command.
- The edited-page message does not recommend blind hash stamping.

### Failure 7: The authoritative test wall excludes Kit

Evidence:

- `package.json`, `test`, enumerates several `src/` trees but omits `src/kit`.
- `verify:ci` invokes that test command.
- The new browse, outline, repository, and docs-query tests pass only when invoked separately.
- The omission also excludes the rest of the Kit test suite from the declared complete wall.

Required result:

- Add `src/kit` to the supported `bun run test` command, or add an explicit `test:kit` command to
  `verify:ci`.
- Do not select only the four new tests. The authoritative wall must prevent future Kit tests from
  being silently omitted.
- If a genuinely environment-specific Kit test cannot run in CI, isolate and document that exact test
  rather than excluding the entire tree.

Required RED proof:

- Add a temporary sentinel or inspect Bun's reported file/test totals to prove a test beneath
  `src/kit` is executed by the package-level wall.
- The three new semantic navigation suites run through `bun run test`, not only a focused command.

## Implementation order

1. Add shared folder-derived document discovery and its temporary-corpus tests.
2. Add fail-closed review receipt validation and binding tests.
3. Make global summary completion require current approval.
4. Make the index merge approved semantic metadata only.
5. Add deterministic projection generation and checking.
6. Add actionable status-specific diagnostics.
7. Put all Kit tests in the authoritative wall.
8. Update truth-based reference docs and regenerate generated artifacts.
9. If those documentation edits invalidate semantic hashes, update only the affected summaries and
   send them to an independent reviewer. The implementation agent must not approve its own changes.

## Required documentation

Update at least:

- `docs/reference/architecture.md`
- `docs/reference/kit/tools.md`

Document:

- direct folder-derived discovery;
- the distinction between author validation and globally approved completion;
- hash-bound approval invalidation;
- approved-only index merging;
- the exact new-document and edited-document command flows.

## Acceptance commands

Run all of these:

```text
bun test src/docs/summary-corpus.test.ts ./scripts/docs-summaries-core.test.ts
bun test src/kit/docs/navigation.test.ts src/kit/docs/repository.test.ts src/kit/tools/docs-query.test.ts
bun run docs:summaries:inventory
bun run docs:summaries:check
bun run docs:index
bun run docs:index:check
bun run verify:ci
git diff --check
```

Expected final inventory:

- zero missing, stale, invalid, `TODO`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `REVISE`, or `BLOCKED`;
- every current page is `APPROVED`;
- heuristic warning count may remain nonzero;
- generated projections are current;
- a second generator/check run is clean.

## STOP conditions

- The proposed fix requires a hardcoded document, folder, or section registry.
- The agent proposes treating hashes as proof that prose is correct.
- The agent proposes automatically approving or self-reviewing changed summaries.
- The agent proposes deleting or rewriting the 86 existing summaries merely to silence lexical
  warnings.
- New-document bootstrapping requires manually editing generated JSON.
- Any gate is weakened or removed to make the implementation pass.

## Handoff report

Report:

1. The exact failing tests added before implementation.
2. The shared discovery and review-validation symbols introduced.
3. The output shown for one simulated new document and one simulated edited document.
4. Proof that unapproved summaries cannot enter generated navigation metadata.
5. Proof that `bun run test` now executes `src/kit` tests.
6. Any docs requiring renewed independent review.
7. Complete gate results and remaining limitations.
