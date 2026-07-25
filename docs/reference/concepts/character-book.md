---
id: reference/concepts/character-book
title: The embedded character_book
audience: dev
summary: A card's embedded character_book is extracted into a standalone linked lorebook on import and re-embedded into the target format's book slot on export.
tags: [concept, character-book, lorebook, bundle, escrow]
related: [reference/architecture, reference/entities/lorebook, reference/entities/character, reference/formats/sillytavern, reference/formats/agnai]
---

# The embedded character_book

A character card can carry its own lorebook. In Character Card V2/V3 this is the `character_book`
object, at `data.character_book` (V3) or `data.extensions.character_book` (a V2 convention). hoplight
treats it as a **linked lorebook**, not an inlined blob: on import it is pulled out into a standalone
`CanonicalLorebook` and linked from the character by id, so the same lorebook can be viewed, edited, and
re-attached independently of the card that carried it.

This is the concrete implementation of the bundle idea in [architecture.md](../architecture.md),
"Bundles: a card plus its lorebook". Source of truth: `src/formats/_shared/character-book.ts`;
orchestration in `src/convert.ts`.

@fig pipeline

## A different dialect from the worldbook file

The embedded `character_book` is **not** the same wire shape as a standalone SillyTavern world info
file (`src/formats/sillytavern/lorebook.ts`). It uses CCv3 spec field names at the entry top level, and
tucks the ST-extended fields into each entry's own `extensions` bag:

| Aspect | Worldbook file | Embedded character_book |
| --- | --- | --- |
| Keywords | `key` / `keysecondary` | `keys` / `secondary_keys` |
| Order | `displayIndex` / `order` | `insertion_order` |
| Regex flag | inline `/pattern/flags` only | inline, plus an entry-level `use_regex` force flag |
| Position | integer | coarse string `before_char` / `after_char` at top level, precise value in `extensions.position` |
| ST extras (depth, role, group, probability, selective_logic, scan sources) | top-level fields | inside each entry's `extensions` bag |

Because the ST-extended fields can appear at the top level **or** in `extensions`, `entryToCanonical`
reads each one from both locations, with `extensions` winning (`character-book.ts:153-235`, the `pick`
helper at `:155-156`). Only the genuinely-identical decoders, selective logic, injection role, and the
character filter, are shared with the worldbook codec via `_shared/lore-enums.ts`; position and keyword
parsing differ per dialect, so they stay local to this file.

### Position is dual-encoded, not degraded

`position` is the one field worth reading closely. On export, `positionToCoarse` writes the CCv3
top-level string (`before_char` for `world` / `before_example` / `prepend_top` / `scene`, `after_char`
otherwise), while `positionToExt` writes the precise value into `extensions.position` in parallel
(`character-book.ts:328-343`). A spec-only reader that ignores `extensions` sees only the coarse floor;
an ST-family reader recovers the exact slot from `extensions.position`. On import, `parseBookPosition`
reads `extensions.position` first and falls back to the top-level string only when extensions carries
none (`character-book.ts:98-122`). The encoding is lossless for any reader that understands
`extensions`; only a naive CCv3-only reader sees the collapsed floor.

## Import: extract at the boundary

When a character imports, a format-agnostic layer looks for an embedded book and, if present:

1. locates it: `findCharacterBook(rawCard)` checks the CCv3 slot, the CCv2 `extensions.character_book`
   convention, and the flat V1 shape, returning the raw book verbatim so the caller controls what goes
   to escrow (`character-book.ts:291-301`).
2. maps it to canonical: `characterBookToLorebook(book)` produces a `LorebookBody`
   (`character-book.ts:240-257`).
3. stashes the raw book in the new lorebook's **own** escrow, keyed `"character-book"`, not the host
   card's format id: `original: { "character-book": { raw: book } }`
   (`extractCharacterBook`, `character-book.ts:308-319`). This is the one contrast with how a card
   stores its own twin under `original.<formatId>` (`architecture.md`, "Escrow"): the dialect, not the
   host format, owns the key, so a lorebook extracted from a SillyTavern card and one extracted from a
   RoleCall card carry the identical escrow shape.
4. links it: `inspectBundle` sets `entity.body.knowledgeRefs = [lorebook.id]` (`convert.ts:40-53`).

### Non-CCv3 dialects override the extractor

The shared extractor above understands the CCv2/v3 `character_book` shape only. A format whose embedded
book is a different dialect provides its own `extractLorebook(entity)` on its `CharacterAdapter`
(`src/core/adapter.ts:69-76`); `inspectBundle` calls that override when present and falls back to
`extractCharacterBook` otherwise (`convert.ts:44-49`). Agnai is the one such case today: it embeds a
native `characterBook` MemoryBook, not a CCv3 book, and reuses its own standalone `agnai-lorebook`
mapper rather than this file (`src/formats/agnai/index.ts:346-351`). The dialect-specific mapper stays in
the format's own folder, layers point inward, and it canonicalizes through the format's standalone
lorebook codec so a book reads identically whether it arrives embedded or as a file. See
[../formats/agnai.md](../formats/agnai.md).

## Export: inline at the boundary

Extraction is shared and format-agnostic; **re-embedding is the target format's job**. A character
adapter that embeds knowledge receives the resolved lorebooks in its `EmitContext.lorebooks`
(`src/core/adapter.ts:28-35`) and calls `embedCharacterBook(data, lorebooks)`
(`character-book.ts`, `embedCharacterBook`), which writes the single book to `data.character_book` and
clears any stale `data.extensions.character_book` fallback. An explicitly resolved empty list clears
both slots; an omitted context means no resolution was performed and leaves the raw twin intact. Four
writers call the shared helper today: SillyTavern, RoleCall, Risu, and Lumiverse. Agnai applies the same
three-way rule to its native `characterBook` slot in its own adapter.

`lorebookToCharacterBook(body, rawBook?)` (`character-book.ts:443-458`, entry-level in `entryToBook`,
`:355-436`) handles two cases:

- **Twin present** (same dialect, e.g. the book was extracted from a `character_book`): it overlays the
  canonical entry onto a clone of the raw twin and re-writes only fields that actually changed from the
  twin's own decode (`changed()`, `:366`), so an unedited book re-emits byte-for-byte and raw-only
  residue (decorators, `vectorized`, unknown extensions) survives.
- **No twin** (cross-format: the lorebook came from a worldbook file, RoleCall, or was authored fresh):
  every field is written from the canonical body alone. This is the path a cross-format
  card-with-book conversion actually exercises.

### Quirks preserved faithfully

- `use_regex` is an **entry-level** flag: it is set only when every keyword in the entry (both trigger
  lists) is a regex, so a single literal keyword is never force-promoted to regex on re-parse
  (`character-book.ts:374-380`).
- If a character references more than one lorebook but the format supports a single `character_book`,
  `lorebooksToCharacterBook` concatenates their entries under the first book's settings and records the
  source boundaries in `extensions.vaud_source_books` (name + entry count per source), so the split is
  recoverable rather than silently dropped (`character-book.ts:480-495`).

## End to end

`convertFile(src, target, input)` in `src/convert.ts` runs the whole path for a same-kind character
conversion: `inspectBundle` extracts any embedded book and links it via `knowledgeRefs`, then
`emitBundle` hands the resolved lorebooks to the target adapter's `fromCanonical` to re-embed
(`convert.ts:96-107`). The CLI's `hoplight convert` calls `convertFile` directly. The two halves also exist
as standalone primitives, `inspectBundle` and `emitBundle`, because the app layer that owns the whole
entity store needs to inspect a card and re-embed its lorebooks as separate steps (a book can be edited
between the two); that layer resolves `knowledgeRefs` against its own store and calls the same
`emitBundle` primitive, so both callers re-embed through identical code (see [../ui.md](../ui.md) for
that layer's specifics). A card with a lorebook converts to another card format with its lorebook
intact either way.

## Source of truth

| Concern | File |
| --- | --- |
| character_book <-> canonical mapper, extract, re-embed | `src/formats/_shared/character-book.ts` |
| Non-CCv3 dialect extractor override (`extractLorebook`), `EmitContext` | `src/core/adapter.ts` |
| Shared lore decoders (selective logic, role, filter) | `src/formats/_shared/lore-enums.ts` |
| Bundle orchestration (`inspectBundle`, `emitBundle`, `convertFile`) | `src/convert.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Interop reference | VAUDEVILLE `apps/rc` character-book mapping (facts only, see `character-book.ts:10-11`) |
