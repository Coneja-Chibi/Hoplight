---
id: reference/concepts/bundles
title: Bundles
audience: dev
summary: How a character card's embedded lorebook splits into two linked canonical entities, a CanonicalCharacter and a CanonicalLorebook joined by knowledgeRefs, extracted on import and re-embedded on export.
tags: [concept, bundle, character, lorebook, knowledgeRefs, character_book]
related: [reference/architecture, reference/entities/character, reference/entities/lorebook, reference/concepts/character-book, reference/concepts/canonical-model, reference/formats/sillytavern, reference/formats/agnai]
---

# Bundles

A character card can embed its own lorebook (`data.character_book` in CCv2/v3). hoplight never keeps that
embedded book as a blob on the character: on import it becomes a second, independent `CanonicalLorebook`,
linked from the character by id (`architecture.md`, "Bundles: a card plus its lorebook"). This page is the
link mechanism itself: how the two entities split apart on import, how they rejoin on export, and the two
different call sites, the CLI and the Studio, that drive it. For the CCv2/v3 wire mapping of the embedded
book, see [concepts/character-book.md](character-book.md). For the wrapper both entities share, see
[concepts/canonical-model.md](canonical-model.md).

@fig lifecycle

## knowledgeRefs: the join field

A `CanonicalCharacter`'s `body.knowledgeRefs?: string[]` holds the linked lorebook id(s), ordered; a target
adapter embeds them on export where its format requires it (`entities/character/schema.ts:341-342`). It is
easy to confuse with `worldName`: `worldName` is the creator's intent to auto-load an external worldbook BY
NAME; `knowledgeRefs` links an embedded book by canonical id (`entities/character/schema.ts:337-338`).

`knowledgeRefs` is a list, not an optional single id, because a character can reference more than one
lorebook: the Workbench's KnowledgeRail lets a creator attach, detach, and reorder library books on the
ref list directly (`ui/apps/workbench/lore/knowledge-refs.ts:5-20`, `attachKnowledgeRef` appends a new id
if not already present). Extraction is narrower than that: importing a card only ever pulls one embedded
book, so `ConvertResult.lorebooks` holds 0 or 1 entries per import pass (`convert.ts:26`). A multi-book
`knowledgeRefs` list is therefore always Studio-authored, never something a single import produces on its
own, and it is exactly what forces the export-side merge described below.

## Import: extract at the boundary

`inspectBundle` (`convert.ts:40-53`) runs once per import:

1. `source.toCanonical(input)` reads the character (`convert.ts:44`). Its embedded book, if any, still lives
   inside `entity.original` at this point, in whatever raw shape the source format used.
2. Extraction picks one of two paths (`convert.ts:47-49`). If the adapter implements `extractLorebook`, an
   optional method on `CharacterAdapter` for a dialect the shared mapper does not understand
   (`adapter.ts:69-76`), that runs. Otherwise the shared
   `extractCharacterBook(primaryOriginalRaw(entity.original))` runs, which understands only the CCv2/v3
   `character_book` shape (`character-book.ts:308-319`).
3. `entity.body.knowledgeRefs = [lorebook.id]` links the two (`convert.ts:51`).

Agnai is the concrete case for step 2's override: its embedded book is a native `characterBook` MemoryBook,
not a CCv3 `character_book`, so its `CharacterAdapter` implements `extractLorebook` itself and reuses its
own standalone lorebook codec (`formats/agnai/index.ts:346-351`; see
[formats/agnai.md](../formats/agnai.md)). Every CCv3-lineage card (SillyTavern, RoleCall, Risu) has no
override and falls through to the shared extractor.

The shared extractor also stashes the raw book in the new lorebook's own escrow, keyed `character-book`, not
the host card's format id, so export can overlay onto that twin even when the book is later written out
standalone (`character-book.ts:308-319`). The full wire mapping (field names, ST-extension handling) is
[concepts/character-book.md](character-book.md), not repeated here.

## Export: re-embed at the boundary

Extraction is shared and format-agnostic; re-embedding is the target adapter's own job. `emitBundle`
(`convert.ts:59-73`) builds an `EmitContext` carrying the resolved `lorebooks` and hands it to
`target.fromCanonical(entity, ctx)`. `EmitContext` is optional and cross-entity, resolved by whichever layer
owns the registry (the CLI, the Studio), never by core (`adapter.ts:22-35`). A character adapter for a
format that embeds knowledge reads `context.lorebooks` and writes it into its own slot; an adapter for a
format with no embedding concept, or one that only links a book by name like ST's `worldName`, simply
ignores the field. The context preserves a deliberate three-way contract: omitted `lorebooks` means the
caller did not resolve the relationship and the adapter leaves its twin alone; a nonempty list replaces
the embedded book; an explicitly empty list removes both possible CCv2/v3 slots. This keeps direct
same-format adapter round trips lossless while making Studio and CLI bundle resolution authoritative
(`convert.ts`, `emitBundle`; `formats/sillytavern/index.ts`, `fromCanonical`).

More than one linked book cannot survive as separate books in a format with a single book slot.
`lorebooksToCharacterBook` (`character-book.ts:480-495`) collapses N books to one: a single ref overlays or
encodes that one book; multiple refs concatenate every book's entries under the first book's settings and
record each source book's name and entry count in `extensions.vaud_source_books`, so the split is
recoverable later rather than silently dropped.

## Two call sites, two lifetimes

`knowledgeRefs` is the same field either way, but what resolves it differs by caller.

**The CLI (`hoplight convert`) is one ephemeral pass.** `convertFile` (`convert.ts:96-115`) calls
`inspectBundle` then `emitBundle` back to back, in memory, for one file in and one file out
(`cli.ts:341`). No lorebook file is ever written to disk; if the target format embeds knowledge the book
rides inside the single output file, and the CLI only reports how many entries carried across
(`cli.ts:371,380-383`). There is no store, so there is nothing to resolve: extraction feeds re-embedding
directly.

**The Studio persists the character and the lorebook as two separate Library entities.** Import
(`handleInspect`, `server-engine.ts:48-86`) runs the same `inspectBundle` the CLI uses and returns both the
character and the extracted lorebook to the client. `POST /api/studio/save-bundle` then writes the lorebook
first, rewrites `knowledgeRefs` for any keep-both rename, and writes the character last
(`studio/bundle.ts:68-118`, `rewriteKnowledgeRefs` at `convert.ts:79-87`). From then on the two live as
independent Library entries: the lorebook can be opened, edited, or attached to another character on its
own. Export (`handleExport`, `server-engine.ts:126-159`) therefore has to resolve `knowledgeRefs` back into
lorebook bodies before it can call `emitBundle`: `resolveLorebooksFromStore` (`server-engine.ts:92-124`)
reads each ref from the store and fails closed, a 422 response naming every missing id, rather than silently
exporting a book-less card. A book the creator switched off (`body.enabled === false`) is omitted rather
than treated as an error; the serialize report names `knowledgeRefs` as not carried so the result is not a
false-success export (`filterEnabledBooks` in `core/lore/book-ops.ts`, report reconciliation in
`convert.ts`).

## Source of truth

| Concern | File |
| --- | --- |
| Bundle extract / link / re-embed orchestration (`inspectBundle`, `emitBundle`, `convertFile`, `rewriteKnowledgeRefs`) | `src/convert.ts` |
| Adapter contract: `EmitContext`, the `extractLorebook` override | `src/core/adapter.ts` |
| Shared CCv2/v3 `character_book` extractor / re-embedder | `src/formats/_shared/character-book.ts` |
| `knowledgeRefs` / `worldName` fields | `src/entities/character/schema.ts` |
| Studio attach/detach/reorder on `knowledgeRefs` (KnowledgeRail) | `src/ui/apps/workbench/lore/knowledge-refs.ts` |
| Studio persistence: save lorebooks then character, keep-both rewrite | `src/studio/bundle.ts` |
| Studio import / export wiring, ref resolution, fail-closed on missing refs | `src/ui/server-engine.ts` |
| CLI convert wiring | `src/cli.ts` |
| Book-level enabled filter | `src/core/lore/book-ops.ts` |
| Non-CCv3 dialect override example | `src/formats/agnai/index.ts` |
