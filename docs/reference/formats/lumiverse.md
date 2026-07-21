---
id: reference/formats/lumiverse
title: Lumiverse format
audience: dev
summary: How the Lumiverse adapter family detects, maps, and round-trips ST-shaped character cards with a modules sidecar, plus its regex script and persona codecs, through the canonical model.
tags: [format, lumiverse, character, regex, persona, ccv3, charx]
related: [reference/architecture, reference/entities/character, reference/entities/regex, reference/formats/sillytavern]
---

# Lumiverse format

Lumiverse's character card rides the SillyTavern CCv2/v3 wire shape with its own `extensions` keys, plus
an optional charx-like ZIP container (`lumiverse_modules.json`) that carries expression images, alternate
avatars, alternate field text, world-book ids, and archive-embedded regex scripts as separate files
instead of inline data URIs. hoplight reads and writes both containers through one character adapter, plus two
standalone codecs for Lumiverse's own regex export file and persona object.

The format is one folder, `src/formats/lumiverse/`, whose `index.ts` default-exports three codecs
(`index.ts:265`):

- `lumiverse`, kind `character`, reads PNG, JSON, or the modules ZIP; writes `.json` or `.charx`.
- `lumiverse-regex`, kind `regex`, reads the versioned standalone `lumiverse_regex_scripts` export file.
- `lumiverse-persona`, kind `persona`, reads one account `Persona` object.

There is no dedicated Lumiverse lorebook codec. An embedded `data.character_book` on a Lumiverse card is
extracted and re-embedded by the same shared bundle layer every CCv2/v3-lineage format uses, SillyTavern
and Risu included (`src/convert.ts:40-53`; see [risu.md](risu.md), "The embedded character_book"). This
page documents the character adapter and its modules sidecar in full; the regex and persona codecs are
covered in summary under [Quirks](#quirks). For the canonical field meanings this format maps onto, see
[entities/character.md](../entities/character.md) and [entities/regex.md](../entities/regex.md). For the
hub-and-spoke, escrow, and detection model, see [architecture.md](../architecture.md). For the whole
matrix of formats, see [FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md).

@fig codecs

## Detection

The registry runs every adapter's `detect()` and keeps the single highest score above `0.5`; a tie is
resolved by adapter registration order, not by any content-based tiebreak (`registry.ts:30-41`).

### Character

@fig detect

Three input shapes, checked in this order (`index.ts:82-113`):

**ZIP (bytes starting `PK`, `index.ts:47-49`):**

- `lumiverse_modules.json` present: score `1` (`index.ts:85-86`). This is Lumiverse's own container.
- No modules sidecar but a `module.risum` entry: score `0` (`index.ts:87-89`). Lumiverse cedes a bare
  charx carrying a Risu module to the Risu adapter rather than claim a card it did not author.
- No modules sidecar, no `module.risum`, but `card.json` decodes to a card whose `extensions` carries a
  Lumiverse fingerprint (see below): score `0.96` (`index.ts:90-96`). A charx-shaped archive with neither
  signal scores `0`.

**PNG carrying a `chara`/`ccv3` chunk** (`getVersion`, the same shared PNG reader SillyTavern uses): the
decoded card's `extensions` is checked for a fingerprint, `0.95` if found, `0` otherwise
(`index.ts:102-107`).

**Plain JSON** (V3 `spec`/`data`, V2 `spec`/`data`, or flat `{ name, ... }`): the same fingerprint check,
`0.95` or `0` (`index.ts:108-112`).

A fingerprinted card outbids SillyTavern's generic `0.9` for any recognizable CCv2/v3/flat card, the same
outbidding pattern RoleCall uses against SillyTavern (`sillytavern.md`, "Detection"). Unlike RoleCall's
unconditional `1.0`, Lumiverse only wins when a real Lumiverse signal is present; a plain ST card with no
fingerprint scores `0` here and `0.9` there, so ST reads it.

`hasLumiverseFingerprints` (`modules.ts:317-330`) is true when `extensions` carries any of: an
`expressions` object, an `expression_groups` object, an `alternate_fields` object, an `alternate_avatars`
array, a `lumiverse_image_gen_lora` object, a string `alternate_character_name`, a `world_book_ids` array,
a `databank_ids` array, or a defined `ttsVoice`.

**Unresolved tie on a genuine modules ZIP.** Risu's own `detect()` scores `1` for any zip containing
`card.json`, with no check for `lumiverse_modules.json` (`risu/index.ts:87-95`); it does not reciprocate
Lumiverse's cede on `module.risum`. So a real Lumiverse export (`card.json` plus `lumiverse_modules.json`,
no `module.risum`) scores `1` on both adapters. The registry's tie-break is iteration order over its
internal map (`s > score`, strictly greater, `registry.ts:30-41`), populated by the filesystem glob scan
in `loadFormats` (`loader.ts:20-37`). This page does not verify what order that scan runs in, so which
adapter wins this specific tie is not confirmed here.

### Regex

`lumiverse-regex` claims only its own self-identifying envelope: `type === "lumiverse_regex_scripts"` and
an array `scripts`, score `1` (`regex.ts:360-365`). A bare `scripts` array with no envelope, or an
envelope with the wrong `type`, scores `0`. No other adapter reads this shape, so there is no contest.

### Persona

`lumiverse-persona` claims an object carrying `name`, `description`, and both `subjective_pronoun` and
`objective_pronoun` as strings, score `0.95` (`persona.ts:20-38`). The same object also satisfies
SillyTavern's flat/V1 character heuristic (`name` plus `description`), which bids `0.9`; the pronoun pair
is the distinct signal that outbids it, the same pattern SillyTavern's own persona codec uses against its
own character adapter (`sillytavern.md`, "Persona codec").

## Field map

### Character

The base card mapping is the shared Tavern `data` <-> canonical mapping in
`src/formats/_shared/tavern-fields.ts`, documented in full in [sillytavern.md](sillytavern.md#field-map).
Lumiverse cards use the identical `dataToBody` / `applyBodyToData` functions, so nothing here repeats that
table. `data.assets[]` maps through the same shared CCv3 asset mapping (`_shared/assets.ts`) documented in
[risu.md](risu.md#media-and-assets), passing `"lumiverse"` as the dialect. The only dialect-sensitive
choice, `emotion` vs `expression` wire typing, resolves identically to SillyTavern's default (`emotion`;
only the `rolecall` dialect differs, `assets.ts:147-148`).

Everything Lumiverse-specific lives under `data.extensions` and is native (first-class, not escrow), but
almost none of it is lifted onto a canonical body field. Two things ARE bridged:

| `extensions` field | Bridge | Notes |
| --- | --- | --- |
| `alternate_fields` (`description`/`personality`/`scenario` rows) and `alternate_avatars` | `body.variants[]` | Rows sharing a `label` merge into one `CharacterVariant`; see [Variants bridge](#variants-bridge). `variants-bridge.ts:24-83` |
| `expressions.mappings`, `expression_groups.*`, `alternate_avatars[].image_id`/`path` when resolved to a data URI | `body.media.assets[]` (role `emotion` or `other`) | Only entries that resolve to a `data:` URI become media assets; a bare archive path with no matching file stays extensions-only. `modules.ts:104-108,117-127,148-150` |

Everything else on `extensions` rides through as native data on the `original.sillytavern` twin, editable
only through the Workbench's Lumiverse native-fields panel or its raw-extensions editor, never lifted to a
canonical field: `alternate_character_name`, `lumiverse_image_gen_lora`, `ttsVoice`, `world_book_ids`,
`databank_ids` (`ui/apps/workbench/platforms/lumiverse.ts:12-76`).

**Archive-embedded regex is not `behaviorRefs`.** A modules ZIP's `regex_scripts[]` decodes through the
real typed regex codec (`decodeLumiverseModuleRegexScripts`, not an opaque blob) and lands at
`extensions._lumiverse_modules_regex_scripts` as `RegexRule[]`, but the character adapter never lifts that
array onto `CharacterBody.behaviorRefs`. It stays native extensions data, not a canonical link
(`coverage.ts:22-27`, `modules.ts:158-161,276-283`).

#### Variants bridge

`altsToVariants` (`variants-bridge.ts:24-83`) groups `alternate_fields` rows and `alternate_avatars`
entries by shared `label` into one `CharacterVariant` per label: `description` maps to
`overrides.identity`, `personality`/`scenario` to `overrides.persona`, the avatar to
`overrides.media.portrait`. Export (`variantsToAlts`, `variants-bridge.ts:94-126`) walks `body.variants[]`
and emits a row per field the variant actually overrides, keyed back by the variant's `id`.
`applyVariantsToExtensions` (`variants-bridge.ts:136-144`) then overwrites `alternate_fields` and
`alternate_avatars` wholesale from the current `body.variants`, deleting the key entirely when no variants
remain; it does not merge row by row against what was there before.

### Modules sidecar

The modules ZIP is a second container layered on the same card. `rehydrateCardData` (`modules.ts:76-166`)
merges `lumiverse_modules.json` into a clone of `data.extensions` on import:

| Modules field | Extensions field it merges into | Media asset produced |
| --- | --- | --- |
| `expressions.{enabled,defaultExpression,mappings}` | `expressions` | one `emotion` asset per mapping entry that resolves to a data URI |
| `expression_groups.groups` (per character name) | `expression_groups` | one `emotion` asset per resolved label, labeled `<charName>:<label>` |
| `alternate_fields` | `alternate_fields` | none (feeds the variants bridge, not media) |
| `alternate_avatars[]` | `alternate_avatars` | one `other` asset per resolved avatar |
| `world_books` | `_lumiverse_modules_world_books` | none |
| `regex_scripts` | `_lumiverse_modules_regex_scripts` (decoded `RegexRule[]`) | none |

`resolveAssetRef` (`modules.ts:52-58`) turns an archive path into a `data:` URI when the file exists in
the ZIP and is under 64 MiB (`MAX_ASSET`, `modules.ts:18`); a missing or oversized file is left as the
bare archive-path string, so it never becomes a media asset and stays visible only as raw extensions text.

## Escrow and round-trip

Two escrow buckets carry one Lumiverse character: `original.sillytavern` (the ST-shaped card twin, same
mechanism [sillytavern.md](sillytavern.md#escrow-and-round-trip) describes) and `original.lumiverse` (the
modules-container twin), both under the canonical wrapper's `original` field (`canonical.ts:39-51,80`)
(`index.ts:161-175`):

```
original.sillytavern = {
  raw:      <the card envelope, with data.extensions already merged with the modules sidecar>,
  unmapped: { variant: "v2" | "v3" | "flat" },
  sourceMedia: { b64, mime: "image/png" }   // only for a PNG, non-ZIP input
}
original.lumiverse = {
  raw: {
    modules:  <the parsed lumiverse_modules.json, or null if the input had none>,
    fromZip:  true | false,
    files:    { "<zip path>": "<base64 bytes>", ... }   // every non-card.json, non-modules.json entry
  }
}
```

The `sillytavern` twin's `raw.data.extensions` is the HYDRATED extensions bag: archive paths already
resolved to data URIs where possible, the same object the canonical body's variants and media were
derived from. It is not a byte-identical copy of the input `card.json`'s `extensions` when the input was a
ZIP. The `lumiverse` twin carries the unhydrated modules pointers plus every other archive file, base64,
keyed by zip path (`index.ts:150-154,168-174`); this is what lets export re-derive a working archive.

On export, `fromCanonical` (`index.ts:179-258`):

1. Clones the base card data from `original.sillytavern.raw` (its `.data` for v2/v3, the object itself
   for flat/v1), overlays it with `applyBodyToData` and `applyMediaToTavernData(..., "lumiverse")`, and
   re-embeds any linked lorebook via `context.lorebooks` (`index.ts:186-194`).
2. Merges `extensions`: the twin's raw `extensions` first, then the canonical-derived `extensions`
   spread on top, current values winning on key collision (`index.ts:196-202`).
3. Folds `body.variants` back onto that merged `extensions` via `applyVariantsToExtensions`
   (`index.ts:204-207`), see [Variants bridge](#variants-bridge). This runs last, so an edited variant
   always overwrites whatever `alternate_fields`/`alternate_avatars` the twin or step 2 produced.
4. Picks the container: the caller's `requestedExtension` wins if given, otherwise the source container is
   preserved, a ZIP twin re-emits `.charx`, a non-ZIP twin re-emits `.json` (`index.ts:223-227`).
5. For a `.charx` emit, `packModulesFromExtensions` (`modules.ts:200-286`) rebuilds
   `lumiverse_modules.json` from the merged `extensions`. Any `data:` URI is materialized back to an
   archive file under a deterministic per-field path scheme: `assets/other/image/expr_<label>.<ext>` for
   expressions, `assets/other/image/exprg_<char>--<label>.<ext>` for expression groups,
   `assets/icon/image/<id>.<ext>` for avatars (`modules.ts:216,235,263,292-314`); an existing archive-path
   reference is kept as-is. `regex_scripts` re-encodes through the typed codec
   (`encodeLumiverseModuleRegexScripts`), reproducing the original wire byte-for-byte when unedited
   (`modules.ts:276-283`). Every original zip entry not referenced by any extensions field still rides
   through untouched, since re-packing starts from the twin's own `files` map (`modules.ts:206`).
6. Emitting `.json` from a ZIP twin can refuse rather than silently drop archive content
   (`index.ts:243-255`): the guard checks whether the twin's ORIGINAL archive carried any file besides
   `card.json` and whether the current extensions still pack into a non-empty modules object. It is a
   conservative check, not an exact one; it does not confirm that some specific field in the current
   payload still points at an un-inlined archive path, so a leftover file from the original archive can
   trip the refusal even after every extensions field referencing it was edited away.

A same-format Lumiverse round-trip through the plain-JSON path is field-for-field lossless when unedited:
a bare archive-path reference has no ZIP `files` to resolve against, so `resolveAssetRef` returns it
unchanged (`modules.ts:52-58`). A same-format round-trip through the ZIP path is data-lossless, not
byte-lossless: asset bytes are unchanged for untouched assets, but the archive path each one lives at is
regenerated from the naming scheme above rather than preserved verbatim from the input archive.

A cross-format conversion carries only the canonical body: both the `sillytavern` and `lumiverse` twins,
every `extensions` key with no canonical home, and every archive file stay in escrow and are not copied
into another app's file (`architecture.md`, "Escrow: lossless round-trips, contained cross-format loss").

## Quirks

- Zip decompression bounds. Every Lumiverse ZIP inflate, detection and conversion both, runs through
  `unzipBounded` with `CARD_ARCHIVE_BOUNDS`, the same bound Risu and Backyard's `.byaf` use: 96 MiB
  archive cap, 512 entries max, 64 MiB per entry, 96 MiB aggregate inflated (`archive.ts:29-36`,
  `index.ts:23,43-45`).
- Regex codec (`lumiverse-regex`). Two real wire shapes converge on the same canonical `RegexRule`: the
  full account `RegexScript` the versioned export file carries (`target` as an array, plus
  `user_id`/`script_id`/`folder`/`pack_id`/`preset_id`/timestamps, all sealed to `extras` since none has a
  canonical home) and the reduced shape actually embedded in a character archive's `regex_scripts[]` (no
  id or those account fields, `scope_id` always `null`, and `target` a single string rather than an array)
  (`regex.ts:1-32,110-145,252-270`). `placement` decodes to canonical `phases`; `memory` is a
  Lumiverse-only phase among the format family (`regex.ts:52-58`). Unmapped `placement` values and an
  unrecognized `substitute_macros` mode are never fabricated back: unmapped values ride
  `extras.unmappedPlacements` and re-emit verbatim, an unrecognized substitution mode decodes to
  `undefined` and re-encodes as `"none"` honestly rather than guessing (`regex.ts:93-97`).
- Persona codec (`lumiverse-persona`). Reads one account `Persona` object: name, title (mapped to
  canonical `identity.tagline`), description, the pronoun TRIPLET
  (`subjective_pronoun`/`objective_pronoun`/`possessive_pronoun` mapped to `identity.pronounSet`, the only
  wire among hoplight's persona codecs with structured pronouns), `attached_world_book_id` (mapped to
  `knowledgeRefs`), `avatar_path` (mapped to `presentation.imageUrl`) (`persona.ts:40-67`). Lumiverse ships
  no file import/export UI for personas, so the API object dump is the only standalone form; the whole
  object is sealed to `original["lumiverse-persona"].raw` and export overlays only the edited fields back
  onto the twin, so `folder`/`is_default`/`is_narrator`/`metadata` round-trip untouched (`persona.ts:70-86`).
- `alternate_character_name` is a prompt/macro override, not the card name. It stays on `extensions` and
  is separately editable in the Workbench's Lumiverse native-fields panel; canonical `identity.name` is
  the library name and never reads from it (`ui/apps/workbench/platforms/lumiverse.ts:42-46`).
- The Lumiverse PRESET format (a block-based prompt export, `{ type: "lumiverse_preset", ... }`) is a
  different concern from the character card documented here, parsed by a different layer per its own
  spec. No code path in this repository reads or writes it; excluded from this page.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter (detect, toCanonical, fromCanonical, container selection) | `src/formats/lumiverse/index.ts` |
| Modules sidecar rehydrate/pack, fingerprint check | `src/formats/lumiverse/modules.ts` |
| Variants bridge (`alternate_fields`/`alternate_avatars` <-> `body.variants`) | `src/formats/lumiverse/variants-bridge.ts` |
| Regex codec (both wire shapes) | `src/formats/lumiverse/regex.ts` |
| Persona codec | `src/formats/lumiverse/persona.ts` |
| Coverage declaration | `src/formats/lumiverse/coverage.ts` |
| Shared Tavern field map (`data` <-> canonical) | `src/formats/_shared/tavern-fields.ts` |
| Shared CCv3 asset <-> media map | `src/formats/_shared/assets.ts` |
| Shared PNG chunk read | `src/formats/_shared/png.ts` |
| Shared card-io JSON/PNG readers | `src/formats/_shared/card-io.ts` |
| Bounded archive inflate | `src/core/archive.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Adapter registry, detection tie-break | `src/core/registry.ts` |
| Samples | `samples/lumiverse/` (`rich.extensions.card.json`) |
