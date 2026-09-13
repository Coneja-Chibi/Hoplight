---
id: reference/formats/sillytavern
title: SillyTavern format
audience: dev
summary: How the SillyTavern adapter family detects, maps, and round-trips Character Card V1/V2/V3 cards and world info books through the canonical model.
tags: [format, sillytavern, character, lorebook, ccv2, ccv3]
related: [reference/architecture, reference/entities/character, guide/platforms/sillytavern]
---

# SillyTavern format

SillyTavern is the de-facto standard ecosystem for local AI roleplay. hoplight reads and writes its Character
Card V1, V2, and V3 cards and its standalone world info (worldbook) files. The card is carried either as a
`.json` file or embedded in a `.png` via a base64 text chunk. The character codec writes both: `.json`
by default, and `.png` when an export asks for one, carrying the same card bytes in a `chara` chunk
(plus `ccv3` for a v3 card). The other codecs here - worldbook, regex, persona, preset - write `.json`.

The format is one folder, `src/formats/sillytavern/`, whose `index.ts` default-exports four codecs
(`index.ts:158`):

- `sillytavern`, kind `character`, reads PNG or JSON.
- `sillytavern-lorebook`, kind `lorebook`, reads JSON.
- `sillytavern-regex`, kind `regex`, reads a bare `RegexScriptData[]` array or a card's
  `extensions.regex_scripts`.
- `sillytavern-persona`, kind `persona`, reads an ST personas backup file.

This page documents the character and lorebook codecs in full; the regex and persona codecs are covered
in summary under [Quirks](#quirks). For the canonical field meanings this format maps onto, see
[entities/character.md](../entities/character.md) and [entities/lorebook.md](../entities/lorebook.md). For
the hub-and-spoke, escrow, and detection model, see [architecture.md](../architecture.md). For the whole
matrix of formats, see [FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md).

@fig codecs

## Detection

The registry runs every adapter's `detect()` and keeps the single highest score above `0.5`, so more
specific formats outrank generic ones (`architecture.md`, "Detection and the registry").

### Character

`detect()` returns `0.9` for a recognizable card and `0` otherwise (`index.ts:87-92`). It is `0.9`, not
`1.0`, because SillyTavern is the generic Tavern reader: a more specific adapter that shares the same wire
shape (RoleCall, which claims `1.0` on a CCv3 card carrying an `extensions.rolecall` block) wins detection
and gets to map its own extension layer. On a plain CCv3 card with no such block, `sillytavern` is the
top score and reads it.

Two recognition paths (`index.ts:88-91`):

- PNG: if the input bytes are a PNG carrying a `chara` (V2) or `ccv3` (V3) text chunk, score `0.9`
  (`getVersion`, `png.ts:68-81`). This does not stop at the bytes branch: a real `.json` read carries both
  bytes and text, so a non-card PNG falls through to the JSON path (`index.ts:90`, `card-io.ts:9-21`).
- JSON: `detectCard` recognizes `spec: "chara_card_v3"` with a `data` object (V3), `spec:
  "chara_card_v2"` with `data` (V2), or a flat object with no `spec`/`data` that has a `name` string plus a
  real character signal (V1/flat) (`index.ts:44-75`).

@fig detect

The flat/v1 branch is the cross-kind firewall. A SillyTavern worldbook is also `{ name, ... }` JSON, so
without a tightening rule it would false-positive as a V1 character and collide with the lorebook codec
(`architecture.md`, "The cross-kind firewall"). The branch therefore fires only when the object carries a
`name` and at least one character field (`index.ts:54-72`):

- A V1 core field: `description`, `personality`, `scenario`, `first_mes`, or `mes_example` (`index.ts:65-70`).
- A V2-era field: `alternate_greetings`, `system_prompt`, `post_history_instructions`, `creator_notes`,
  `extensions`, or `character_version` (`index.ts:55-61`).

If a V2-era field is present the variant is recorded as `flat`, otherwise `v1` (`index.ts:72`). A worldbook
carries none of these, so it never reaches a positive here.

### Lorebook

`sillytavern-lorebook` returns `0.9` for a native worldbook, `0.85` for a portable `character_book`, and
`0` otherwise (`lorebook.ts:309-313`):

- `0.9`: a top-level `entries` object keyed by string index (not an array, which would be RoleCall or
  Agnai) whose first value looks like an entry (`key` / `keysecondary` / `comment` / `content`)
  (`lorebook.ts:43-53`).
- `0.85`: a Chub-style or card-extracted `character_book` (an object with an `entries` array)
  (`lorebook.ts:297-300`, `character-book.ts:270-284`). It is portable as ST but scores below the native
  file so the native shape wins any tie.

## Field map

### Character

The shared Tavern `data` mapping lives in `src/formats/_shared/tavern-fields.ts` (`dataToBody` on import,
`applyBodyToData` on export), because SillyTavern and Risu carry the identical CCv2/V3 `data` shape. See
[entities/character.md](../entities/character.md) for what each canonical slot means.

| Source field | Canonical path | Notes |
| --- | --- | --- |
| `data.name` | `identity.name` | Required; defaults to `""` when absent. `tavern-fields.ts:114` |
| `data.nickname` | `identity.nickname` | CCv3. `tavern-fields.ts:115` |
| `data.description` | `identity.description` | `tavern-fields.ts:116` |
| `data.character_version` | `identity.characterVersion` | `tavern-fields.ts:117` |
| `data.personality` | `persona.personality` | `tavern-fields.ts:119` |
| `data.scenario` | `persona.scenario` | `tavern-fields.ts:119` |
| `data.first_mes` | `greetings.firstMessage` | `tavern-fields.ts:126` |
| `data.alternate_greetings` | `greetings.alternateGreetings[].text` | Bare strings wrapped as `{ text }`; ST never sets a title. `tavern-fields.ts:56,127` |
| `data.group_only_greetings` | `greetings.groupOnlyGreetings[].text` | CCv3 only; a V2 export drops them. `tavern-fields.ts:128`, `coverage.ts:36` |
| `data.mes_example` | `examples.exampleMessages` | `tavern-fields.ts:130` |
| `data.system_prompt` | `prompts.systemPrompt` | `tavern-fields.ts:121` |
| `data.post_history_instructions` | `prompts.postHistoryInstructions` | `tavern-fields.ts:122` |
| `data.extensions.depth_prompt` | `prompts.depthInjections[]` (origin `depth_prompt`) | `{ prompt, depth, role }`; empty prompt maps to no injection. `tavern-fields.ts:77-87,123` |
| `data.creator` | `attribution.creator` | `tavern-fields.ts:133` |
| `data.creator_notes` | `attribution.creatorNotes` | `tavern-fields.ts:134` |
| `data.source` | `attribution.source` | `string[]`; CCv3. `tavern-fields.ts:135` |
| `data.creator_notes_multilingual` | `attribution.creatorNotesMultilingual` | CCv3 only. `tavern-fields.ts:136`, `coverage.ts:37` |
| `data.creation_date` | `attribution.createdAt` | Number. `tavern-fields.ts:137` |
| `data.modification_date` | `attribution.updatedAt` | Number. `tavern-fields.ts:138` |
| `data.tags` | `discovery.tags` | `tavern-fields.ts:140` |
| `data.extensions.talkativeness` | `settings.talkativeness` | Tolerant read: string `"0.5"` or number to number. `tavern-fields.ts:60-67,141` |
| `data.extensions.world` | `worldName` | Name of a linked worldbook, not an embedded book. `tavern-fields.ts:111,142` |
| `data.assets` | `body.media` (`portrait` + `assets[]`) | CCv3 asset array to canonical media; bytes stay in escrow. `index.ts:99`, `assets.ts:113-131` |
| `data.character_book` | `knowledgeRefs` | Handled by the bundle layer, not `tavern-fields`; see below. `index.ts:128`, `character-book.ts:291-319` |
| PNG carrier pixels | `original.sillytavern.sourceMedia` | The PNG file is kept as a raw-bytes twin (authored art). `png.ts:39-42`, `index.ts:107` |

`depth_prompt`, `talkativeness`, and `world` are authored fields ST keeps in `extensions` only because
CCv2/V3 is rigid. They are first-classed as editable canonical slots, not escrow. An empty `depth_prompt.prompt`
is ST's default-when-unset and maps to no injection, so the depth/role config rides the twin untouched;
`role` is carried only when the card authored one, and its absence means ST's default (`system`) applied
at read time, never fabricated back on export (`tavern-fields.ts:77-87`).

`data.character_book` is not mapped by `tavern-fields`. An embedded book is a bundle concern: on import a
shared layer extracts it into a standalone `CanonicalLorebook` and links it from the character via
`knowledgeRefs`, and on export the adapter re-embeds referenced books into the single `data.character_book`
slot via the `EmitContext` it receives. A resolved empty list removes both the primary slot and the
legacy `data.extensions.character_book` fallback, so clearing or disabling a link cannot resurrect the
source twin's old book (`index.ts:128-142`, `character-book.ts:462-478`, `architecture.md`, "Bundles").

### Lorebook

ST world info encodes several canonical enums as integers. The shared decoders live in
`src/formats/_shared/lore-enums.ts`.

| Canonical enum | ST integer coding | Source |
| --- | --- | --- |
| `selectiveLogic` | `0` and_any, `1` not_all, `2` not_any, `3` and_all | `lore-enums.ts:15-20` |
| `role` | `0` system, `1` user, `2` assistant | `lore-enums.ts:22-25` |
| `position` | `0` world, `1` character, `2` before_example, `3` after_example, `4` depth | `lorebook.ts:57-71` |

Entry field highlights (`lorebook.ts:124-193`); see [entities/lorebook.md](../entities/lorebook.md) for the
full canonical entry.

| Canonical | ST wire | Notes |
| --- | --- | --- |
| `title` | `comment` | Falls back to `Entry N` when blank. `lorebook.ts:133` |
| `content` | `content` | `lorebook.ts:134` |
| `enabled` | `!disable` | ST canonicalizes on a `disable` flag. `lorebook.ts:125,201` |
| `triggers` | `key` | Inline regex `/pattern/flags` decodes to a structured trigger. `lorebook.ts:94-107,140` |
| `secondaryTriggers` | `keysecondary` | `lorebook.ts:141` |
| `sortOrder` | `order` | ST's placement (insertion) order. `lorebook.ts:154` |
| `priority` | (none) | ST has no eviction axis, so `priority` defaults to `100`. `lorebook.ts:155` |
| `groupName` | `group` | Empty string maps to `null`. `lorebook.ts:161` |
| `scanCharacterDescription` etc. | `matchCharacterDescription` etc. | `lorebook.ts:174-177` |
| `scanCharacterDepthPrompt`, `scanCreatorNotes` | `matchCharacterDepthPrompt`, `matchCreatorNotes` | Extra scan sources, present-or-absent. `lorebook.ts:178-179` |
| `vectorized` | `vectorized` | The RAG toggle, not the vectors. `lorebook.ts:185` |
| `groupOverride`, `useGroupScoring` | `group_override`, `use_group_scoring` | `lorebook.ts:186-187` |
| `automationId` | `automationId` | QR-automation binding id. `lorebook.ts:188` |
| `displayIndex` | `displayIndex` | Distinct authored display-order axis, not `order`. `lorebook.ts:189` |

The embedded `character_book` uses a different wire dialect than the standalone worldbook file: CCv3 spec
field names at the entry top level (`keys`, `secondary_keys`, `insertion_order`, `use_regex`, coarse
`before_char`/`after_char` position) with the ST-extended fields tucked into each entry's `extensions`
bag, read from both places with extensions winning (`character-book.ts:1-15,153-235`).

## Escrow and round-trip

The escrow envelope is the canonical wrapper's `original` field, a `Record<FormatId, OriginalEntry>` keyed
by format id (`canonical.ts:39-51,80`). The architecture calls this concept "escrow"; the wrapper field is
named `original`. Each ST codec stores its twin under its own adapter id, so the character card twin lives
at `original.sillytavern`.

On import the character adapter stores the whole original card verbatim, plus the round-trip variant and
the PNG carrier (`index.ts:105-108`):

```
original.sillytavern = {
  raw:         <the entire parsed card, JSON or the decoded chunk>,
  unmapped:    { variant: "v2" | "v3" | "v1" | "flat" },
  sourceMedia: { b64, mime: "image/png" }   // only for PNG input
}
```

A same-format round-trip is byte-lossless (`architecture.md`, "Escrow"). On export, `fromCanonical`
overlays the canonical body onto a clone of the raw card and preserves the original variant wrapper: a V3
card stays V3, a V2 card stays V2, a flat card stays flat (`index.ts:112-148`). The overlay is three-state
against the twin's decode (`applyBodyToData`, `tavern-fields.ts:157-298`): a canonical value equal to the
twin leaves the raw bytes untouched, a changed value is written, and a value the twin had but canonical no
longer carries is cleared at its exact wire home. Unknown keys and non-representable raw (for example
RoleCall's object-form `source`) are left alone.

What crosses a cross-format conversion is only the canonical body. Everything else, the raw card, its
`extensions` block, unknown keys, and the PNG carrier, stays in escrow and is deliberately not copied into
another app's file (`architecture.md`, "Escrow: lossless round-trips, contained cross-format loss"). The
PNG carrier is served as the entity's portrait and can be restored on a same-format re-emit.

The lorebook codec follows the same rule. ST has fewer injection slots than canonical, so richer positions
collapse on export: `append`/`append_bottom` to depth (`4`), `prepend_top` to `0`, `scene` to
before_example (`2`) (`lorebook.ts:74-91`). ST also has no per-trigger probability, so `triggerMode` is
always `simple` on read (`lorebook.ts:139`). That loss is inherent to ST and is what escrow-of-raw guards:
an unedited entry re-projects from its raw twin by id, so a hoplight ST to ST round-trip stays byte-lossless,
and only edited entries re-encode and take the collapse (`lorebook.ts:268-294`). Raw-only carriers with no
authored meaning (entry `uid`, embedding vectors, `loreCache`) ride escrow untouched.

## Quirks

- CCv2 vs V3. The V3-only fields (`nickname`, `source`, `creator_notes_multilingual`, `creation_date`,
  `modification_date`, `group_only_greetings`, `assets`) round-trip only in a V3 envelope. A V2 export drops
  `group_only_greetings` and `creator_notes_multilingual` (`coverage.ts:35-38`). The variant is preserved
  across a round-trip, but if canonical media is present and the twin is not already V3, export upgrades the
  card to a V3 envelope because V2 has no portable `assets[]` contract (`index.ts:130-133`).
- PNG chunk embedding. A card lives in a base64 `chara` (V2) or `ccv3` (V3) `tEXt` chunk. A V3 card is
  normally written with both chunks: `ccv3` for the full card and `chara` for a V2 subset for older
  readers. Chunk order is not specified, so the reader prefers `ccv3` wherever present rather than the first
  chunk, which would silently downgrade the card to its subset (`png.ts:44-81`). `embedCharacterJson`
  writes the `chara` keyword by default (`png.ts:84`).
- Flat/v1 needs a real character signal. A bare `{ name }` object is not a character. The flat/v1 path
  requires `name` plus a V1 or V2-era character field, which is the cross-kind firewall that keeps a
  worldbook from importing as a character (`index.ts:54-72`). See [Detection](#detection).
- Talkativeness is a tolerant number. Some cards store `extensions.talkativeness` as a string (`"0.5"`),
  others as a number; both read to a number (`tavern-fields.ts:60-67`). On write it is emitted as a number,
  and an unchanged string twin is left as-is by the three-state overlay (`tavern-fields.ts:270-276`).
- World link is by name. `extensions.world` is the name of a separate worldbook, not an embedded book, so
  it maps to the scalar `worldName`, not `knowledgeRefs` (`tavern-fields.ts:111,142`). An embedded book is
  `data.character_book` and is handled by the bundle layer.
- `displayIndex` is a distinct axis. In a real card `order` can be uniform (100) while `displayIndex` runs
  `0..3`, so hoplight never fabricates `displayIndex` from `sortOrder` on a cross-format write; a book that
  authored none omits it (`lorebook.ts:189,215-217`).
- Regex codec (`sillytavern-regex`). Reads the bare `RegexScriptData[]` array (Marinara's Essentials packs)
  or a card's `extensions.regex_scripts`, scoring `0.9` for the file and `0.85` for the card block; a full
  character card still wins detection at `0.9`, so cards keep importing as characters (`regex.ts:273-277`,
  `index.ts:154-157`). One ST-only detail: an empty-flags pattern that arrived delimiter-wrapped (`/x/`)
  versus bare (`x`) is recorded in `extras["sillytavern.findWrapped"]` so a round-trip does not silently
  rewrite it (`regex.ts:72,120-130,210`).
- Persona codec (`sillytavern-persona`). Reads ST's personas backup file
  (`{ personas, persona_descriptions, default_persona? }`), scoring `0.95` (`persona.ts:106-108`). One file
  holds many personas but the adapter contract is one entity per file, so `toCanonical` imports the default
  persona (falling back to the first) and seals the entire backup in escrow; export overlays the edited
  persona back so every other persona re-emits byte-true (`persona.ts:9-14,110-160`).

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter (detect, toCanonical, fromCanonical) | `src/formats/sillytavern/index.ts` |
| World info codec | `src/formats/sillytavern/lorebook.ts` |
| Regex codec | `src/formats/sillytavern/regex.ts` |
| Persona codec | `src/formats/sillytavern/persona.ts` |
| Shared Tavern field map (`data` <-> canonical) | `src/formats/_shared/tavern-fields.ts` |
| Shared lore int-enum decoders | `src/formats/_shared/lore-enums.ts` |
| Embedded `character_book` mapper | `src/formats/_shared/character-book.ts` |
| CCv3 `assets[]` <-> media | `src/formats/_shared/assets.ts` |
| PNG chunk read/write | `src/formats/_shared/png.ts` |
| Coverage declaration | `src/formats/sillytavern/coverage.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Samples | `samples/sillytavern/` (CCv2/v3 JSON + Seraphina.png) |
