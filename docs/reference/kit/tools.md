---
id: reference/kit/tools
title: Kit content tools
audience: dev
summary: Kit's shared workflow discovery, traversable results, semantic drafts, and Hoplight docs query.
tags: [kit, tools, capabilities, character, lorebook, drafts, results, documentation]
related: [reference/kit, reference/architecture, reference/ui]
---

# Kit content tools

Kit has two different inventories:

1. Runtime tools perform model-requested work.
2. Slash commands navigate the terminal shell.

They are intentionally not mirrors. `/tools` explains content operations to a human, while model
discovery remains part of the tool loop.

## Built lifecycle

The capability foundation and all six canonical content bundles are connected to the live Kit
session:

- `src/entities/capabilities/` owns stable IDs, deterministic search, provider-safe names,
  direct, deferred, or hidden exposure, and the shared provider-discovery descriptor contract.
- `src/entities/lorebook/capabilities/` owns pure lorebook settings and entry update, reorder,
  enable, and remove previews.
- `src/entities/character/capabilities/` owns typed character identity, prompts, greetings,
  metadata, presentation, media, links, variants, settings, and sealed behavior-script previews.
- Persona, preset, standalone regex, and media-pack folders own their corresponding semantic
  settings and lifecycle operations.
- Character base-path and variant edits live in entity-layer operations shared by Kit and the
  Workbench. Semantic field capabilities may target a named variant without exposing a raw patch
  tool.
- The Workbench lorebook session imports the same pure operations for its existing editing paths.
- `src/kit/capabilities/` discovers drop-in capability modules, adapts them to Kit runtime tools,
  joins content and non-content descriptors into one discovery catalog, keeps a complete dispatch
  registry, and exposes only successful search or exact describe selections to later model calls.
- `src/kit/changes/` composes multiple operations for one target into one in-memory draft while
  preserving the baseline, `original` escrow, per-operation warnings, and platform impact.
- `src/kit/results/` owns bounded session-local observations and fail-closed JSON Pointer traversal.
- `src/ui/apps/workbench/capabilities/generated.ts` is generated from the same folders for the
  browser bundle. `bun run capabilities:check` rejects drift.
- The loop asks for a fresh tool snapshot before every model request.
- `capability_find` searches and reveals up to five relevant typed workflows, browses a collapsed
  domain to area to action hierarchy without revealing schemas, or describes and reveals one exact
  operation for the next model step. An existing piece target is optional during discovery. Compact
  calls may omit `action`: a query means search, an exact ID means describe, and other calls browse.
  A flat content `kind` is accepted, and `content/character` browse shorthand resolves to the
  character kind rather than an empty area.
- `studio.<kind>.create` reveals a typed creation workflow for every canonical kind: character,
  lorebook, persona, preset, regex, and pack. Each builds a canonical preview and does not write
  during composition.
- `studio.piece.duplicate` copies one stored piece to a new id. A copy is a create, so it composes a
  preview-only draft and reaches storage through the same create-only compare. It carries `body`,
  `profiles` and `original` forward: a copy that dropped escrow would silently lose every
  platform-native field the canonical model does not express.
- `studio_delete` removes one piece. It is the only Kit tool that destroys canonical content. It carries no discovery descriptor, because
  `capabilities/runtime.ts` refuses any deferred workflow whose effect is `apply`; its sole
  classification is the explicit `delete` entry in the safety-owned trust map, which sits at the
  danger floor. It reads the target before removing it, reports a miss as `stale` without writing,
  and its description states plainly that referencing pieces were not checked. The receipt repeats that
  only for the kinds something can reference (lorebook, pack, regex).
- `studio_transfer` previews a crossing: it serializes one stored piece through another platform's
  adapter and reports what the crossing costs, without writing anything.
- `studio_export` performs the crossing and writes the file into `<studio>/exports`. The model
  supplies no path component at all: it names a piece and a target format, and the filename is
  derived from the piece id plus the adapter's own extension. Containment is therefore structural
  rather than validated, which is what makes a model-callable file write safe. Writes are
  create-only, because an export that silently replaced an earlier one could destroy a file already
  sent to somebody and there is no revision history to recover it from. Binary carriers are refused
  rather than mangled.
- Both call one shared `convertStoredPiece`, so a preview can never report different losses than the
  write that follows it. The conversion graph is imported lazily so it stays out of Kit's cold start.
- `macro_lookup` answers "what does this macro do here, and what is it on that platform?" from the
  engines' own catalogs, so a model never has to guess an equivalent.
- `block_lookup` does the same one level up, for kinds of prompt block: what a tracker or an
  assembler is for, how it is built, what silently goes wrong with it, and an editable starting
  block. `preset_verify` renders a preset through the real engine and reports what did not resolve.
- `folder_search` lists and reads files in a folder the user has shared with Kit, plus the studio
  itself, which is a standing grant rather than something shared. It can do nothing else. Every path is resolved and then checked against the grants, so the resolved path is the one
  used, and that resolved path is reconciled against its real path so a link cannot carry it out of
  the granted tree. Traversal skips symlinked entries, and the walk is bounded in depth and entries.
- `folder_import` is the only door from a shared folder into the studio, and it goes one way. It
  reads a file, parses it through the same three-way branch the studio's own inspect uses, and
  proposes each canonical piece as a create draft. Its effect is `draft`, not `read`, which keeps it
  out of the read-only MCP posture where nothing would ask before applying. A file that carries more
  than one piece drafts all of them or none: a character card's body names its embedded book in
  `knowledgeRefs`, so importing the character alone would leave a reference to a piece that is not
  there. An id already on the shelf is refused rather than replaced.
- `rail_open` puts a preset on the rail beside the conversation, the same view `/rail` opens. It is
  read-only: it changes nothing and so needs no confirmation, which is what makes it usable
  mid-sentence. The rail it opens is still a write surface, and edits made there meet the ordinary
  Gate. It refuses to choose between several matching presets.
- A selected capability creates or composes a preview draft without saving. Its result also carries
  a structured semantic review projection; the loop never parses a draft ID or field diff from
  prose or JSON output.
- A selected read-effect capability returns deterministic analysis and is rejected if its preview
  changes canonical content.
- `change_query` lists drafts, returns one complete accumulated proposal, or validates canonical
  shape and current revision without writing.
- `change_discard` drops an in-memory draft.
- When the model finishes composing a draft, the loop suppresses its final save-or-discard prose
  and deterministically hands the accumulated review to the application-owned Gate. Several draft
  operations can compose before this single handoff.
- `change_apply` pauses at the Gate, compares the stored canonical revision, saves exactly once,
  re-reads the piece, and returns an applied, stale, or failed receipt. Denying the draft review
  dispatches `change_discard` without another model round.
- `docs_query` searches the generated Hoplight documentation catalog, then reads only a
  catalog-declared page or heading section. It cannot accept filesystem paths.
- `studio_read` returns one complete normal canonical piece by default. Outline, JSON Pointer paths,
  offsets, and bounded continuation remain available for genuinely oversized content.
- `result_query` stats, reads, or literally searches an oversized observation through an opaque
  session handle.

The scheduler is live. Read-only batches run concurrently while retaining provider order in the
returned observations. Any batch containing a draft, apply, or unknown effect runs serially. The
loop has model-round, tool-call, elapsed-time, no-progress, and cancellation stops with recovery
guidance. An identical full-piece read repeating in nearby exploration stops after the second
observation instead of consuming the turn. A batch that exceeds the tool budget is not added to
provider history; cancellation records no-op results for declared calls it did not execute, preserving
tool-call/result pairing. The `/tools` command opens a target-aware Panel Deck:
choose a piece, an available semantic area, then an action. Its detail pane names platform
applicability and the preview-before-apply boundary. Compact terminals show one active pane at a
time instead of crushing three columns.

Backstage labels come from the loop state machine, not model prose. Live and sealed traces retain
capability discovery, reads, drafting, preview readiness, one-shot apply, verification, and the final
verified, stale, discarded, failed, cancelled, or stopped receipt. Text emitted alongside a provider
tool call stays in provider history but is not rendered as a conversational transcript line.

## Capability contract

A content capability is a pure semantic operation. It declares:

- a stable dotted ID such as `lorebook.entries.update`;
- content kind, area, action, summary, aliases, and platform applicability;
- a Zod input schema;
- explicit `read` or `draft` effect and direct, deferred, or hidden exposure;
- a concurrency key;
- a preview function that returns a complete canonical entity, exact changes, warnings, and
  platform impact.

Preview never writes. The draft composer rejects a changed target identity or changed `original`
escrow. Read-effect capabilities may also return a structured observation, but their returned entity
must be canonically identical and their change list must be empty. The adapter enforces both rules
before returning analysis.

## Apply and authorization

The safety subsystem owns access classification. It receives exact provider names from the validated
pure-content capability catalog; it does not trust general workflow metadata, runtime effects, or
name prefixes. Content read capabilities remain read-only, content draft capabilities and discard
are preview-only drafts, and applying is a durable write that pauses in the interactive Gate under
the default guarded mode. General workflow tools retain the writable Studio bridge, so discovery
metadata cannot classify them as safe; they remain unknown until a separate safety-owned exact-name
policy grants the appropriate access.

The Studio backend compares and publishes under one per-path write lock. Updates require the
expected revision. Creation uses a separate create-only comparison that refuses an occupied ID
rather than overwriting it or silently minting a sibling. A stale revision or create collision
writes nothing. After a successful publish, Kit re-reads the entity and verifies all
capability-owned canonical fields and non-Studio escrow before reporting `applied`. A save with an
unreadable or mismatched verification result reports failure and is not retried automatically.

The guarded-mode draft Gate is a semantic review card, not a generic tool confirmation and not a
verbal contract with the model. It shows the target and bounded before/after rows. Mouse controls
and `y` or Enter apply; mouse controls and `n`, `d`, or Escape discard. Autopilot and full-control
modes retain their documented write behavior.

## Progressive exposure

The runtime registry contains every adapted capability and deferred workflow tool so dispatch can
resolve a selected operation. Each user turn starts with seventeen direct tools: `studio_list`,
`studio_search`, `studio_read`, `docs_query`, `result_query`, `capability_find`, `change_query`,
`change_apply`, `change_discard`, `macro_lookup`, `block_lookup`, `preset_verify`, `folder_search`,
`folder_import`, `rail_open`, `studio_delete`, and `studio_export`.

`studio_delete` and `studio_export` are direct rather than deferred for a structural reason, not a
convenience one. The
deferred path classifies a tool from its discovery metadata, and the runtime refuses to let that
path describe an `apply` effect at all, so a destructive workflow cannot be discovered into
existence. A tool that must be granted by exact name in the trust map has no discovery descriptor to
hide behind. Routing removal through the draft/apply path instead would require `ChangeDraftMode` to
grow a `remove` arm and `ChangeDraft.proposed` to become optional; that is a change to a core
authority and belongs in its own design pass.

One provider-discovery catalog accepts `content`, `studio`, `transfer`, and `diagnostics` domains.
`transfer` is populated by `studio_transfer`; `diagnostics` is a declared but still empty slot, and
nothing should read its presence in the enum as a shipped workflow.
Content capability metadata projects into that catalog; a non-content `HarnessTool` supplies the
same validated discovery metadata beside its implementation. The live deferred inventory includes
the content catalog and typed creation for all six canonical kinds under `studio/lifecycle`.
Lifecycle, transfer, and diagnostic workflows join the same router instead of adding another
meta-tool. Only restricted pure-content capabilities derive safe read or draft access from catalog
metadata. General workflow tools remain unknown to the Gate until separately classified. Each
creation tool has a separate safety-owned exact-name draft classification. A deferred `apply`
workflow is rejected until its plan supplies an explicit safety-owned access contract, so discovery
metadata cannot quietly downgrade a write. The complete tool registry also rejects duplicate
provider names before dispatch or schema publication.

A catalog search replaces the current deferred set with no more than five deterministically ranked
matches. A collapsed browse lists domains, areas, or the actions under one area without exposing
typed schemas. Describe selects one exact action and replaces the deferred set with that operation.
An optional piece target filters compatible kinds but is no longer required to discover studio-wide
workflows. Hidden descriptors never appear in search, browse, describe, or the provider snapshot.
The deferred set is cleared before the next user turn, while any preview draft remains available to
the direct query, apply, or discard tools.

This keeps a future catalog of more than one hundred semantic operations out of every prompt while
preserving typed inputs for the selected operation.

Creation discovery does not burden the opening prompt with six large schemas. Search reveals up to
five matching tools while an exact describe reveals one; the next provider round receives each selected JSON Schema with field
descriptions and defaults. Character creation documents portrait and additional-media roles.
Persona creation keeps the shelf-only brief distinct from injected first-person content and
documents its portrait. Pack creation documents item IDs, expression labels, resolvable references,
optional MIME types such as `image/png`, and default-face selection. A media ref may be a data URI,
an HTTP(S) URL, or an existing asset or archive reference. Lorebook creation accepts typed initial
entries and triggers. Preset creation accepts typed initial prompt blocks, samplers, and media
inlining settings. Regex creation accepts stored rule data and never executes it.

### Canonical reads and result handles

`studio_read` defaults to the complete canonical entity. A normal piece up to 64,000 characters is
returned in that one observation. `outline` returns the selected value's immediate children as RFC
6901 JSON Pointers. `read` accepts one returned pointer plus character offset and limit, so a model
can traverse genuinely oversized content without guessing a path. Missing and malformed pointers
fail closed.

An unpaged piece over 64,000 characters is stored in the owning Kit session and returned as an
opaque `result-N` handle plus a 4,096-character peek. Other result-producing tools retain the shared
4,096-character inline threshold. `result_query` provides `stat`, bounded `read`, and literal
case-insensitive `search`. Handles contain no path and disappear with the session.
Storage is capped at 24 results, 1,000,000 UTF-8 bytes per entry, and 4,000,000 UTF-8 bytes total.
Oldest entries are evicted first. Character counts remain available for paging. A value too large
for the store remains recoverable through direct `studio_read` offsets. Result reads cap at 12,000
characters and searches at 50 rows.

### Complete draft review

Every operation stores its validated input, changes, warnings, and platform impact. The draft also
retains the aggregate warnings and impact while composing over one immutable baseline.
`change_query list` returns compact counts and states. `show` returns the complete operations,
baseline, proposed entity, warnings, and platform impact; oversized proposals use the same result
handles, and explicit offsets remain available beyond the store cap. `validate` re-parses the
proposed canonical entity and compares the current stored revision without changing draft state or
writing. Operation rollback remains deliberately absent until deterministic replay is specified.

## Character slice

`studio.character.create` is the character creation entry point. A query such as
`create new character` with
`kind: character` reveals it without requiring a pre-existing target. It accepts a safe optional ID
or derives one from the name, then previews a complete minimal canonical card with any supplied
tagline, description, personality, scenario, first message, examples, and tags. Applying uses an
atomic create-only write and a post-create verification read.

The existing-character bundle is:

| Capability | Previewed change |
| --- | --- |
| `character.identity.update` | Name, nickname, tagline, and casting-card identity |
| `character.prompts.update` | Persona prose, prompts, examples, and depth injections |
| `character.greetings.update` | First, alternate, and group-only greetings |
| `character.metadata.update` | Tags, attribution, rating, warnings, and creator notes |
| `character.presentation.update` | Palette, background, field order, spoilers, and links |
| `character.media.update` | Portrait, asset pack, visual kind, and face label |
| `character.links.update` | World, lorebook, and standalone behavior references |
| `character.variants.manage` | Add, remove, rename, mode, and explicit field inheritance |
| `character.settings.update` | Authored dials, bias, variables, and sealed behavior settings |
| `character.behavior-scripts.manage` | Add, overlay, remove, and reorder embedded script data |

All ten are preview-only drafts. Embedded regex and trigger payloads remain data; these operations
never execute them. Platform-native character extension fields that exist only inside `original`
escrow are not editable through this lifecycle. A semantic capability must not rewrite escrow to
implement a canonical edit. Format-owned capabilities can be added only when their adapter provides
a typed, non-escrow semantic home.

## Lorebook slice

The current drop-ins are:

| Capability | Previewed change |
| --- | --- |
| `lorebook.settings.update` | Portable book settings |
| `lorebook.entries.update` | Basic fields on one entry |
| `lorebook.entries.reorder` | Authored entry order |
| `lorebook.entries.enable` | Enabled state for one or more entries |
| `lorebook.entries.remove` | Removal of one or more entries |

`studio.lorebook.create` creates the book and may include initial entries with literal or regex
triggers, activation mode, insertion position, depth, and role. Duplicate, separate entry-create,
trigger-specific update, placement-specific update, and broad bulk-operation capabilities remain
future additions. The Web UI keeps its selection, focus, generated-ID, and undo behavior locally.

## Other canonical bundles

| Kind | Capabilities |
| --- | --- |
| Persona | Create, identity text, structured profile, injection, and presentation |
| Preset | Create, settings and samplers, prompt blocks, and groups |
| Regex | Create, set settings, and stored rule lifecycle |
| Pack | Create, pack settings, media items, and named groups |

These operations share pure entity-layer reducers with the Workbench where the corresponding editor
already exists. Regex and embedded behavior payloads remain sealed data and are never executed by a
capability.

## Macro translation across engines

A preset crossing to another engine is TRANSLATED, not merely reported on. Refusing because one
token has no perfect twin leaves the job unfinished: the author asked for a preset they can load
somewhere else, and prose they wrote is worth more than a macro that was never going to fire.

The engine computes every equivalence and the model explains it, never the reverse. A model
reasoning from macro names gets this confidently wrong, because names collide across engines while
meanings do not follow them.

### Hub and spoke, the same as formats

There is no engine-pair table. Project rule 1 forbids format-to-format conversion for macros exactly
as it does for codecs: five engines would mean twenty directed pairs, so each new engine would
multiply the work rather than add to it.

Instead each catalog declares what its OWN macros mean, using the canonical operations in
`src/core/preset/macros/ops.ts`. Every cross-engine answer is a join on that meaning, computed in
`equivalence.ts`. Adding an engine is one annotation pass and every direction appears for free.

Ops attach per ENTRY, not per name, because one name can mean different things at different argument
counts. RoleCall documents `{{random}}` as 0-100, `{{random::min::max}}` as a range, and three or
more arguments as a pick; annotating the name would wrongly flag the portable three-argument form.

Annotation is deliberately partial. An entry with no op falls back to name matching, which is correct
for the majority of macros that agree across engines. Only divergence needs declaring.

### What a crossing produces

| Verdict | Meaning |
| --- | --- |
| `portable` | Both engines perform the operation; the token is re-spelled in the target's punctuation |
| `collision` | Same NAME, different operation. Left as authored and flagged, never silently kept |
| `absent` | The target has no macro for the operation; removed, with same-family candidates |
| `flatten` | A block the target cannot express; the body is kept and the scaffolding removed |

`{{random::1::10}}` crossing RoleCall to SillyTavern is the worked example: RoleCall declares
`random.range`, SillyTavern declares `random.pick`, and the collision is derived. Nothing states that
pair anywhere.

Block flattening keeps the body and records the dropped condition as a `{{// ...}}` comment, which
the target does support, so the artifact documents its own losses. The first branch is taken, since
without an evaluator there is no basis to choose another.

### The gate that keeps it honest

`unannotatedDivergence()` returns any name several engines share with differing shapes where at least
one side has not declared an op, and a test asserts that list is empty. A silent mistranslation
cannot be introduced by adding an engine and forgetting to declare a meaning.

### Honest limits

- Risu (`[[name]]` CBS) and Agnai (named slots) are not modeled at all; an unmodeled target reports
  `checked: false`, which a caller must render as "unknown" and never as "clean".
- SillyTavern's catalog is the only one with no oracle to verify against, so its annotations are the
  least grounded. RoleCall, Lumiverse and Marinara are machine-checked against their real registries
  by `scripts/macro-oracle`.
- Flag-prefixed tokens (`{{#if}}`, `{{!x}}`, `{{~x}}`) resolve to no name and are never flagged. The
  same character means different things per engine, so stripping it would trade a false negative for
  a false positive.

## Hoplight documentation query

`docs_query` is one direct read-only meta-tool with four actions:

- `browse` returns catalog collections and pages from index metadata only (no Markdown bodies).
  With no collection it lists root collections and root pages; with a collection it lists that
  folder's immediate child collections and direct pages. Limit defaults to 12 and caps at 25;
  offset paginates pages. Collection ids are slash-separated catalog prefixes and never raw
  filesystem paths.
- `outline` returns one page's semantic overview and a collapsed H2 map from the generated index,
  still without loading the Markdown body. Each H2 reports its child count. Passing one returned
  section slug expands only that H2/H3 branch and its semantic summaries.
- `search` lazily loads catalog-declared Markdown, splits it into heading-addressable chunks, and
  ranks full text plus title, short summary, semantic summary, topics, and headings with an
  in-memory BM25-style scorer;
- `read` accepts one returned catalog ID and is the only action that returns authoritative source
  prose. Omit the section slug to read the whole document; provide one returned slug for a targeted
  nugget. Responses stay bounded at 1,000 to 12,000 characters and return a continuation offset, so
  Kit can consume a long whole document over several calls instead of truncating it permanently.

Semantic summaries and topics are navigation aids. They are merged into the generated catalog only
from authored sidecars under `docs/summaries/` that also have a current independent `APPROVE`
receipt under `docs/summary-reviews/` bound to the page source hash and the semantic-summary hash.
Unapproved, revised, blocked, or stale sidecars never become navigation metadata. Discovery of pages
for authoring tools is folder-derived from `docs/`; authors do not hand-edit generated JSON to
register a new page.

New document flow:

1. Add `docs/.../page.md`
2. `bun run docs:summaries:scaffold -- <doc-id>`
3. Author page and section summaries in the sidecar
4. `bun run docs:summaries:stamp -- <doc-id>`
5. `bun run docs:summaries:check -- <doc-id>` (author validation)
6. Independent review: `bun run docs:summaries:review -- <doc-id> APPROVE --notes "..." --reviewer <id>`
7. `bun run docs:index` and commit generated artifacts

Edited document flow: re-read changed ranges, update affected summaries, stamp, author-check, then
new independent review (never self-approve; never stamp without reviewing prose). Global
`docs:summaries:check` fails until every page is `APPROVED` and projections are current.

The model must read source prose before relying on a detail. It should normally read the whole
document around a located answer so nearby qualifications, failure conditions, and current-versus-
planned distinctions remain visible. A section nugget is appropriate for a narrow lookup or limited
context. The shared corpus boundary validates the generated index, resolves only catalog-declared
Markdown beneath `docs/`, and caps each returned page. The index is built lazily on the first docs
query and requires no embedding model, vector database, server, background process, dependency, or
network call. The Studio docs reader and Kit use the same path-containment implementation.

## Verification status

Unit and integration proof covers catalog parity, all discovery domains, compact discovery calls,
progressive exposure, six-kind creation discovery and preview, media schema descriptions, whole-card
reads, bounded oversized result storage, JSON Pointer traversal, complete draft evidence,
read-effect isolation, canonical draft composition, create collision refusal, stale update refusal,
one-save apply, post-save verification, and a full fake-provider rename journey through the real
Studio store.

The lifecycle and transfer surfaces add: a delete that removes nothing on a miss and is classified at
the danger floor, a duplicate that carries `original` escrow and `profiles` onto the copy, structural
export containment against hostile ids and invented extensions, create-only export refusal on an
occupied name, and a RoleCall-preset-to-SillyTavern-preset journey end to end through the real
adapter registry onto a real filesystem.

Macro claims are checked rather than asserted. `scripts/macro-oracle` captures each engine's own
registry into committed fixtures and a parity test proves no catalog claims a macro its engine does
not have. A separate gate proves no shared name diverges in shape without a declared operation.
SillyTavern is the one modeled engine with no oracle, so its annotations rest on transcription alone.

Live terminal verification remains required: none of the above has been exercised in a running Kit
session against a real provider.
