---
id: reference/formats/rolecall
title: RoleCall format
audience: dev
summary: How the RoleCall adapter family detects, maps, and round-trips its character card, lorebook, persona, and regex-script exports through the canonical model.
tags: [format, rolecall, character, lorebook, persona, regex, ccv2, ccv3]
related: [reference/architecture, reference/entities/character, reference/entities/lorebook, reference/entities/regex, reference/formats/sillytavern]
---

# RoleCall format

RoleCall is Vaudeville Studios' own roleplay client. It has no wire-distinct "RC character" file: an RC
character serializes as an ordinary Character Card V2/V3 (PNG `chara`/`ccv3` chunk or bare JSON), with
every RC-native field riding inside `data.extensions.rolecall`. Its lorebook is a dedicated v1 export
envelope. Its persona and regex-script exports are separate JSON shapes. Because RoleCall is Vaudeville's
own product, its source can be read and ported freely, unlike the GPL-licensed formats hoplight treats as
interop-facts-only.

One folder, `src/formats/rolecall/`, default-exports four codecs (`index.ts:405`):

- `rolecall`, kind `character`, reads PNG or JSON, writes `.json`.
- `rolecall-lorebook`, kind `lorebook`, reads JSON, writes `.json`.
- `rolecall-persona`, kind `persona`, reads JSON, writes `.json`.
- `rolecall-regex`, kind `regex`, reads JSON, writes `.json`.

This page documents the character and lorebook codecs in full; the persona and regex codecs are covered
in summary under [Quirks](#quirks). For canonical field meanings, see
[entities/character.md](../entities/character.md), [entities/lorebook.md](../entities/lorebook.md), and
[entities/regex.md](../entities/regex.md); the persona entity has no dedicated reference page yet, so its
fields are covered inline against `src/entities/persona/schema.ts` and
[docs/generated/fields.persona.md](../../generated/fields.persona.md). For the hub-and-spoke, escrow, and
detection model, see [architecture.md](../architecture.md). For the whole matrix of formats, see
[FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md).

@fig codecs

## Detection

The registry runs every adapter's `detect()` and keeps the single highest score above `0.5`
(`architecture.md`, "Detection and the registry").

### Character

`detect()` returns `1.0` for a CCv2/V3 card that carries an `extensions.rolecall` block, `0` otherwise
(`index.ts:348-356`). It requires `spec` to be `chara_card_v3` or `chara_card_v2`, a `data` object, and a
`rolecallExt(data)` result whose `type` is not the literal `"persona"` (`index.ts:352-355`, `rolecallExt`
at `index.ts:92-95`). The `1.0` outranks the generic SillyTavern reader's `0.9` on the same card
(`sillytavern.md`, "Detection"; `architecture.md`, "Detection and the registry").

**Cross-kind firewall.** RC's own persona-export route emits this exact same CCv2/V3 shape, with
`extensions.rolecall.type` set to the literal `"persona"` - a PERSONA, not a character. The character
adapter's `detect()` returns `0` on that discriminator, and `toCanonical` throws pointing at
`rolecall-persona`, instead of the two adapters tying at `1.0` on the same file (`index.ts:355,366`). See
"Persona codec" under [Quirks](#quirks).

@fig detect

### Lorebook

`detect()` returns `1.0` for a RoleCall v1 export - a `{ schemaVersion, exportDate, lorebook }` envelope
whose `lorebook.entries` is an array and `lorebook` is present as an object - `0` otherwise
(`lorebook.ts:308-312`, `readExport` at `lorebook.ts:37-45`). `isRcVersion` requires `schemaVersion` to be
a string that *contains* `"1.0.0"`, not an exact match (`lorebook.ts:27,48-49`) - a substring test, so a
value like `"1.0.0-beta"` also passes; the codec never hard-rejects an unfamiliar version, it just parses
structurally. This envelope shape (top-level `schemaVersion` plus a nested `lorebook` wrapper) does not
collide with the SillyTavern worldbook, which has a top-level `entries` object and no `lorebook` wrapper at
all - no firewall is needed between the two lorebook codecs.

## Field map

### Character

The shared Tavern `data` mapping lives in `src/formats/_shared/tavern-fields.ts` (`dataToBody` on import,
`applyBodyToData` on export) and is documented in full in [sillytavern.md](sillytavern.md#field-map). This
table covers only what the RC layer adds on top, read out of `extensions.rolecall` (`rolecallExt`,
`index.ts:92-95`) and its nested `details` casting-card object (`RcDetails`, `index.ts:53-75`).

| Source field | Canonical path | Notes |
| --- | --- | --- |
| `extensions.rolecall.tagline` | `identity.tagline` | `cardToBody`, `index.ts:154` |
| `extensions.rolecall.genre` | `discovery.genre` | `index.ts:155` |
| `extensions.rolecall.fandom` | `discovery.fandom` | `index.ts:156` |
| `extensions.rolecall.content_rating` | `discovery.rating` | Exact 3-way map, no boolean-nsfw inference: `all_hours`/`late_night`/`after_dark` <-> `all-ages`/`mature`/`explicit` (`RATING_IN`/`RATING_OUT`, `index.ts:34-43,157,221`). |
| `extensions.rolecall.source_url` | `attribution.sourceUrl` | `index.ts:158` |
| `extensions.rolecall.creators_note` | `attribution.publicNote` | Public "from the creator" note on the card page; distinct from the base-spec `data.creator_notes` (`index.ts:159`). |
| `extensions.rolecall.details.full_name` | `identity.fullName` | `index.ts:163` |
| `extensions.rolecall.details.title` | `identity.title` | `index.ts:164` |
| `extensions.rolecall.details.age` | `identity.age` | Free TEXT in RC ("23", "ageless"), never an int (`index.ts:58,165`). |
| `extensions.rolecall.details.pronouns` | `identity.pronouns` | `index.ts:166` |
| `data.alternate_greetings` + `extensions.rolecall.alternate_greeting_titles[]` | `greetings.alternateGreetings[].title` | Parallel array merged in by index; title omitted per-greeting when its slot is `null` (`titledGreetings`, `index.ts:97-108,168-169`). |
| `extensions.rolecall.details.prompt_depth_injections[]` | `prompts.depthInjections[]` (origin `rolecall_details`) | `content`->`text`, `depth` default `4`, `role` default `"system"`; CONCATENATED with the shared `extensions.depth_prompt` entry (origin `depth_prompt`), details first (`depthInjections`, `index.ts:110-121,174-175`). See [Escrow and round-trip](#escrow-and-round-trip) for the write-side asymmetry. |
| `extensions.rolecall.details.{signature_color,gradient_colors,colors,fieldOrder,default_background,publicDefinitionDisplay,media_links}` | `presentation.*` | The casting-card layer: signature color, gradient, palette, background ref, field display order, spoiler config, external media links (`presentation`, `index.ts:123-149`). |
| `data.assets[]` | `media.portrait` + `media.assets[]` | CCv3 asset array via the shared `assetsToMedia`, dialect `"rolecall"`; real RC emits expression sprites as `type:"expression"`, mapped to canonical role `"emotion"` (`assets.ts:69-78,147-148`, `index.ts:180-181`). |
| PNG carrier pixels | `original.rolecall.sourceMedia` | The PNG file is kept as a raw-bytes twin (`pngSourceMedia`, `png.ts:39-42`, `index.ts:373`). |

`data.extensions.rolecall.details` is not a flat object: `full_name`/`title`/`age`/`pronouns` land on
`identity`, everything else lands on `presentation` (see the row above). `id`, `nsfw` (the legacy boolean,
superseded by `content_rating`), `image_url`/`thumbnail_url`, `loadout`, `recommendations`,
`trackerPreset`, and `linkedLorebooks`/`linkedRegexScripts` have no canonical slot on this codec today and
ride the whole-card escrow untouched; see [Escrow and round-trip](#escrow-and-round-trip).

The portable `data.character_book` relationship is owned by the shared bundle layer rather than the
RoleCall extension block. Export re-embeds the resolved canonical lorebooks, while an explicitly empty
resolution removes a stale book inherited from the cloned card twin (`index.ts:394-395`,
`character-book.ts:462-478`).

### Lorebook

The canonical lorebook entry is flat, but the RC v1 wire nests each entry into named groups
(`RoleCallEntryV1`). The codec re-nests on export (`entryToWire`, `lorebook.ts:191-254`) and flattens on
import (`entryToCanonical`, `lorebook.ts:67-138`):

| Canonical | RC v1 wire group | Notes |
| --- | --- | --- |
| `triggerMode`, `triggers`, `secondaryTriggers`, `selectiveLogic` | `triggers.{mode,primary,secondary,selectiveLogic}` | `lorebook.ts:88-91,201-206` |
| `caseSensitive`, `matchWholeWords`, `scanDepth` | `matching.*` | `lorebook.ts:93-95,207-211` |
| `position`, `depth`, `role` | `injection.*` | `lorebook.ts:97-99,212` |
| `sortOrder`, `priority` | `priority.*` | `lorebook.ts:101-102,213` |
| `sticky`, `cooldown`, `delay` | `timing.*` | `lorebook.ts:104-106,214` |
| `groupName`, `categoryId`, `groupWeight` | `grouping.*` | `lorebook.ts:108-110,215` |
| `useMemo`, `excludeRecursion`, `preventRecursion`, `delayUntilRecursion`, `ignoreBudget` | `advanced.*` | `lorebook.ts:114-117,126,217-223` |
| `characterFilter` | top-level `characterFilter` | Via the shared `parseCharacterFilter` (`lore-enums.ts:28-36`, `lorebook.ts:119,224-226`). |
| `scanCharacterDescription`, `scanCharacterPersonality`, `scanUserPersona`, `scanScenario` | `scanSources.*` | `lorebook.ts:121-124,227-232` |
| `probability`, `sideEffects`, `metadata` | top-level `probability`/`sideEffects`/`metadata` | `sideEffects`/`metadata` are additive: emitted only when present (`lorebook.ts:112,135-136,216,235-238`). |
| `vectorized`, `groupOverride`, `useGroupScoring`, `automationId`, `scanCharacterDepthPrompt`, `scanCreatorNotes` | `unsupportedFields.{vectorized,groupOverride,useGroupScoring,automationId,matchCharacterDepthPrompt,matchCreatorNotes}` | ST-origin toggles RC preserves in its own escape hatch; first-classed here as canonical slots (`lorebook.ts:128-133,239-252`). |

Book-level settings map to `lorebook.settings.*`, `lorebook.metadata.*`; categories to
`lorebook.categories` (`bookToCanonical`/`bookToWire`, `lorebook.ts:140-177,256-300`). RC v1 emits exactly
four scan sources (characterDescription, characterPersonality, userPersona, scenario) - canonical
`scanPreset` has no RC v1 wire slot and is not read or written by this codec.

## Escrow and round-trip

The escrow envelope is the canonical wrapper's `original` field, keyed by format id (`canonical.ts:39-51,80`).
The architecture calls this concept "escrow"; the wrapper field is named `original`. The character and
lorebook codecs each store their twin under their own adapter id.

**Character.** On import, the whole parsed card rides in `original.rolecall.raw`, alongside the PNG
carrier when the input was a PNG (`index.ts:367-374`). On export, `fromCanonical` clones that raw card (or
starts a fresh V3 envelope when there is none), overlays the shared Tavern fields via `applyBodyToData`,
merges media via `applyMediaToTavernData` under dialect `"rolecall"`, then overlays the RC layer via
`applyBodyToRcExt` (`index.ts:377-397`). `applyBodyToRcExt` uses the same three-state overlay as the shared
writer for the four presentation fields it promotes to first-class slots (`gradientColors`, `palette`,
`background`, `fieldOrder`): it decodes the twin's presentation BEFORE mutating `details` so "untouched",
"edited", and "cleared" are distinguished correctly even though it is rebuilding one nested JSON object in
place, not swapping a top-level key (`index.ts:230-249,271-334`). Scalars (`tagline`, `genre`, `fandom`,
`rating`, `sourceUrl`, `publicNote`, the four `details` identity fields) are written whenever the canonical
value is defined; a cleared value that was previously on the twin is left as-is on these particular fields
rather than deleted (`index.ts:214-226`).

**Depth-injection asymmetry.** Import concatenates the RC-native `rolecall_details`-origin entries with
the single shared `depth_prompt`-origin entry (`index.ts:110-121,174-175`). Export only re-derives the
`depth_prompt`-origin entry, via the shared `applyBodyToData`, which finds the first canonical entry whose
`origin` is `"depth_prompt"` and writes it back onto `extensions.depth_prompt`
(`tavern-fields.ts:284-296`). `applyBodyToRcExt` never writes `details.prompt_depth_injections` at all - so
editing, adding, or removing a `rolecall_details`-origin entry in canonical has no effect on export; that
wire slot keeps re-emitting verbatim from the untouched raw twin. This is confirmed by a regression test
that edits only the `depth_prompt` entry and asserts the details array still has its original length
(`rolecall.test.ts:176-184`).

**Lorebook.** The whole parsed export rides in `original["rolecall-lorebook"].raw`, so raw-only carriers
the canonical body does not model (the category `tree`, per-entry runtime junk inside `unsupportedFields`)
survive a round-trip verbatim. Export overlays the canonical body onto a clone of the raw wire and matches
entries by id; a from-scratch canonical (no escrow) serializes fresh defaults (`lorebook.ts:314-336`).
`budgetMode`/`entryBudget` are written only when the twin already had them, or (for a from-scratch book)
only when they differ from their defaults - a real RC export omits both at defaults, and always writing
them would mutate an unedited real export by two fabricated keys (`lorebook.ts:265-267,279-280`).
`exportDate` is preserved from the twin when present and only regenerated for a from-scratch export
(`lorebook.ts:330-334`) - note this differs from `specs/formats/rolecall-lorebook.md`'s description of real
RoleCall always minting a fresh `exportDate` on every export; that spec describes the *source* product's
serializer, not this codec, and code wins.

## Quirks

- RC's V3 `source` is a nonstandard OBJECT array (`[{name}]`, not the base spec's `string[]`). The shared
  Tavern reader only decodes a `string[]` shape, so RC's object-form `source` reads as canonical
  `undefined`; provenance is carried instead on `attribution.creator`. Because the shared writer's
  three-state overlay only clears a slot it can *represent*, it never writes `[]` over a twin it decoded as
  undefined, so the untouched object-form `source` rides the raw twin unmolested
  (`tavern-fields.ts:233-236`).
- `alternate_greeting_titles` is written only when at least one greeting actually carries a title; an
  all-untitled greetings edit omits the key rather than writing an array of `null`s (`index.ts:225-226`).
- `default_background`'s ref can live at `customUrl` or `backgroundId`. Export keeps whichever slot the
  twin already used; only a from-scratch background (no prior slot on either) falls back to sniffing the
  ref string itself via `isUrlOrDataRef` (`index.ts:204-206,311-327`).
- Real RC sprites emit `type:"expression"`, not `type:"emotion"`; the shared asset-role map accepts both
  spellings and reads either to canonical role `"emotion"` (`assets.ts:69-78,147-148`). hoplight's own test
  fixtures (as opposed to the samples under `samples/rolecall/`) use the unrealistic `"emotion"` spelling -
  see `samples/rolecall/SOURCES.md`, "Why these differ from the in-repo hoplight fixtures".
- Persona codec (`rolecall-persona`, kind `persona`). The USER-identity entity: `{{user}}`'s voice, first
  person. Two shapes, both claimed at `1.0` (`persona.ts:254-256`): the native `rcpersona` envelope
  (`{ spec: "rolecall_persona", spec_version, data }`, `personaRcExt`/`detectShape` at `persona.ts:48-62`)
  and RC's live production export, a `chara_card_v2`-lookalike whose `extensions.rolecall.type` is the
  literal `"persona"` - the exact discriminator the character adapter checks to step aside (see
  [Detection](#detection)).
  - `rcpersona`: `data.description` is the BRIEF (library blurb), `data.content` the injected text; when
    `content` is empty, `sections` compile in fixed order (appearance, body, personality, quirks, history)
    as `"Label: text"` blocks (`compileSections`, `persona.ts:69-80`). Canonical keeps BOTH `content` and
    `sections` so the editor can offer structured editing either way.
  - `rc-v2-export`: the V2 `description` slot is a FOLD of `content` plus `Appearance:`/`Body:` paragraphs,
    reversed on read by `unfoldDescription` and rebuilt on write by `foldDescription`
    (`persona.ts:149-162,203-208`); `creator_notes` carries the brief, `personality`/`scenario` carry the
    personality/history sections, and the `rolecall` side-channel carries identity attrs
    (tagline/age/height/pronouns), theming (signature_color/colors/image_url), `section_order`, lorebook
    linkage (`lorebook_id`), and `is_after_dark` - OMITTED, never written `false`, when the rating is not
    explicit or mature (`persona.ts:164-242,238-239`).
  - The load-bearing rule across both shapes: `brief` and `content` never swap - that exact swap was a live
    RC production bug, fixed and pinned by RC's own persona-roundtrip suite; hoplight replicates the fixed
    behavior (`persona.ts:1-11`). Legacy library-export wrappers (`{ exportedAt, type, data }` then
    `{ persona }`) unwrap outer-first before shape matching (`unwrapPersonaJson`, `persona.ts:35-41`). A
    missing name fails the parse - never synthesized (`persona.ts:264`).
  - Not built in this codec: `specs/formats/rolecall-character.md` (sections 2 and 5) describes an
    aspirational PNG-keyword precedence reader (`ccv3` > `chara` > `rcpersona` > `persona`) and a legacy
    RoleOut import path. Neither exists in this repo's code: the shared `readCardJson` used by both the
    character and persona adapters only ever extracts a `chara`/`ccv3` tEXt chunk
    (`card-io.ts:9-21`, `png.ts:52-65`); a PNG carrying only an `rcpersona` chunk is not read by any codec
    here today. Flagged as design intent, not verified against source.
- Regex codec (`rolecall-regex`, kind `regex`). Models RC's live chat-pipeline subsystem only (subsystem A,
  `find_pattern`/`replace_string`/`placement[]`); a documented-dead second subsystem in RC's own source is
  not modeled here at all (`regex.ts:1-27`). `detect()` scores `0.9` for a script object whose `rules[]` is
  non-empty and every rule looks RC-shaped; an array of scripts is deliberately not claimed, since one file
  is one entity and a multi-script dump would be several sets in one file (`regex.ts:176-200,208-210`).
  Placements map 1:1 to canonical phases (`user_input`/`ai_output`/`display_only`/`prompt_only`/`lorebook`/
  `reasoning` <-> `input`/`output`/`display`/`prompt`/`lorebook`/`reasoning`, `regex.ts:35-64`); an unmapped
  placement string passes through verbatim (open union, forward-compatible), and a canonical phase this
  codec cannot map back to a placement is dropped on export, never guessed (`regex.ts:67-71`). RC's own
  wire has no `substitution` field, so this codec never reads or writes canonical `substituteFind` for
  RoleCall - a correction against `core/regex/platform-fields.ts`, which currently lists it as an RC-owned
  extra (`regex.ts:14-18`). Unknown rule-level keys ride `RegexRule.extras` and re-emit verbatim
  (`regex.ts:74-88,96-99,129`).
- `coverage.ts` is the RC tab's ground truth for the studio's editor lens, not a round-trip mechanism; it
  is not consulted by `toCanonical`/`fromCanonical`.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter (detect, toCanonical, fromCanonical) | `src/formats/rolecall/index.ts` |
| Lorebook codec | `src/formats/rolecall/lorebook.ts` |
| Persona codec | `src/formats/rolecall/persona.ts` |
| Regex codec | `src/formats/rolecall/regex.ts` |
| Shared Tavern field map (`data` <-> canonical) | `src/formats/_shared/tavern-fields.ts` |
| Shared lore int-enum + character-filter decoders | `src/formats/_shared/lore-enums.ts` |
| CCv3 `assets[]` <-> media | `src/formats/_shared/assets.ts` |
| PNG chunk read/write | `src/formats/_shared/png.ts` |
| Card/JSON input readers | `src/formats/_shared/card-io.ts` |
| Coverage declaration | `src/formats/rolecall/coverage.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Persona canonical schema (no dedicated entity page yet) | `src/entities/persona/schema.ts`, [fields.persona.md](../../generated/fields.persona.md) |
| Design intent (verify against code, not authoritative on its own) | `specs/formats/rolecall-character.md`, `specs/formats/rolecall-lorebook.md` |
| Samples | `samples/rolecall/` (a character card and a lorebook export, constructed from RoleCall's own serializer source - no genuine RC export file was found on disk; see `samples/rolecall/SOURCES.md`) |
