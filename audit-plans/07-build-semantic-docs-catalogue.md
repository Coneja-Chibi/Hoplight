# Plan 07: Build Hoplight's semantic documentation catalogue

> Executor contract: Read this entire plan and `AGENTS.md`. Follow the steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition. Report deviations instead
> of silently improvising. Do not substitute extractive snippets or first-paragraph blurbs for the
> semantic summaries required here.

## Status

- Priority: High
- Category: Documentation architecture, agent retrieval, correctness
- Effort: XL because 86 pages and approximately 585 sections require semantic review
- Risk: Medium; stale or shallow summaries can route the model to the wrong authority
- Depends on: Plan 06 and commit `052be62`
- Planned at: `052be627518754f749ebab2d133fc5d23b112804`, 2026-07-25
- Status: REVIEW VERDICT REVISE
- Implemented: 2026-07-25
- Reviewed at: `052be627518754f749ebab2d133fc5d23b112804` plus the uncommitted implementation, 2026-07-25
- Execution: infrastructure, 86 semantic sidecars, Kit browse/outline, generated projections, and the
  freshness check are present. An independent reviewer produced the current receipts. Automated
  enforcement of current approval remains incomplete.

### Review findings

1. `docs:summaries:check` validates sidecar structure and source hashes but does not require a current
   independent `APPROVE` receipt. A mechanically valid unreviewed or self-reviewed summary passes
   `verify:ci`.
2. `scripts/docs-index.ts` merges any structurally valid sidecar without checking its review receipt.
   Unapproved semantic prose can therefore become runtime navigation metadata.
3. All 86 current receipts use `independent-reviewer-1`. The project owner confirms that this was a
   separate reviewer, so the review phase occurred. The repeated reviewer identity and concise notes
   are not defects by themselves. The remaining limitation is that the repository cannot
   mechanically verify author/reviewer separation or reject a receipt made stale by later edits.
4. The corpus reports 56 non-blocking heuristic warnings: 26 short word-band notices, 24 page-to-H2
   lexical coverage notices, and 6 H2-to-child lexical coverage notices. Review receipts explicitly
   classify the applicable warnings as harmless length-band differences or keyword-matching noise
   after source comparison. They are review-queue signals, not unresolved defects.
5. `verify:ci` does not run `src/kit` tests, so the new browse, outline, repository, and tool contract
   suites are green only when invoked separately.
6. New and edited docs are mechanically detected, but the first failure is usually the generic
   `docs:index:check` stale-artifact message. The summary check then reports missing or stale metadata
   without printing the complete next command sequence.

Review proof:

- Focused semantic docs and Kit tests: 42 passed, 0 failed.
- Full `bun run verify:ci`: 2,292 passed, 1 existing skip, 0 failed.
- Current inventory: 86 approved, 0 missing, 0 stale, 0 invalid, 56 warnings.

This plan returns to `DONE` only after current approval receipts are enforced by both index generation
and CI, Kit tests join the authoritative wall, and missing/stale output gives executor-ready repair
instructions.

## Outcome

Hoplight has a compendium-like documentation catalogue that a model can navigate without searching
the entire corpus:

1. Browse folder-derived collections.
2. Browse pages within a collection.
3. Inspect a page's nested H2/H3 outline.
4. Read substantive semantic summaries of the complete page and every section.
5. Read the exact source page or section before making factual claims.
6. Fall back to the existing local full-text search when hierarchy is not the best route.

The catalogue remains cheap at runtime. It is checked in, loaded lazily, requires no vector server,
and performs no model calls while Kit is running.

Semantic summaries are authored by one serial executor after reading each complete source range. Code
derives the corpus, hierarchy, resumable work queue, hashes, and generated outputs. No page list,
folder list, or section list is hardcoded.

## Why this matters

`docs/generated/docs-index.json` already describes 86 pages and approximately 585 H2/H3 anchors.
`docs_query` can search and read those pages, but it cannot intentionally navigate the corpus from
collection to page to section. Its current page summaries mostly come from frontmatter or the first
paragraph. Anchors have titles but no semantic account of what the full section contains.

Filename search and BM25 answer "where do these words occur?" They do not reliably answer:

- Which page is the canonical authority?
- What does this page cover before the model spends context reading it?
- Which subsection contains the relevant contract?
- Does a long section contain a constraint or failure condition near its end?

A shallow automatic synopsis makes this worse by appearing authoritative while omitting material.
This plan therefore separates semantic authorship from deterministic catalog generation.

## Proven current architecture and authority

### Generated page inventory

- `scripts/docs-index.ts`, `walk`, derives every Markdown page under `docs/`, excluding generated and
  media directories.
- `scripts/docs-index.ts`, `recordFor`, reads frontmatter and emits page metadata plus flat H2/H3
  anchors.
- `docs/generated/docs-index.json` is the machine-readable page catalogue.
- `docs/llms.txt` is the folder-grouped external page listing.
- `src/docs/types.ts` owns the shared wire types.
- `src/docs/corpus.ts`, `parseDocsIndex`, fail-closes malformed catalog data.

### Kit retrieval

- `src/kit/docs/catalog.ts` owns metadata search, Markdown section extraction, chunking, and local
  BM25-style full-text ranking.
- `src/kit/docs/repository.ts`, `createHoplightDocs`, lazily loads the generated index and page bodies.
- `src/kit/tools/docs-query.ts` exposes bounded `search` and `read` actions and refuses arbitrary
  filesystem paths.
- `src/kit/session.ts` injects the repository into the model tool context.

### Existing consumers

- `src/ui/apps/docs/room.tsx` renders pages and the current-page table of contents.
- `src/ui/apps/docs/doc-toc.tsx` consumes flat anchors.
- `src/ui/apps/docs/docs-core.ts` searches page metadata.
- `src/ui/docs-types.ts` and `src/ui/docs-corpus.ts` re-export shared contracts.
- `src/ui/server-docs.test.ts` verifies the HTTP docs boundary.

## Settled decisions

1. Do not run a vector database, embedding server, or background indexing process.
2. Do not summarize at Kit runtime.
3. Do not call an external model from `verify:ci` or any normal build.
4. Do not use first paragraphs, sentence extraction, keyword concatenation, or heading lists as the
   semantic summary.
5. Do not place summaries in one monolithic file. Per-page files make serial progress resumable and
   keep review diffs bounded.
6. Do not let a summary answer override the source. The tool instructs the model to read the source
   section before asserting details.
7. Folders remain schema. Adding a Markdown page or heading automatically creates missing-summary
   work and fails the completeness gate.
8. Generated hashes prove freshness, not semantic quality. Independent review remains mandatory.

## Target architecture

### Authored semantic sidecars

Create one JSON sidecar per documentation page beneath `docs/summaries/`, mirroring the page's path:

```text
docs/reference/kit/tools.md
docs/summaries/reference/kit/tools.json

docs/01-VISION.md
docs/summaries/01-VISION.json
```

`docs/summaries/` contains JSON only, so it does not enter the Markdown corpus. The filesystem layout
is the registry.

Create the load-bearing schema in `src/docs/summary-types.ts`:

```ts
export interface SemanticSummary {
  summary: string;
  topics: string[];
}

export interface SemanticSectionSummary extends SemanticSummary {
  slug: string;
  title: string;
  level: 2 | 3;
  sourceHash: string;
  children: SemanticSectionSummary[];
}

export interface SemanticDocSummary extends SemanticSummary {
  schemaVersion: 1;
  docId: string;
  sourcePath: `docs/${string}.md`;
  sourceHash: string;
  sections: SemanticSectionSummary[];
}
```

The stored hierarchy follows authored heading order. H3 sections nest under the closest preceding H2.
An H3 without an H2 is a validation error. Duplicate generated slugs are a validation error until the
source headings are made unambiguous.

Keep the existing frontmatter-derived `DocRecord.summary` as a concise page description for backward
compatibility. Add the sidecar prose as `DocRecord.semanticSummary`. The two fields have distinct
contracts: `summary` is a short description, while `semanticSummary` is the complete semantic
overview required by this plan. Kit navigation and the generated page catalogue use
`semanticSummary`.

### Summary quality contract

Every summarizer must read the entire page before writing the page summary and the complete bounded
source range before writing a section summary.

Page summaries:

- 140 to 260 words for substantial pages; shorter pages may use 80 to 140 words.
- State the page's purpose and canonical authority.
- Cover every H2 domain, not merely the introduction.
- Include material constraints, invariants, workflows, decisions, failure behavior, and recovery
  guidance when present.
- Distinguish built behavior from plans, examples, historical context, and future intent.
- Avoid unsupported conclusions, sales prose, and line-by-line paraphrase.

H2 summaries:

- 80 to 180 words for substantial sections; 40 to 80 for short sections.
- Cover the complete H2 range, including the scope of nested H3 sections.
- Preserve normative language such as must, never, only, fail closed, and required.
- Name important commands, APIs, files, formats, or state transitions when they define the contract.

H3 summaries:

- 40 to 120 words, proportional to the source.
- Cover the complete H3 range.
- Retain exact distinctions, preconditions, side effects, and failure cases.

Topics:

- Three to twelve short retrieval phrases per page.
- Two to eight per section.
- Use concepts found in the source, including likely alternate user phrasing.
- Do not stuff filenames or repeat the title unless it is itself a retrieval concept.

A summary fails review if it omits a major child section, changes a requirement, blends current and
future behavior, invents an implication, or can be replaced by the first paragraph without losing
meaning.

### Freshness and section boundaries

Create `src/docs/summary-corpus.ts` with pure functions:

```ts
export function splitDocSections(markdown: string): ParsedDocSections;
export function hashDocSource(markdown: string): string;
export function hashSectionSource(section: ParsedDocSection): string;
export function hashSemanticSummary(summary: SemanticDocSummary): string;
export function validateSemanticSummary(
  record: DocRecord,
  parsed: ParsedDocSections,
  candidate: unknown,
): SummaryValidationResult;
```

Hash normalized UTF-8 source with SHA-256 and prefix values with `sha256:`. Normalize line endings to
LF only. Do not trim prose or remove Markdown before hashing.

An H2 hash includes its direct prose and all nested H3 ranges because its semantic summary must cover
their scope. An H3 hash covers only that H3 through the next heading of equal or higher level. The page
hash covers the complete source page after line-ending normalization.

Validation fails on:

- missing or extra page sidecars;
- stale page or section hashes;
- missing, extra, reordered, retitled, re-leveled, or duplicate section records;
- empty summaries or topics;
- invalid word-count bands without an explicit `shortSource: true` exception;
- page summaries that do not name or semantically account for every H2 topic;
- parent H2 summaries that do not account for child H3 topics;
- malformed paths or IDs;
- schema versions other than 1.

The final two coverage checks are lexical warning heuristics, not proof of quality. They must emit a
review queue rather than automatically rewrite summaries.

### Work inventory and resumable single-worker queue

Create `scripts/docs-summaries.ts` with these non-networked modes:

```text
bun run docs:summaries:inventory
bun run docs:summaries:scaffold -- <doc-id>
bun run docs:summaries:stamp -- <doc-id>
bun run docs:summaries:check
bun run docs:summaries:queue -- --target-chars 90000
bun run docs:summaries:review -- <doc-id> <APPROVE|REVISE|BLOCK>
```

Behavior:

- `inventory` reports missing, stale, invalid, and review-warning pages and sections.
- `scaffold` creates only a missing sidecar with empty summaries, current titles, hierarchy, and
  hashes. It refuses to overwrite an existing sidecar.
- `stamp` refreshes hashes only for one explicitly named document after summaries have been updated.
  It prints every changed section and refuses if summaries are empty.
- `check` is read-only and fails on incomplete, stale, or invalid coverage.
- `check` accepts an optional document ID for focused validation.
- `queue` derives work from current docs, preserves a stable page order, and groups pages into
  checkpoint batches near the target source-character size. It emits
  `docs/generated/summary-queue.json`. It never splits one page and never hardcodes collections.
- `review` writes one hash-bound review receipt beneath `docs/summary-reviews/`, mirroring the page
  path. It records the source hash, semantic-summary hash, verdict, reviewer identifier, and concise
  notes. It refuses `APPROVE` without notes and refuses to overwrite a receipt from the same reviewer
  after the underlying summary changed without an explicit new review.

The queue artifact shape:

```ts
interface SummaryBatch {
  id: string;
  sourceChars: number;
  pages: Array<{
    docId: string;
    sourcePath: string;
    sidecarPath: string;
    sectionCount: number;
  }>;
}
```

Each page also has a status projection of `TODO`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `APPROVED`,
`REVISE`, or `BLOCKED`. Status is derived from sidecar completeness, hashes, and review receipts, not
edited by hand. Re-running the queue skips approved pages and resumes the first incomplete page.

### Generated catalogue

Extend `scripts/docs-index.ts` only after every sidecar passes validation. It merges semantic sidecars
into `docs/generated/docs-index.json` and generates `docs/generated/PAGE-INDEX.md`.

Extend shared types:

```ts
export interface DocAnchor {
  text: string;
  slug: string;
  level: 2 | 3;
  summary: string;
  topics: string[];
  children: DocAnchor[];
}

export interface DocRecord {
  // existing fields remain
  semanticSummary: string;
  topics: string[];
  anchors: DocAnchor[];
}
```

`PAGE-INDEX.md` is generated recursively:

```text
collection folder
  child collection
    page title + semantic page summary
      H2 title + semantic summary
        H3 title + semantic summary
```

Folder names and nesting come from source paths. Page and section order comes from the authored
corpus. The generator has no page-specific conditions.

Keep `docs/llms.txt` concise. It should use page summaries but must not expand all section summaries.

### Kit navigation

Create `src/kit/docs/navigation.ts` with pure folder/page/outline projections. Extend `HoplightDocs`:

```ts
export interface DocBrowseOptions {
  collection?: string;
  audience?: "user" | "dev";
  offset?: number;
  limit?: number;
}

export interface HoplightDocs {
  browse(options?: DocBrowseOptions): Promise<DocBrowseResult | null>;
  outline(id: string): Promise<DocPageOutline | null>;
  search(query: string, options?: DocSearchOptions): Promise<readonly DocMatch[]>;
  read(id: string, section?: string, maxChars?: number): Promise<DocReadResult | null>;
}
```

Extend `docs_query` with:

- `browse`: no collection returns root collections and root pages; a collection returns its immediate
  child collections and direct pages. Limit defaults to 12 and caps at 25. Offset paginates pages.
- `outline`: returns one page's semantic overview and complete nested section map.
- `search`: keeps BM25 and also indexes semantic summaries and topics.
- `read`: remains the only action that returns authoritative source prose.

The tool description and output must tell the model: summaries are navigation aids; read the relevant
source section before relying on a detail.

Collection input accepts only catalog-derived slash-separated identifiers. It never becomes a raw
filesystem path.

## Files

### Create

- `src/docs/summary-types.ts`: sidecar and generated semantic-summary wire types.
- `src/docs/summary-corpus.ts`: Markdown boundary parsing, normalization, hashing, and validation.
- `src/docs/summary-corpus.test.ts`: boundary, hierarchy, hash, staleness, and fail-closed tests.
- `scripts/docs-summaries.ts`: inventory, scaffold, stamp, check, review, and dynamic queue generation.
- `scripts/docs-summaries-core.test.ts`: CLI-core behavior without mutating the real corpus.
- `docs/summaries/**/*.json`: one agent-authored sidecar per derived Markdown page.
- `docs/summary-reviews/**/*.json`: one independent, hash-bound review receipt per page.
- `docs/generated/summary-queue.json`: reproducible, resumable work manifest.
- `docs/generated/summary-review.json`: merged review status projection.
- `docs/generated/PAGE-INDEX.md`: complete human- and model-readable catalogue.
- `src/kit/docs/navigation.ts`: collection browse and nested outline projections.
- `src/kit/docs/navigation.test.ts`: root, nested collection, pagination, audience, and outline tests.

### Modify

- `scripts/docs-index.ts`: validate and merge sidecars; emit the page index.
- `package.json`: add the six summary commands and include `docs:summaries:check` in `verify:ci`.
- `src/docs/types.ts`: carry semantic page and nested section metadata.
- `src/docs/corpus.ts`: fail-closed validation for the expanded generated index.
- `src/kit/docs/catalog.ts`: include semantic summaries and topics in retrieval terms.
- `src/kit/docs/repository.ts`: lazy `browse` and `outline` methods that load index metadata only.
- `src/kit/tools/docs-query.ts`: bounded `browse` and `outline` actions.
- `src/kit/tools/docs-query.test.ts`: schemas, rendering, pagination, and path refusal.
- `src/kit/docs/repository.test.ts`: real-corpus navigation and full-text integration proof.
- `src/ui/apps/docs/doc-toc.tsx`: consume nested anchors while preserving the existing UI behavior.
- `src/ui/apps/docs/docs-core.ts`: include semantic topics and summaries in in-app docs search.
- `src/ui/apps/docs/*.test.tsx`: update fixtures and prove nested anchors remain navigable.
- `docs/reference/architecture.md`: document source sidecars, generated projections, and freshness gate.
- `docs/reference/kit/tools.md`: document the four docs-query actions and source-before-claim rule.
- `docs/reference/ui.md`: truthfully describe the expanded Docs Room metadata.
- `audit-plans/README.md`: status and execution record for this plan.

### Do not touch

- `docs/media/`: binary and visual assets are outside the text catalogue.
- `docs/generated/fields.*`: entity field generation has a separate source of truth.
- `src/entities/capabilities/`: docs navigation is a direct read-only meta-tool, not a content mutation.
- Markdown source prose solely to make summary validation easier. Fix the parser or sidecar instead.
- Any provider adapter or model configuration. Summary authoring is an external execution workflow.

## Implementation steps

### Step 1: Establish the sidecar schema and honest section boundaries

Implement types, parsing, normalization, hashes, and validation. Cover frontmatter, fenced headings,
H2/H3 nesting, empty sections, CRLF, duplicate slugs, H3-before-H2, and parent H2 range hashing.

Verify:

```text
bun test src/docs/summary-corpus.test.ts
```

Expected: all new tests pass; a changed final paragraph invalidates the relevant section and page hash.

### Step 2: Build the non-networked authoring CLI

Implement inventory, scaffold, stamp, check, review, and queue generation. Extract testable pure
functions so CLI tests
use a temporary fixture corpus. Refuse bulk stamping and overwrites.

Verify:

```text
bun test ./scripts/docs-summaries-core.test.ts
bun run docs:summaries:inventory
```

Expected: CLI tests pass; real inventory reports every currently missing sidecar without modifying it.

### Step 3: Generate the resumable work queue

Run:

```text
bun run docs:summaries:queue -- --target-chars 90000
```

Inspect that every Markdown page appears exactly once, no page is split, sidecar paths are unique,
ordering is stable, and total source characters equal the inventory total.

Do not manually reorder the output. Change the deterministic batching algorithm if a batch is
pathologically large.

### Step 4: Run the serial semantic-summary worker

Give the single executor:

1. `AGENTS.md`.
2. This complete plan.
3. `docs/generated/summary-queue.json`.
4. The summary quality contract above.

Executor prompt:

```text
Process docs/generated/summary-queue.json serially, one page at a time. Resume at the first page that
is not READY_FOR_REVIEW or APPROVED. Read the complete source page before editing its sidecar. Run the
scaffold command, write a semantic page summary covering every H2, then write every H2/H3 summary from
its complete bounded source range. Preserve normative constraints, current-versus-future
distinctions, commands, failure modes, and recovery. Do not use first-paragraph summaries, extractive
sentence selection, heading-only paraphrases, or claims absent from the source. Add retrieval topics
grounded in the text. Run stamp and focused validation before moving to the next page. Never keep
multiple pages in progress. Stop and report any ambiguous or contradictory source passage instead of
resolving it by invention. After each batch, run the global inventory and report the exact completed,
remaining, and blocked counts.
```

Per page:

```text
bun run docs:summaries:scaffold -- <doc-id>
# agent authors the complete sidecar
bun run docs:summaries:stamp -- <doc-id>
bun run docs:summaries:check -- <doc-id>
```

Expected: every queued page is complete and fresh. Any contradictory source is reported as a
documentation defect and blocks that page rather than being hidden in its summary.

The worker must not write review receipts or mark its own work `APPROVED`. Its terminal state is
`READY_FOR_REVIEW`.

### Step 5: Reconcile the full semantic corpus

Run global inventory and check. Reject:

- missing or duplicate pages;
- missing, reordered, or stale sections;
- shallow summaries;
- summaries that omit child sections;
- summaries that convert recommendations into requirements;
- summaries that describe planned behavior as built;
- topics not grounded in source text.

Resolve source contradictions in the source docs first, then re-summarize affected ranges.

Verify:

```text
bun run docs:summaries:inventory
bun run docs:summaries:check
```

Expected: zero missing, stale, invalid, or blocked records.

### Step 6: Run an independent semantic review

After the serial worker finishes, give the queue and sidecars to an independent reviewer. This may be
the repository owner, Codex, or another model, but it must not be the worker that authored the
summaries. Review 100 percent of page summaries and every H2 summary. Review every H3 summary on:

- security, architecture, decision, Kit, format, engine, and feature specification pages;
- any page with more than eight sections;
- every page that produced an ambiguity report.

For remaining low-risk H3 sections, review at least 25 percent per page, selected deterministically by
hash so the sample cannot be cherry-picked.

Reviewer verdict per page: `APPROVE`, `REVISE`, or `BLOCK`. Record it with:

```text
bun run docs:summaries:review -- <doc-id> <APPROVE|REVISE|BLOCK>
```

A page is not complete without `APPROVE`. The script writes a per-page receipt and the generator
merges receipts into `docs/generated/summary-review.json`. Source or semantic-summary changes
invalidate approval automatically.

### Step 7: Generate and validate catalogue projections

Merge approved sidecars into the docs index, emit the recursive page index, and update `llms.txt`.
Update fail-closed parsing and all UI consumers.

Verify:

```text
bun run docs:index
bun run docs:index:check
bun run docs:summaries:check
```

Expected: generated artifacts are stable on a second run and every indexed summary is approved.

### Step 8: Expose browse and outline through Kit

Implement pure navigation, lazy repository methods, and bounded tool rendering. `browse` and `outline`
must not load Markdown bodies or build the BM25 chunk corpus. `search` may lazily build it as today.

Verify:

```text
bun test src/kit/docs/navigation.test.ts src/kit/docs/repository.test.ts src/kit/tools/docs-query.test.ts
```

Expected: root-to-collection-to-page-to-section navigation works, pagination is deterministic, and
all arbitrary path attempts fail closed.

### Step 9: Update truth-based docs and run the complete wall

Update the named reference docs only after behavior is built. Regenerate all docs artifacts.

Verify:

```text
bun run verify:ci
```

Expected: typecheck, tests, scans, links, generated catalog checks, and capability checks all pass.

## Test plan

### Honest RED cases

- A source sentence added at the end of an H3 makes its H3, parent H2, and page hashes stale.
- A new H2 creates missing-summary work and fails the global check.
- A removed or renamed heading leaves an extra sidecar section and fails closed.
- Duplicate slugs are rejected rather than silently merged.
- An H3 before any H2 is rejected.
- A shallow or empty summary fails the quality-band checks.
- A stale review hash prevents generated-index approval.
- `browse` cannot escape to `../SECURITY.md`.
- `outline` refuses unknown IDs.
- `browse` with no collection does not load page bodies.

### Adjacent regression coverage

- Existing BM25 body-only query still returns `reference/security/remote-access` and the correct
  section.
- Existing `search` and `read` tool contracts remain compatible.
- Docs Room links and current-page navigation remain functional.
- Generated `llms.txt` remains concise and link-valid.
- Packaged docs and loopback docs endpoints accept the expanded index schema.

## Documentation and operations

- Treat `docs/summaries/**/*.json` and `docs/summary-reviews/**/*.json` as authored semantic and
  review metadata, not generated output.
- Treat `docs/generated/PAGE-INDEX.md`, `summary-queue.json`, and `summary-review.json` as generated.
- Add contributor guidance: any source doc edit requires updating and restamping only the affected page
  and sections.
- Document that freshness hashes detect drift but do not certify truth.
- Document the review rotation and approval invalidation rule.
- Never suggest summaries are an authority separate from source Markdown.

## Done criteria

- Every current Markdown page has exactly one semantic sidecar.
- Every H2 and H3 has exactly one correctly nested semantic summary.
- Global inventory reports 100 percent page and section coverage.
- Every sidecar hash matches current normalized source.
- Every page has a current independent approval.
- No summary is derived from first-prose, extractive, or heading-only automation.
- The recursive page index is fully generated from folders, pages, and heading hierarchy.
- Kit can browse collections, inspect outlines, search content, and read authoritative sections.
- Browse and outline stay metadata-only and bounded.
- `bun run verify:ci` passes.
- Independent implementation review returns `SHIPPABLE`.
- `git diff --check` reports no whitespace defects.

## STOP conditions

- A source page contradicts itself materially. Fix or escalate the source; do not choose a side in the
  summary.
- A page's heading hierarchy cannot be parsed deterministically.
- Two pages or headings derive the same catalog identity.
- The executor proposes automatic semantic synthesis as a replacement for agent authorship.
- The summarizer did not read the entire queued page.
- A reviewer cannot distinguish built behavior from plans in the source.
- Completing a summary would require undocumented product knowledge.
- The generated catalogue becomes a second hand-maintained registry.
- Runtime loading would require a model, network, embedding database, or background daemon.
- Any verification gate fails twice without a source-confirmed explanation.

## Rollback and recovery

The feature is additive until `docs:summaries:check` joins `verify:ci`. If execution stops during
population:

1. Keep completed sidecars only if they pass focused validation.
2. Regenerate the work queue; completed fresh pages drop from the remaining queue.
3. Do not enable the global CI gate or expanded index schema until coverage and review are complete.
4. Do not bulk-refresh hashes to silence staleness.

After shipping, rollback the Kit `browse` and `outline` actions independently if necessary while
retaining sidecars and generated indexes. Do not revert source docs or discard approved semantic work.

## Maintenance notes

- A source edit invalidates only its page, affected section, ancestor H2, and approval hashes.
- Sidecars mirror source paths so page moves are explicit Git moves.
- Summary schema changes require a versioned migration, not permissive parsing.
- Regenerate the deterministic queue whenever corpus size changes substantially.
- A cheap serial model is an acceptable executor; it is not an acceptable self-reviewer.
- The page outline plus summaries is for routing. Exact source reads remain mandatory for factual,
  security, format, and behavioral claims.
