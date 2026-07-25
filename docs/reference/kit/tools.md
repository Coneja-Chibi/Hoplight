---
id: reference/kit/tools
title: Kit content tools
audience: dev
summary: The shared semantic capability catalog, progressive model tool exposure, draft previews, and Hoplight docs query.
tags: [kit, tools, capabilities, character, lorebook, drafts, documentation]
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

- `src/entities/capabilities/` owns stable IDs, deterministic search, provider-safe names, and
  direct, deferred, or hidden exposure.
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
  keeps a complete dispatch registry, and exposes only successful search matches to later model
  calls.
- `src/kit/changes/` composes multiple operations for one target into one in-memory draft while
  preserving the baseline and `original` escrow.
- `src/ui/apps/workbench/capabilities/generated.ts` is generated from the same folders for the
  browser bundle. `bun run capabilities:check` rejects drift.
- The loop asks for a fresh tool snapshot before every model request.
- `capability_find` reveals up to five relevant typed operations for the next model step.
- A selected capability creates or composes a preview draft without saving.
- `change_discard` drops an in-memory draft.
- `change_apply` pauses at the Gate, compares the stored canonical revision, saves exactly once,
  re-reads the piece, and returns an applied, stale, or failed receipt.
- `docs_query` searches the generated Hoplight documentation catalog, then reads only a
  catalog-declared page or heading section. It cannot accept filesystem paths.

The scheduler is live. Read-only batches run concurrently while retaining provider order in the
returned observations. Any batch containing a draft, apply, or unknown effect runs serially. The
loop has model-round, tool-call, elapsed-time, no-progress, and cancellation stops with recovery
guidance. The `/tools` command opens a target-aware Panel Deck: choose a piece, an available semantic
area, then an action. Its detail pane names platform applicability and the preview-before-apply
boundary. Compact terminals show one active pane at a time instead of crushing three columns.

Backstage labels come from the loop state machine, not model prose. Live and sealed traces retain
capability discovery, reads, drafting, preview readiness, one-shot apply, verification, and the final
verified, stale, discarded, failed, cancelled, or stopped receipt.

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
escrow.

## Apply and authorization

The safety subsystem owns access classification. It receives exact provider names from the validated
capability catalog; it does not trust arbitrary runtime tool metadata or name prefixes. Catalog
capabilities and discard are preview-only drafts. Applying is a durable write and pauses in the
interactive Gate under the default guarded mode.

The Studio backend compares and publishes under one per-path write lock. A stale revision writes
nothing. After a successful publish, Kit re-reads the entity and verifies all capability-owned
canonical fields and non-Studio escrow before reporting `applied`. A save with an unreadable or
mismatched verification result reports failure and is not retried automatically.

## Progressive exposure

The runtime registry contains every adapted capability so dispatch can resolve a selected tool.
The provider snapshot starts with direct tools only. A catalog search returns no more than five
deterministically ranked matches and reveals only registered deferred capabilities. Hidden
capabilities never enter the provider snapshot.

This keeps a future catalog of more than one hundred semantic operations out of every prompt while
preserving typed inputs for the selected operation.

## Character slice

The canonical character bundle is:

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

Create, duplicate, trigger-specific, placement-specific, and broad bulk-operation capabilities
remain future additions. The Web UI keeps its selection, focus, generated-ID, and undo behavior
locally.

## Other canonical bundles

| Kind | Capabilities |
| --- | --- |
| Persona | Identity text, structured profile, injection, and presentation |
| Preset | Settings and samplers, prompt blocks, and groups |
| Regex | Set settings and stored rule lifecycle |
| Pack | Pack settings, media items, and named groups |

These operations share pure entity-layer reducers with the Workbench where the corresponding editor
already exists. Regex and embedded behavior payloads remain sealed data and are never executed by a
capability.

## Hoplight documentation query

`docs_query` is one direct read-only meta-tool with two actions:

- `search` lazily loads catalog-declared Markdown, splits it into heading-addressable chunks, and
  ranks full text plus title, summary, tags, and headings with an in-memory BM25-style scorer;
- `read` accepts one returned catalog ID and an optional returned heading slug.

The shared corpus boundary validates the generated index, resolves only catalog-declared Markdown
beneath `docs/`, and caps returned prose. The index is built lazily on the first docs query and
requires no embedding model, vector database, server, background process, dependency, or network
call. The Studio docs reader and Kit use the same path-containment implementation. This lets Kit
answer how Hoplight works from authored documentation without exposing arbitrary local file reads.

## Verification status

Unit and integration proof covers catalog parity, progressive exposure, canonical draft
composition, escrow preservation, stale refusal, one-save apply, post-save verification, and a full
fake-provider rename journey through the real Studio store. Live terminal verification remains
required before this milestone is called shippable.
