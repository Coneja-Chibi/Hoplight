# Format: RisuAI

RisuAI is a roleplay client whose native export is a `.charx`: a ZIP archive containing a `card.json`
plus an `assets/` tree, and optionally a `module.risum` bundle. The `card.json` is an ordinary Character
Card **V3**, so vaud reuses the shared Tavern V3 field mapping and the shared CCv3 asset mapping; the zip
container and Risu's extras are handled in the adapter.

- `id: "risu"`, kind `character`, container `.charx` (zip), writes `.charx`.
- Source: `src/formats/risu/index.ts`. Shared card mapping: `src/formats/_shared/tavern-fields.ts`. Shared
  asset mapping: `src/formats/_shared/assets.ts`. Clean-room field-map provenance:
  `design/RISU-CARD-DEEP.md` (extracted from card data, never from Risu source).

## Detection

`detect()` returns `1.0` for a recognizable `.charx`, `0` otherwise. It is a two-step check:

- **Zip magic**: the first two bytes must be `PK` (`0x50 0x4b`). Anything else scores `0` immediately, so
  a bare JSON card is never claimed by this adapter.
- **`card.json` present**: it unzips just the `card.json` entry (a filtered, single-entry inflate) and
  scores `1.0` if that entry exists, `0` if it does not or the archive fails to parse.

`1.0`, the most specific score, because a `.charx` is an unambiguous container: no other adapter reads a
zip. Detection does not inspect the card's spec version or contents beyond the presence of `card.json`.

### Decompression-bomb guard

Every inflate (detection and conversion) runs through `safeUnzip`, which filters out any entry whose
declared inflated size exceeds `MAX_ENTRY_BYTES` (64 MiB) **before** decompressing it, so a crafted
archive cannot OOM the process during detection or conversion.

## Field map

The `card.json` `data` object maps through `_shared/tavern-fields.ts` (`dataToBody`), identical to the
SillyTavern V3 mapping. Media maps separately through `_shared/assets.ts` (`assetsToMedia`).

| Canonical | Risu wire (`card.json`) |
| --- | --- |
| `identity.name` | `data.name` |
| `identity.nickname` | `data.nickname` |
| `identity.description` | `data.description` |
| `identity.characterVersion` | `data.character_version` |
| `persona.personality` | `data.personality` |
| `persona.scenario` | `data.scenario` |
| `prompts.systemPrompt` | `data.system_prompt` |
| `prompts.postHistoryInstructions` | `data.post_history_instructions` |
| `greetings.firstMessage` | `data.first_mes` |
| `greetings.alternateGreetings` | `data.alternate_greetings` |
| `greetings.groupOnlyGreetings` | `data.group_only_greetings` |
| `examples.exampleMessages` | `data.mes_example` |
| `attribution.creator` | `data.creator` |
| `attribution.creatorNotes` | `data.creator_notes` |
| `attribution.creatorNotesMultilingual` | `data.creator_notes_multilingual` |
| `attribution.source` | `data.source` |
| `attribution.createdAt` | `data.creation_date` (ms normalized to seconds, see below) |
| `attribution.updatedAt` | `data.modification_date` (ms normalized to seconds, see below) |
| `discovery.tags` | `data.tags` |
| `media.*` | `data.assets[]` (see [Media and assets](#media-and-assets)) |

Greetings are bare strings on the wire; the canonical `Greeting` carries an optional `title` that Risu
never sets. Fields the canonical model does not have a slot for stay in escrow, they are not in this
table.

### Millisecond dates

Risu writes `creation_date` / `modification_date` in **milliseconds**; the CCv3 spec says seconds. On
import the adapter normalizes any value above `1e11` to seconds (a real seconds timestamp does not exceed
that until roughly the year 5138, so a larger value is unambiguously milliseconds). The original raw
millisecond value is restored verbatim on a same-format export (see round-trip). A cross-format import
that then exports as `.charx` from a `baseCard()` leaves the date in seconds, since there is no raw twin
to restore from.

## Media and assets

`assetsToMedia` maps the CCv3 `data.assets[]` array to canonical `media`:

| CCv3 asset `type` | Canonical `MediaAsset.role` |
| --- | --- |
| `icon` (or `name === "main"`) | `portrait` (marked `primary`) |
| `emotion` | `emotion` |
| `outfit` | `outfit` |
| `pose` | `pose` |
| `background` | `background` |
| `user_icon`, `x-risu-asset`, anything else | `other` |

Each mapped asset takes `label` from the wire `name`, `ref` from the wire `uri`, and `mime` derived from
the wire `ext` (`png -> image/png`, and so on). The first asset resolved to `portrait` becomes
`media.portrait`; the rest go to `media.assets[]`.

**Ref and bytes are keyed differently.** `MediaAsset.ref` holds the card's asset `uri` string, carried
verbatim, whatever scheme Risu used. The actual image bytes are **not** at that ref: they ride escrow as
base64 under `escrow.risu.unmapped.assetFiles`, keyed by **zip path** (the entry name inside the
`.charx`). The adapter never reconciles the uri to the zip path, so resolving a canonical asset to its
bytes requires matching them externally.

## Escrow and round-trip

Everything Risu-specific rides `escrow.risu`:

- `escrow.risu.raw`: the entire original `card.json` (spec magic, `spec_version`, and the full `data`
  block including `extensions`, `assets`, and any `character_book`).
- `escrow.risu.unmapped.assetFiles`: every non-`card.json`, non-`module.risum` zip entry, base64-encoded,
  keyed by zip path.
- `escrow.risu.unmapped.moduleRisum`: the `module.risum` bundle bytes, base64-encoded, if present.
- `escrow.risu.unmapped.hasExecutableContent` / `privileged`: safety flags (see below).

A Risu -> canonical -> Risu round-trip is **data-lossless, not byte-lossless**. On export the adapter
clones `escrow.risu.raw`, overlays the canonical body with `applyBodyToData` (which writes only defined
scalar/text fields, leaving `extensions`, `assets`, and `character_book` in the clone untouched), restores
the raw millisecond dates, then rebuilds the archive: `card.json` is re-serialized with
`JSON.stringify(card, null, 4)` and the files are repacked with `zipSync`. Every mapped field, every
asset byte, and `module.risum` survive verbatim, but because the JSON is re-serialized and the zip is
regenerated, the output `.charx` bytes are not guaranteed to equal the input (indentation, compression,
entry order, and archive metadata are all reproduced by vaud, not preserved from the original).

## Executable content is opaque, never run

Risu cards can carry executable payloads. The adapter flags them on escrow and **never executes them**:

- `hasExecutableContent` is `true` when `extensions.risuai.triggerscript[]` is non-empty, or
  `extensions.risuai.virtualscript` / `extensions.risuai.backgroundHTML` is a non-empty string, or a
  `module.risum` is present.
- `privileged` is `true` when `extensions.risuai.lowLevelAccess === true` (the card requested Risu's
  low-level script API).

These are opaque carriers: they ride escrow as raw data, are surfaced as flags so a consumer can gate on
them, and are reproduced on export without ever being interpreted.

## The embedded character_book

If `card.json` carries `data.character_book`, that book is **not** mapped by the field mapping here;
`dataToBody` ignores it and the raw book rides inside `escrow.risu.raw`. Extraction to a standalone
linked lorebook on **import** is the shared bundle layer's job (`extractCharacterBook` in
`src/convert.ts`), which runs for any CCv2/v3 card, Risu included.

On **export**, Risu re-embeds a referenced lorebook: `fromCanonical(entity, context)` reads
`context.lorebooks` and writes them into `data.character_book` via the shared `embedCharacterBook` helper
(the same one SillyTavern and RoleCall use). Since Risu's `card.json` is CCv3, this is the standard slot
it reads on import, so a cross-format card-with-book conversion into a `.charx` keeps the book. See
[character_book](../concepts/character-book.md) and
[knowledgeRefs](../entities/character.md#cross-entity-links).

## Known gap as a conversion target

Risu is a faithful **source** (a `.charx` reads cleanly into canonical) and a faithful **same-format
round-trip**. One thing is not wired as a conversion **target** for cards from another format:

- **Media is dropped cross-format.** There is no inverse of `assetsToMedia`. `fromCanonical` never
  writes `card.data.assets` from `body.media`, so a card whose media arrived from another format exports
  with no assets. Same-format assets survive only because they ride the `escrow.risu.raw` clone plus the
  escrowed `assetFiles`. Cross-format media (asset bytes and the `uri` scheme) is a Tier B concern,
  documented here as current behavior, not intended design.

## Native lorebook (`risu-lorebook`)

Separate from the `.charx` card above, the Risu family also provides a **standalone lorebook** codec for
Risu's own "export lorebook" file. It is a second codec in the same folder (folders-as-schema), so
`src/formats/risu/index.ts` default-exports `[characterAdapter, lorebookCodec]`.

- `id: "risu-lorebook"`, kind `lorebook`, container `.json` (also `.lorebook`), writes `.json`.
- Source: `src/formats/risu/lorebook.ts`. Provenance: `design/LOREBOOK-FORMATS.md` +
  `design/RISU-CARD-DEEP.md` (facts read from RisuAI's own `characterCards.ts` and
  `process/lorebook.svelte.ts`, interop only).

### Envelope and detection

Risu writes the export as `{ "type": "risu", "ver": 1, "data": loreBook[] }`. `detect()` returns `1.0`
when `type === "risu"` and `data` is an array, `0` otherwise. The envelope is unambiguous, no other format
claims it, and it does **not** grab the `{ entries: {...} }` shape (that is a SillyTavern worldbook, owned
by `sillytavern-lorebook`). The envelope carries no book-level name or settings: in Risu those live on the
character (`loreBookDepth` / `loreBookToken`), not in the exported file, so the canonical book name is
empty and global scan/budget default to `0`.

### Entry field map

Risu-native field names differ from CCv3. `key` / `secondkey` are **comma-joined strings**, not arrays.

| Canonical (`LorebookEntry`) | Risu native (`loreBook`) | Notes |
| --- | --- | --- |
| `id` | `id` | falls back to the array index |
| `title` | `comment` | Risu's `comment` is the entry label |
| `comment` | `comment` | Risu stores the label in both `name` and `comment` on its CCv3 form; mirrored here |
| `content` | `content` | |
| `constant` | `alwaysActive` | the always-on flag, **not** `mode` |
| `triggers` | `key` (CSV) | split on commas, trimmed; `/pattern/flags` decoded, `useRegex` forces regex |
| `secondaryTriggers` | `secondkey` (CSV) | present only when `selective` |
| `triggerMode` | `selective` / `secondkey` | `advanced` when selective or a secondary key exists |
| `caseSensitive` | `extentions.risu_case_sensitive` | Risu's own spelling of "extensions" |
| `probability` | `activationPercent` | 0-100 activation chance |
| `sortOrder` | `insertorder` | Risu treats `insertorder` as CCv3 `insertion_order` (see below) |
| `role` | `role` | `system` / `user` / `assistant` |

`mode` (`multiple` / `constant` / `normal` / `child` / `folder`), `folder` (parent ref for Risu's
entry-folder hierarchy), `loreCache`, and `bookVersion` have no canonical home; they ride escrow and
survive a same-format round-trip untouched. Positions, per-entry scan depth, groups, timing, recursion,
and scan sources are absent from the native format and take canonical defaults.

### Container-invariance contract

The **same** Risu lore must canonicalize identically whether it arrives here as a native envelope or
embedded in a `.charx` (which routes through `_shared/character-book.ts`). Risu's own writer equates the
two field-for-field (`insertion_order: lore.insertorder`, `constant: lore.alwaysActive`, `name` and
`comment` both `= lore.comment`, `keys: lore.key.split(",")`, `case_sensitive` and probability via the
`risu_*` extensions), so every shared field maps to the exact value `character-book.ts` produces. This is
why `insertorder` lands in `sortOrder`, not `priority`. A dedicated test builds the same lore both ways
and asserts the canonical bodies match. The one native-richer field is `role`: Risu's own `.charx` writer
drops it, so it is mapped here rather than discarded (a source asymmetry, not a modeling choice).

### Escrow and round-trip

The whole raw envelope rides `escrow["risu-lorebook"].raw`. `fromCanonical` overlays the canonical body
onto that twin, matched by entry id, and rewrites only the fields whose canonical value changed, so an
unedited entry re-emits byte-for-byte (comma spacing preserved, `mode`/`folder` residue intact). A
from-scratch canonical (a lorebook that arrived from another format, no Risu twin) is written fresh with
`mode: "normal"`. Book-level metadata a native envelope cannot hold (name, description, scan depth, token
budget) is dropped on export, since Risu keeps it on the character, not in the file.

### Known quirk as a conversion target

Placement order does not yet cross to SillyTavern cleanly. Risu `insertorder` maps to canonical
`sortOrder` (correct, and invariant with the embedded path), but the SillyTavern worldbook codec currently
maps its own placement field `order` to canonical `priority` instead of `sortOrder`. So a
`risu-lorebook -> sillytavern-lorebook` conversion writes the insertion order into ST's `displayIndex` and
leaves ST `order` at its default. This is a **pre-existing canonical-model split** between the placement
axis (`insertion_order` / `order` / `insertorder`) and the display/eviction axes, tracked in
`design/LOREBOOK-FORMATS.md` and a `test.todo`, to be reconciled across all lorebook codecs in a focused
pass. Same-format Risu round-trips and the embedded `.charx` path are unaffected.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter (detect, container, escrow, dates, safety flags) | `src/formats/risu/index.ts` |
| Native lorebook codec | `src/formats/risu/lorebook.ts` |
| Shared Tavern V3 field map | `src/formats/_shared/tavern-fields.ts` |
| Shared CCv3 asset -> media map | `src/formats/_shared/assets.ts` |
| Shared keyword `/pattern/flags` decode (character_book + native lore) | `src/formats/_shared/character-book.ts` |
| Embedded character_book extract / re-embed | `src/formats/_shared/character-book.ts`, `src/convert.ts` |
| Clean-room field-map provenance | `design/RISU-CARD-DEEP.md`, `design/LOREBOOK-FORMATS.md` |
