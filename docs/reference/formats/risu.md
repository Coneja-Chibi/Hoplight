---
id: reference/formats/risu
title: RisuAI format
audience: dev
summary: How the RisuAI adapter family detects, maps, and round-trips .charx character cards, a native lorebook export, and regex script sets through the canonical model.
tags: [format, risu, character, lorebook, regex, charx]
related: [reference/architecture, reference/entities/character, reference/entities/lorebook]
---

# RisuAI format

RisuAI is a roleplay client whose native character export is a `.charx`: a ZIP archive containing a
`card.json` (an ordinary Character Card V3) plus an `assets/` tree, and optionally a `module.risum`
bundle. vaud reads and writes `.charx`, plus RisuAI's standalone lorebook export and its `customscript`
regex rows, wherever they live (card-embedded, a bare JSON array, or packed inside a `.risum` module).

The format is one folder, `src/formats/risu/`, whose `index.ts` default-exports three codecs
(`index.ts:191`):

- `risu`, kind `character`, reads and writes `.charx`.
- `risu-lorebook`, kind `lorebook`, reads and writes the native lore export json.
- `risu-regex`, kind `regex`, reads a `.risum` module or a bare `customscript` row array; writes json
  rows only, never a repacked module (see [Quirks](#quirks)).

This page documents the character and lorebook codecs in full; the regex codec is covered in summary
under [Quirks](#quirks). For the canonical field meanings this format maps onto, see
[entities/character.md](../entities/character.md) and [entities/lorebook.md](../entities/lorebook.md).
For the hub-and-spoke, escrow, and detection model, see [architecture.md](../architecture.md). For the
whole matrix of formats, see [FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md).

@fig codecs

## Detection

### Character

`detect()` returns `1.0` for a recognizable `.charx`, `0` otherwise (`index.ts:87-95`). It is a two-step
check:

- **Zip magic**: the first two bytes must be `PK` (`0x50 0x4b`). Anything else scores `0` immediately, so
  a bare JSON card is never claimed by this adapter.
- **`card.json` present**: a bounded, single-entry inflate (`only: "card.json"`) scores `1.0` if that
  entry exists, `0` if it does not or the archive fails to parse (`index.ts:38-41,90-94`).

Detection does not parse the card's `spec`/`spec_version` or inspect its contents beyond the presence of
`card.json`; a `.charx` carrying a V2-shaped `data` block still scores `1.0` here.

Every inflate on this path, detection and conversion alike, runs through the core's bounded unzip
(`unzipBounded` with `CARD_ARCHIVE_BOUNDS`: max archive 96 MiB, max 512 entries, max 64 MiB per entry
compressed or inflated, max 96 MiB aggregate inflated), which rejects an oversized entry before
decompressing it rather than after (`src/core/archive.ts:30-36,66-119`).

@fig detect

### Lorebook

`risu-lorebook` returns `1` for the native envelope, `0.75` for a portable character_book extract, `0`
otherwise (`lorebook.ts:299-303`):

- `1`: a top-level object with `type === "risu"` and an array `data` (`lorebook.ts:285-289`). The shape is
  unambiguous and does not collide with a SillyTavern worldbook's `{ entries: {...} }` object.
- `0.75`: a Chub-style or card-extracted `character_book` (an object with an `entries` array of CCv3-shaped
  rows), the same fallback the SillyTavern lorebook codec accepts (`lorebook.ts:301`,
  `character-book.ts:270-284`). It scores below the native envelope so a real Risu export always wins any
  tie.

## Field map

### Character

The `card.json` `data` object maps through the shared Tavern V2/V3 mapper, identical to SillyTavern's own
`data` mapping: SillyTavern and Risu carry the exact same CCv3 `data` shape, so the mapping lives once in
`src/formats/_shared/tavern-fields.ts` (`dataToBody` on import, `applyBodyToData` on export,
`tavern-fields.ts:3-4`). See [sillytavern.md](sillytavern.md), "Field map" for that table in full; it is
not repeated here.

Risu's own delta lives in `data.extensions.risuai`, mapped by `src/formats/risu/risu-fields.ts`. The
whole surface is FIRST-CLASS and editable (schema-is-editor), and every write is twin-diffed so an
unedited card re-emits its `risuai` block verbatim:

| Canonical | Risu wire (`extensions.risuai`) | Notes |
| --- | --- | --- |
| `attribution.license` | `license` | Scalar, write on change, delete key on clear. `risu-fields.ts:140,178-182` |
| `bias` | `bias` (`[phrase, weight]` pairs) | `risu-fields.ts:36-44,141,183-185` |
| `prompts.additionalText` | `additionalText` | A plain-append prompt string, distinct from a depth injection. `risu-fields.ts:142-143,186` |
| `settings.risu.*` | `viewScreen`, `largePortrait`, `inlayViewScreen`, `utilityBot`, `lorePlus` | Authored display and behavior toggles. `risu-fields.ts:70-83,144-145,187-194` |
| `persona.imagePrompt` | `sdData` (`[label, value]` rows) + `newGenData.{prompt,negative,instructions,emotionInstructions}` | `risu-fields.ts:46-62,146,195-205` |
| `persona.voice` (provider `vits`) | `vits` | The only TTS config confirmed to serialize on this wire. `risu-fields.ts:64-68,147,206-209` |
| `behavior.regexScripts` | `customScripts` | The narrow, card-embedded twin (singular `phase`, no id/enabled/sortOrder); see [entities/regex.md](../entities/regex.md), "The character-card twin". `regex.ts:49-64` |
| `behavior.triggerScripts` | `triggerscript` | Condition/effect rows, verbatim-editable. `risu-fields.ts:88-109,116-117,216-218` |
| `behavior.virtualScript` | `virtualscript` | `risu-fields.ts:118,219` |
| `behavior.backgroundHTML` / `backgroundCSS` | `backgroundHTML` / `backgroundCSS` | `risu-fields.ts:119-120,220-221` |
| `behavior.defaultVariables` | `defaultVariables` | Script-engine seed values. `risu-fields.ts:121,222` |
| `behavior.prebuiltAsset` | `prebuiltAssetCommand`, `prebuiltAssetExclude`, `prebuiltAssetStyle` | `risu-fields.ts:122-128,225-229` |
| `behavior.moduleToggles` | writes `toggles`; reads `toggles`, falling back to `customModuleToggle` | The producer wire key is `toggles`; `customModuleToggle` is a DB-only spelling accepted tolerantly on read. `risu-fields.ts:129-132,223-224` |
| `behavior.privileged` | `lowLevelAccess` | The card requested Risu's privileged low-level script API; a warning marker, never an execution trigger. `risu-fields.ts:133,148,230-232` |

`data.creation_date` / `data.modification_date` map to `attribution.createdAt` / `updatedAt` through the
shared mapper, then get a Risu-specific unit fix: Risu writes both in milliseconds, the CCv3 spec says
seconds, so any value above `1e11` is normalized to seconds on import and the raw millisecond value is
restored verbatim on a same-format export (`index.ts:30-36,111-112,154-162`; see [Quirks](#quirks)).

`data.assets[]` maps to canonical `media` through the shared CCv3 asset mapper
(`src/formats/_shared/assets.ts`, `assetsToMedia` on import, `applyMediaToTavernData` on export,
`index.ts:110,159`). Asset `type` decides the canonical role: `icon` (or `name === "main"`) becomes
`portrait`, `emotion`/`expression` becomes `emotion`, `outfit`/`pose`/`background` map straight across,
anything else (including Risu's own `x-risu-asset`) becomes `other` (`assets.ts:69-78,113-131`). The
asset bytes are not at the mapped `ref`; they ride escrow separately (see
[Escrow and round-trip](#escrow-and-round-trip)).

`data.character_book` is not mapped by the Tavern mapper. An embedded book is a bundle concern: on import
a shared layer extracts it into a standalone `CanonicalLorebook` and links it via `knowledgeRefs`
(`src/convert.ts:49`, format-agnostic for any CCv2/v3 card); on export `fromCanonical(entity, context)`
re-embeds a referenced lorebook into `data.character_book` via the same `embedCharacterBook` helper
SillyTavern and RoleCall use (`index.ts:165`, `character-book.ts:466-472`).

### Lorebook

Risu's native field names differ from CCv3. `key` and `secondkey` are comma-joined strings, not arrays.

| Canonical (`LorebookEntry`) | Risu native (`loreBook`) | Notes |
| --- | --- | --- |
| `id` | `id` | Falls back to the raw row's array index. `lorebook.ts:106` |
| `title` | `comment` | Falls back to `Entry N` when blank. `lorebook.ts:103,107` |
| `comment` | `comment` | Risu writes the same string to both `name` and `comment` on its CCv3 form; mirrored here. `lorebook.ts:109` |
| `content` | `content` | `lorebook.ts:108` |
| `constant` | `alwaysActive` | The always-on flag, not `mode`. `lorebook.ts:112` |
| `triggers` | `key` (comma-joined) | Split on commas, trimmed, empties dropped; `/pattern/flags` decodes to a structured trigger; `useRegex` forces every keyword to regex. `lorebook.ts:82-84,91-99,115` |
| `secondaryTriggers` | `secondkey` (comma-joined) | Present only when `selective` is true. `lorebook.ts:101-102,116` |
| `triggerMode` | derived | `advanced` when `selective` or a secondary key exists, else `simple`. `lorebook.ts:114` |
| `caseSensitive` | `extentions.risu_case_sensitive` | Risu's own spelling of "extensions". `lorebook.ts:52,119` |
| `probability` | `activationPercent` | Clamped to 0 to 100; stamped onto each trigger's own `probability` when not 100, matching `character-book.ts`'s embedded-path output. `lorebook.ts:92-99,138` |
| `sortOrder` | `insertorder` | Risu treats `insertorder` as CCv3 `insertion_order`; see [Quirks](#quirks). `lorebook.ts:127` |
| `priority` | (none) | Risu has no eviction axis, so `priority` defaults to `100`. `lorebook.ts:128` |
| `role` | `role` | `system`, `user`, or `assistant`; the one native-richer field, see [Quirks](#quirks). `lorebook.ts:86,125` |
| `enabled` | (none) | Native lore has no per-entry disable flag; always reads `true`. `lorebook.ts:111` |
| `categoryId` | `folder` | Parent folder reference on a child entry. `lorebook.ts:56,135` |

`mode` (`multiple`, `constant`, `normal`, `child`, `folder`), `loreCache`, and `bookVersion` have no
canonical home and ride escrow untouched. A `mode: "folder"` row is lifted out as a `LorebookCategory`
rather than a content entry; a child entry's `folder` becomes its `categoryId` (`lorebook.ts:158-176`).
See [entities/lorebook.md](../entities/lorebook.md) for `LorebookCategory` and every other canonical
field's meaning; the entry-level fields not in the table above (positions, per-entry scan depth, groups,
timing, recursion, scan sources) are absent from the native wire and take canonical defaults.

The envelope carries no book-level name or settings: in Risu those live on the character record
(`loreBookDepth`/`loreBookToken`), not in the exported file, so the canonical book `name` is empty and
global scan depth/budget default to `0` (`lorebook.ts:177-193`).

The same Risu lore must canonicalize identically whether it arrives here as a native envelope or embedded
in a `.charx` (which routes through `_shared/character-book.ts`): Risu's own writer equates the two
field-for-field, which is why `insertorder` lands in `sortOrder`, not `priority`, matching the embedded
path (`lorebook.ts:10-21`).

## Escrow and round-trip

The escrow envelope is the canonical wrapper's `original` field, a `Record<FormatId, OriginalEntry>` keyed
by format id (`canonical.ts:39-48,80`). The architecture calls this concept "escrow"; the wrapper field is
named `original`. The character twin lives at `original.risu`, the native lorebook twin at
`original["risu-lorebook"]`.

On import the character adapter stores the whole parsed `card.json` envelope, the non-`card.json` zip
entries, the `module.risum` bundle if present, and two safety flags (`index.ts:130-147`):

```
original.risu = {
  raw:      <the parsed card.json envelope: spec, spec_version, and the full data block>,
  unmapped: {
    assetFiles:          { "<zip path>": "<base64>", ... },  // every entry but card.json/module.risum
    moduleRisum:         "<base64>",                          // module.risum bytes, when present
    module:              <OpenedRisumModule>,                 // structured view, only when decode succeeds
    hasExecutableContent: boolean,
    privileged:           boolean,
  },
}
```

A Risu to canonical to Risu round-trip is data-lossless. On export, `fromCanonical` clones
`original.risu.raw`, or starts from a from-scratch V3 envelope (`baseCard()`) when there is no twin
(`index.ts:49-56,152`). In order: `applyBodyToData` overlays the shared scalar fields with the same
three-state clear/write/leave rule the SillyTavern codec uses; `applyMediaToTavernData` merges canonical
media back into `data.assets[]` (see [Quirks](#quirks) for what survives cross-format); `applyBodyToRisu`
twin-diffs the `extensions.risuai` scalar surface; the raw millisecond dates are then restored verbatim
over whatever `applyBodyToData` wrote in seconds (`index.ts:154-162`). `card.json` is re-serialized with
`JSON.stringify(card, null, 4)`, the escrowed asset files are restored byte-for-byte at their original zip
paths, `module.risum` is re-emitted (unedited bytes verbatim, an edited module refused, see
[Quirks](#quirks)), and the set is re-zipped (`index.ts:167-181`). Every mapped field, every asset byte,
and `module.risum` survive, but the output `.charx` bytes are not guaranteed to equal the input: the JSON
is re-serialized and the zip is regenerated, so indentation, compression, entry order, and archive
metadata are reproduced by vaud, not preserved from the source.

The native lorebook codec follows the same twin-overlay rule. The whole raw envelope rides
`original["risu-lorebook"].raw` (`lorebook.ts:314`). `fromCanonical` walks the twin's rows in original
order, matched by id: an unedited entry or folder row re-emits from its clone field for field (comma
spacing, `mode`/`folder`/`loreCache` residue all intact); an edited entry rewrites only the fields that
changed; a canonically deleted row drops out; a canonically added entry or category with no twin appends
fresh (`entryToWire`/`bookToWire`, `lorebook.ts:209-280`). Book-level metadata a native envelope cannot
hold (name, description, scan depth, token budget) is not written on export, since Risu keeps it on the
character record, not in the file.

## Quirks

- Always CCv3, never V2. Risu's `card.json` is written with `wrapV3`; a from-scratch export with no twin
  starts from `baseCard()`, which is also V3 (`index.ts:49-56`). There is no V2 branch to preserve, unlike
  the SillyTavern codec.
- Millisecond dates. Risu writes `creation_date`/`modification_date` in milliseconds; CCv3 says seconds.
  Any value above `1e11` normalizes to seconds on import (a real seconds timestamp does not reach that
  until roughly the year 5138), and the raw millisecond value is restored verbatim on a same-format
  export. A real sample card carried mixed units in one file, `creation_date` in milliseconds and
  `modification_date` already in seconds, confirming the fix has to run per field, not per card
  (`index.ts:30-36`, `samples/risu/SOURCES.md`).
- Media now crosses format, selectively. `fromCanonical` always calls `applyMediaToTavernData`, the
  inverse of `assetsToMedia`. What survives depends on the ref: `data:` inline images, `http(s)://` URLs,
  and the `ccdefault:` sentinel project straight into `data.assets[]`; an archive-relative ref
  (`embeded://...`, `blob:`, `file:`, or any bare path with no scheme) is skipped unless an existing row
  on the twin already carries that exact uri, since there is no zip to resolve a fresh one against
  (`assets.ts:134-146,231-273,307-321`). A same-format Risu round-trip keeps every asset because its
  twin's rows already carry the matching uri and the bytes ride `original.risu.unmapped.assetFiles`.
- Behavior is first-class editable data, never executed. `CharacterBehavior` (regex scripts, trigger
  scripts, virtual script, background markup, module toggles, `privileged`) is a real canonical slot, not
  escrow. No adapter's `fromCanonical` outside this folder reads `body.behavior`, so it only ever re-emits
  on the Risu wire; a Risu-to-anything-else export carries no scripts. Execution itself is out of scope
  for the whole converter: no eval, no require, no DOM injection anywhere in the pipeline.
- `module.risum` is opened, not opaque, but re-encoding an edit is safe-blocked. A `.risum` is Risu's
  RPack container: magic byte `111`, version byte `0`, a length-prefixed main JSON block byte-substituted
  through a fixed 256-entry table (no compression, no key), zero or more length-prefixed asset blocks, and
  a terminator (`rpack/container.ts:15-18,42-76`, `rpack/codec.ts:9-19`). vaud reimplements the container
  walk and the table clean-room in `src/formats/risu/rpack/`, and `openRisumModule` decodes it into a
  structured `RisuModule` (name, `trigger[]`, `regex[]`, `lorebook[]`, an open `extras` bag, plus a listing
  of every `triggerlua`/`cjs`/`triggercode` script body without reading its meaning), landing at
  `original.risu.unmapped.module` (`open-module.ts:26-48`, `rpack/module.ts:46-56,61-86`). An unedited
  module always re-exports its original bytes byte-for-byte. An edited one throws
  `RpackEditedExportBlockedError` instead of writing through the table unproven under a real edit; the
  gate (`RPACK_EDITED_EXPORT_VERIFIED`) flips only once independent ciphertext/plaintext fixtures cover the
  exercised mappings (`rpack/index.ts:37-57,112-117`).
- `risu-regex` covers two file homes with two different scores, and export is rows-only. `detect()`
  returns `0.8` for a `.risum` module blob whose decoded `regex[]` is non-empty, `0.85` for a bare JSON
  array of `customscript` rows carrying at least one of `type`/`comment`/`flag`/`ableFlag`/`disabled`
  (`regex.ts:227-266`); a `.charx` zip still scores `1.0` on the character adapter, so a full card keeps
  importing as a character, not a regex set. Rows decode with `id`/`sortOrder` set to the row's original
  array index (Risu rows carry no id of their own), `enabled` read tolerantly (`disabled === true` is the
  only "off"), and every unrecognized key preserved in `extras` (`regex.ts:113-135`). Export always emits
  a pretty-JSON row array, never a repacked `.risum`, even when the twin came from a module: a module
  carries triggers, lorebook entries, and assets this entity has no home for, so wrapping bare rows back
  into one would fabricate wire data (`regex.ts:209-221,284-288`). An unedited rule re-emits byte-for-byte
  through the same twin-overlay walk the lorebook codec uses, including preserving whichever `type`
  spelling was on the wire; `RISU_TYPE_TO_PHASE` maps `editinput`/`editoutput`/`editdisplay` plus both
  observed request spellings, `editrequest` and `editprocess`, to canonical phase `request`, and only a
  freshly authored `request` phase writes the current, source-confirmed `editprocess` spelling
  (`regex.ts:22-30,94-109,144-173`). An unlisted `type` value (`edittrans`, observed on a real card) is
  kept verbatim as an unmodeled phase string rather than rejected, since canonical `RegexPhase` is an open
  union; an omitted `type` decodes to an empty `phases` array rather than an invented default, matching
  Risu's own strict-equality pipeline dispatch, which never runs an untyped row either
  (`regex.ts:15-20,113-115`).
- The native lorebook's `role` field is native-richer. Risu's own `.charx` export drops per-entry `role`
  when it writes `character_book`, but the native lorebook export keeps it, so it is mapped here even
  though the embedded path has no equivalent (`lorebook.ts:17-18,86,125`).
- Placement order crosses cleanly. `insertorder` maps to canonical `sortOrder`, the same axis every other
  codec's placement field maps to (SillyTavern `order`, CCv3 `insertion_order`), never to `priority`
  (which Risu has no field for and always defaults to `100`). A `risu-lorebook` to `sillytavern-lorebook`
  conversion therefore writes the insertion order straight into ST's `order`
  (`lorebook.ts:127-128`, [sillytavern.md](sillytavern.md), "Field map").

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter (detect, container, escrow, dates, safety flags) | `src/formats/risu/index.ts` |
| Risuai extension scalar mapping | `src/formats/risu/risu-fields.ts` |
| Native lorebook codec | `src/formats/risu/lorebook.ts` |
| Regex codec (card-embedded twin + standalone entity mapping) | `src/formats/risu/regex.ts` |
| `.risum` (RPack) container walk, byte codec, substitution table, module JSON | `src/formats/risu/rpack/container.ts`, `codec.ts`, `table.ts`, `module.ts`, `index.ts` |
| Structured module open view (for escrow) | `src/formats/risu/open-module.ts` |
| Shared Tavern V2/V3 field map | `src/formats/_shared/tavern-fields.ts` |
| Shared CCv3 asset to media map | `src/formats/_shared/assets.ts` |
| Shared keyword `/pattern/flags` decode + embedded `character_book` mapper | `src/formats/_shared/character-book.ts` |
| Coverage declaration | `src/formats/risu/coverage.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Bounded zip inflate | `src/core/archive.ts` |
| Samples | `samples/risu/` (`cherry.card.json` + `SOURCES.md`) |
