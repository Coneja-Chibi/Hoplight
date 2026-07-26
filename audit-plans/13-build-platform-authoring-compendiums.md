# Plan 13: Build complete SillyTavern and Marinara authoring compendiums

> Worker contract: Read `AGENTS.md`, this entire plan, Plan 07, Plan 08, and the current platform
> reference pages before editing. Process one upstream page at a time. Do not write review receipts,
> approve your own summaries, commit, push, or modify application source code.

## Status

- Priority: High
- Category: Kit documentation retrieval, platform interoperability, authoring knowledge
- Depends on: Plans 07 and 08
- Current state: Ready for serial summary worker
- Reviewer after worker: Codex or another reviewer that did not author the summaries

## Objective

Give Kit the same progressive drilldown for SillyTavern and Marinara that it has for Hoplight:

1. Browse from platform to subject to one complete source-derived page.
2. Read a semantic page overview before loading source prose.
3. Expand an H2 or H3 summary as a small located nugget.
4. Read the complete local document around a located answer.
5. Distinguish upstream behavior from Hoplight adapter behavior.
6. Cover the complete selected authoring corpus rather than a few representative concepts.
7. Keep every source pinned, attributed, hash-bound, independently reviewed, and refreshable.

The result is not a verbatim mirror. Each local page is an independently written, semantically complete
reference that preserves all operational meaning relevant to content creation and interoperability.

## Why a serial worker is appropriate

This is large but repetitive work. It requires sustained reading and careful writing rather than broad
architectural judgment. One worker should process pages serially because:

- a page summary must be written only after reading the complete page;
- H2 and H3 summaries must cover their complete bounded ranges;
- terminology and inclusion rules must stay consistent across the corpus;
- one page in progress at a time makes resumption and review deterministic;
- the author must not also be the independent reviewer.

The worker may use a lower-cost model. It must not reduce quality, batch-synthesize unread pages, or claim
completion based on generated hashes alone.

## Existing infrastructure and work to preserve

Do not rebuild the docs system. The repository already has:

- folder-derived discovery under `docs/`;
- semantic sidecars under `docs/summaries/`;
- hash-bound review receipts under `docs/summary-reviews/`;
- generated browse, outline, search, and read metadata;
- author-valid and globally approved validation modes;
- complete-document continuation reads;
- BM25 indexing over source prose and approved semantic summaries.

SillyTavern already has a curated collection under:

```text
docs/reference/platforms/sillytavern/
```

It includes conceptual pages, a complete macro-name catalog for the pinned manual, a complete macro
operator guide, and a source-coverage page. Preserve those pages. Expand or split them only when the
upstream inventory proves that an operational subject is missing or too compressed for reliable retrieval.

Hoplight already has adapter-specific Marinara documentation under:

```text
docs/guide/platforms/marinara.md
docs/reference/formats/marinara.md
docs/reference/platform-native-fields.md
```

Those pages govern current Hoplight implementation. Do not overwrite them with upstream product behavior.
Create the upstream authoring collection under:

```text
docs/reference/platforms/marinara/
```

## Authority model

Every answer must keep three authorities distinct:

1. Platform authoring pages explain what SillyTavern or Marinara means and does.
2. Hoplight format pages explain what the current adapters parse, preserve, edit, and export.
3. Authoring advice explains interactions but cannot invent adapter support.

When upstream behavior and Hoplight implementation differ, both must be stated. The Hoplight format page
governs implementation claims. The platform collection governs upstream meaning.

## Source acquisition and pinning

Use only the official public repositories.

### SillyTavern

- Repository: `https://github.com/SillyTavern/SillyTavern-Docs`
- Existing pin: `70e5e4d3c239253fca4692fe82e3936cb9c4b1b1`
- License: AGPL-3.0
- Do not silently move this pin. If a newer revision is desired, stop and report the exact diff scope
  before changing it.

### Marinara

- Repository: `https://github.com/Pasta-Devs/Marinara-Engine`
- License: AGPL-3.0
- Resolve the exact `main` commit once at worker start and record the full hash and retrieval date.
- Use that hash for every Marinara source link and coverage record in this run.
- Never mix files from multiple Marinara revisions.

Clone or fetch into a temporary directory outside the authored docs tree. Do not commit upstream checkouts.
If network access is unavailable, stop with the exact missing source instead of reconstructing it from
memory or search snippets.

## Inclusion rule

Include a source page when it defines at least one of:

- a creative content type or stored artifact;
- a field authors can create or edit;
- import, export, linking, scope, persistence, or portability;
- prompt assembly, presets, variables, macros, conditionals, or generation controls;
- lorebook entry behavior, search, ordering, activation, budgets, or retrieval;
- character, persona, regex, sprite, gallery, agent, tool, or game-content authoring;
- automation capable of creating or mutating creative content;
- a runtime rule needed to understand what authored content does.

Exclude pages limited to:

- installation, hosting, accounts, providers, or connections;
- ordinary navigation with no content semantics;
- themes or appearance that never travel with authored content;
- release announcements, generic troubleshooting, or contributor workflow;
- transient UI layout with no stored field or behavioral contract.

When a page mixes included and excluded material, preserve the included operational meaning and omit only
the unrelated setup prose. Record the source page in the coverage manifest either way.

## SillyTavern corpus floor

At minimum, reconcile every page already listed in:

```text
docs/reference/platforms/sillytavern/source-coverage.md
```

This includes characters, character design, Author's Note, personas, Data Bank, World Info, prompt
assembly, Advanced Formatting, Context Template, Instruct Mode, Prompt Manager, macros, regex, and
STscript.

Also inventory the pinned repository for additional pages that satisfy the inclusion rule. In particular,
check:

- card import/export and embedded assets;
- Quick Replies and executable automation;
- regex script fields and execution phases;
- persona and lorebook interchange;
- preset subtypes and prompt-manager storage;
- content-relevant extension pages.

Do not treat the existing curated pages as proof that every upstream section is covered. Build the source
inventory first, then reconcile each selected H2 and H3 to a local destination.

## Marinara corpus floor

Inventory the pinned `docs/` tree. At minimum evaluate every page under:

```text
docs/characters/
docs/lorebooks/
docs/prompts/
docs/agents/
docs/data/
docs/extending/
```

Also evaluate content-bearing pages under:

```text
docs/conversation/
docs/roleplay/
docs/game/
docs/appearance/
docs/integrations/
```

The known high-value pages include:

- character creation and editing;
- character and persona fields;
- character colors, stats, sprites, galleries, and import/export;
- lorebook overview, entries, linking, semantic search, token budgets, and import/export;
- prompt macros;
- conditional prompts;
- preset variables;
- preset editor and prompt manager;
- prompt overrides;
- generation parameters;
- agent definitions and custom tools;
- Professor Mari's content actions and approval boundaries.

Do not copy the SillyTavern macro model into Marinara. Marinara differs in names, valid fields,
Conversation-only placement macros, weighted random choices, reply-scoped variables, unknown-name preset
variables, conditional blocks, formatting blocks, agent output, and literal-brace behavior.

## Output topology

Use folders as schema. Do not create a central runtime registration list.

Preferred shape:

```text
docs/reference/platforms/
  sillytavern/
    README.md
    source-coverage.md
    <subject pages>
  marinara/
    README.md
    source-coverage.md
    <subject pages>
```

Create one local page per coherent upstream subject. A source page may map to an existing local page when
that page can remain readable and semantically complete. Split a page when:

- it would exceed the repository's line cap;
- a high-value lookup catalog would be buried inside broad prose;
- independent sections have different update cadence;
- a complete macro, command, field, or operator catalog needs exact enumeration.

Every page needs valid frontmatter:

```yaml
---
id: reference/platforms/<platform>/<slug>
title: <truthful title>
audience: user | dev
summary: <short structural summary>
tags: [platform, <platform>, ...]
related: [...]
---
```

## Completeness contract

A local page is complete only when it preserves every included upstream:

- field and value distinction;
- scope and ownership rule;
- default, fallback, and precedence rule;
- ordering, placement, trigger, and evaluation-stage rule;
- persistence and lifecycle rule;
- import, export, linking, and loss boundary;
- current-versus-planned distinction;
- warning, failure mode, and recovery instruction;
- exact macro, operator, enum, or command name needed for lookup.

Do not:

- summarize from the title or opening prose;
- write a generic overview that omits later sections;
- turn examples into exhaustive enum lists;
- turn recommendations into requirements;
- claim dynamic extension registries are statically complete;
- merge distinct platform concepts because their labels look similar;
- infer Hoplight support from upstream availability;
- execute or resolve imported macro, regex, or automation text.

## Macro and catalog rule

For each platform:

1. Enumerate every built-in macro named by the pinned official source.
2. Record aliases, signatures, arguments, values, side effects, valid fields, lifecycle, and important
   failure modes.
3. Enumerate every documented operator, flag, conditional form, escape rule, legacy marker, and return
   distinction.
4. Separate static documented completeness from extension-provided runtime discovery.
5. Add or update a test that fails if any pinned name or operator disappears.

Marinara's `/macros` and generated Macro Reference are live-engine authorities. SillyTavern's `/? macros`
and field autocomplete are live-installation authorities. Static pages must tell Kit when to defer to them.

## Source coverage manifests

Each platform needs `source-coverage.md` containing:

- full source repository and pinned commit;
- retrieval date and license;
- every evaluated upstream page;
- inclusion or exclusion verdict;
- reason for the verdict;
- local destination page for included material;
- dynamic boundaries that a static compendium cannot prove;
- exact refresh procedure.

No evaluated source may disappear from the manifest. This is the audit trail that distinguishes deliberate
scope from accidental omission.

## Worker procedure

Read and author one source page at a time.

For each upstream page:

1. Read the complete source page.
2. Record its path and headings in the platform source-coverage manifest.
3. Decide its local destination using the inclusion rule.
4. Read the complete current local destination, if one exists.
5. Author or update the local page so every included section is represented.
6. Read the completed local page from start to finish.
7. Scaffold or update its semantic sidecar.
8. Write the page summary only after reading the whole page.
9. Write every H2 and H3 summary from that section's complete bounded range.
10. Add retrieval topics grounded in actual text.
11. Stamp hashes.
12. Run focused author validation.
13. Move to the next page only when the current page is author-valid.

Commands:

```text
bun run docs:summaries:scaffold -- <doc-id>
bun run docs:summaries:stamp -- <doc-id>
bun run docs:summaries:check -- <doc-id> --author
```

For an edited page with an existing sidecar, do not blindly stamp. Read the changed complete source ranges,
update their summaries, then stamp and validate.

## Semantic summary quality

Page summary:

- covers the complete page and every H2;
- states the page's governing distinctions and failure boundaries;
- is useful for deciding whether to read the document;
- does not substitute for the authoritative source.

H2 summary:

- covers direct H2 prose and all nested H3 content;
- preserves commands, conditions, precedence, loss, and recovery;
- distinguishes examples from exhaustive facts.

H3 summary:

- covers the entire H3 range;
- is specific enough for targeted retrieval;
- never repeats only the heading.

Topics:

- use real names, fields, commands, aliases, and failure concepts;
- include uncommon lookup terms;
- do not add synonyms unsupported by source.

## Stop conditions

Stop and report instead of inventing when:

- an upstream source contradicts another page at the same revision;
- docs disagree with source code on a field or macro;
- a page's license or provenance is unclear;
- a required source cannot be fetched;
- the same term has platform-specific meanings that cannot share one statement;
- a source page appears stale relative to the pinned engine;
- a local Hoplight format page contradicts the live adapter code.

Report the exact paths, conflicting claims, and safest next decision.

## Forbidden worker actions

The serial worker must not:

- write `APPROVE`, `REVISE`, or `BLOCK` receipts;
- call `docs:summaries:review`;
- claim independent review;
- edit application source code, format adapters, or runtime tools;
- weaken summary validation or tests;
- regenerate source pins to hide missing entries;
- commit, push, merge, or delete existing user work;
- copy entire upstream pages verbatim;
- process multiple pages without reading each complete source.

Its terminal state is `READY_FOR_REVIEW`.

## Worker handoff report

When finished, report:

- pinned repository hashes and retrieval dates;
- every included and excluded upstream path;
- every created or edited local page;
- every created or edited sidecar;
- exact author-validation results;
- unresolved contradictions or ambiguous sources;
- pages left unprocessed and why;
- confirmation that no review receipts were written.

Do not say "done" without these counts.

## Independent review after worker

The reviewer must not be the summary author.

Review:

- 100 percent of source-coverage rows;
- 100 percent of page summaries;
- 100 percent of H2 summaries;
- 100 percent of macro, operator, field, and command catalog sections;
- every H3 in security, automation, prompt assembly, import/export, and dynamic-registry pages;
- at least 25 percent of remaining low-risk H3 summaries, chosen deterministically.

Reviewer verdict per page:

```text
bun run docs:summaries:review -- <doc-id> <APPROVE|REVISE|BLOCK> \
  --reviewer <identity> --notes "<concrete review evidence>"
```

Shallow coverage, invented claims, missing later sections, stale names, or source-mapping gaps require
`REVISE`. Contradictory source that cannot be safely resolved requires `BLOCK`.

## Final reconciliation

Only after independent review:

```text
bun run docs:summaries:queue -- --target-chars 90000
bun run docs:index
bun run docs:summaries:check
bun run docs:index:check
bun run scan:links
bun run scan:emdash
bun test src/kit/docs/repository.test.ts src/kit/docs/catalog.test.ts src/kit/docs/navigation.test.ts
bun run verify:ci
```

Expected:

- every current authored page is `APPROVED`;
- every generated projection is current;
- every selected upstream page has a coverage verdict;
- complete-document and section reads work for both platforms;
- uncommon macro and field queries resolve to the right platform page;
- all repository gates pass.

## Exact prompt to give the serial worker

```text
Read AGENTS.md, audit-plans/07-build-semantic-docs-catalogue.md,
audit-plans/08-fix-semantic-docs-enforcement.md, and
audit-plans/13-build-platform-authoring-compendiums.md completely. Execute Plan 13's serial worker phase
only. Pin official SillyTavern and Marinara sources exactly as instructed. Inventory the complete selected
authoring corpus, then process one upstream page at a time. Read each complete source before writing an
independently worded local reference and its complete page/H2/H3 semantic sidecar. Preserve every field,
scope, precedence, lifecycle, prompt consequence, import/export boundary, macro/operator name, failure
mode, and current-versus-planned distinction. Keep platform behavior separate from Hoplight adapter
behavior. Run focused author validation for every page. Do not write review receipts, self-approve,
commit, push, modify application code, or copy upstream prose wholesale. Stop on contradictions instead of
inventing. Finish with the exact handoff report required by Plan 13.
```
