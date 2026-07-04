# Concept: the embedded character_book

A character card can carry its own lorebook. In Character Card V2/V3 this is the `character_book` object,
found at `data.character_book` (V3) or `data.extensions.character_book` (V2 convention). vaud treats it
as a **linked lorebook**, not an inlined blob, so the same lorebook can be edited, converted, and
re-attached independently of the card.

This is the concrete implementation of the bundle idea from [../architecture.md](../architecture.md).
Source: `src/formats/_shared/character-book.ts`; orchestration in `src/convert.ts`.

## A different dialect from the worldbook file

The embedded `character_book` is **not** the same wire shape as a standalone SillyTavern world info file.
It uses CCv3 spec field names at the entry top level, and hides the ST-extended fields in each entry's
own `extensions` bag:

| Aspect | Worldbook file | Embedded character_book |
| --- | --- | --- |
| Keywords | `key` / `keysecondary` | `keys` / `secondary_keys` |
| Order | `displayIndex` / `order` | `insertion_order` |
| Regex flag | inline `/pattern/flags` only | inline, plus an entry-level `use_regex` |
| Position | integer | coarse string `before_char` / `after_char` at top level, precise value in `extensions.position` |
| ST extras (depth, role, group, probability, selective_logic, scan sources) | top-level fields | inside each entry's `extensions` bag |

Because the ST-extended fields can appear at the top level **or** in `extensions`, the mapper reads each
one from both locations, with `extensions` winning. Only the genuinely-identical decoders (selective
logic, injection role, and the character filter) are shared with the worldbook codec via
`_shared/lore-enums.ts`; position and keyword parsing differ, so they stay local.

## Import: extract at the boundary

When a character is imported, a format-agnostic layer looks for an embedded book and, if present:

1. maps the `character_book` to a standalone `CanonicalLorebook` (`characterBookToLorebook`),
2. stashes the raw book in that lorebook's **own** escrow (keyed `character-book`), so residue the
   canonical model does not express survives even a standalone write,
3. links it from the character via `knowledgeRefs`.

`findCharacterBook(rawCard)` locates the book across the V3, V2, and flat locations;
`extractCharacterBook(rawCard)` returns the linked `CanonicalLorebook` or `null`.

### Non-CCv3 dialects override the extractor

The shared extractor above understands the CCv2/v3 `character_book` shape only. A format whose embedded
book is a different dialect (Agnai embeds a native `characterBook` MemoryBook, not a CCv3 book) provides
its own `extractLorebook(entity)` method on its `CharacterAdapter`; `convert.ts` calls that override when
present and falls back to `extractCharacterBook` otherwise. The dialect-specific mapper stays in the
format's own folder (layers point inward), and it reuses the format's standalone lorebook codec so a book
canonicalizes identically whether it arrives embedded or as a file. See
[../formats/agnai.md](../formats/agnai.md) for the Agnai case.

## Export: inline at the boundary

Rule 3 of the canonical model is asymmetric: extraction is shared and format-agnostic, but **re-embedding
is the target format's job**. A character adapter that embeds knowledge receives the referenced lorebooks
in its `EmitContext` and writes them into its own book slot. For the CCv2/v3 family that means
`data.character_book`.

`lorebookToCharacterBook(body, rawBook?)` handles two cases:

- **Twin present** (same dialect, e.g. the book was extracted from a `character_book`): it overlays the
  canonical entry onto a clone of the raw twin and re-writes only the fields that actually changed, so an
  unedited book re-emits byte-for-byte and raw-only residue (decorators, `vectorized`, unknown
  extensions) survives.
- **No twin** (cross-format: the lorebook came from a worldbook file, RoleCall, or was authored): it
  full-encodes from the canonical body alone, emitting `keys` / `secondary_keys` / `insertion_order` /
  coarse `position` plus the ST-extended `extensions` bag. This is the path a cross-format card-with-book
  conversion exercises.

### Quirks preserved faithfully

- `use_regex` is an **entry-level** flag, so it is only set when the whole entry is regex; mixed or
  single-regex keywords stay inline as `/pattern/flags` to avoid force-promoting literal keywords on
  re-parse.
- If a character references more than one lorebook but the format supports a single `character_book`, the
  books are merged into one, with the source boundaries recorded in `extensions.vaud_source_books` so the
  split is recoverable, never silently dropped.

## End to end

`convertFile(src, target, input)` in `src/convert.ts` runs the whole path for a same-kind conversion:
extract any embedded book on import, link it via `knowledgeRefs`, and pass it to the target adapter to
re-embed on export. A card with a lorebook converts to another card format with its lorebook intact.

## Source of truth

| Concern | File |
| --- | --- |
| character_book <-> canonical mapper, extract, re-embed | `src/formats/_shared/character-book.ts` |
| Non-CCv3 dialect extractor override (`extractLorebook`) | `src/core/adapter.ts`, e.g. `src/formats/agnai/index.ts` |
| Shared lore decoders (selective logic, role, filter) | `src/formats/_shared/lore-enums.ts` |
| Bundle orchestration (extract, link, re-embed) | `src/convert.ts` |
| Interop reference | VAUDEVILLE `apps/rc` character-book mapping (facts only) |
