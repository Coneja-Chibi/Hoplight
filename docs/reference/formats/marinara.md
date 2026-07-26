---
id: reference/formats/marinara
title: Marinara format
audience: dev
summary: How the Marinara-Engine adapters map regex scripts, personas, lorebooks, and presets through the canonical model.
tags: [format, marinara, regex, persona, lorebook, preset]
related: [reference/architecture, reference/entities/lorebook, reference/entities/persona, reference/entities/preset, reference/entities/regex]
---

# Marinara format

Marinara-Engine is a roleplay platform whose server exposes regex scripts and personas as API data and
lorebooks and prompt presets as versioned export envelopes. The adapters read those native shapes without
adding a Hoplight wrapper.

The format is one folder, `src/formats/marinara/`, whose `index.ts` default-exports four codecs:

- `marinara-regex`, kind `regex`, reads a bare `MarinaraRegexScript[]` API dump array, writes `.json`.
- `marinara-persona`, kind `persona`, reads a Marinara persona object (sections plus theming), writes `.json`.
- `marinara-lorebook`, kind `lorebook`, reads the `marinara_lorebook` export envelope, writes `.json`.
- `marinara-preset`, kind `preset`, reads the `marinara_preset` export envelope, writes `.json`.

There is no `marinara` character adapter. A Marinara character card is Tavern-shaped and reads through
the `sillytavern` adapter; the Marinara-specific fields with no canonical home ride the generic CCv2/V3
`extensions` bag instead of a dedicated wire format, and are declared for the editor's Marinara lens in
`src/formats/_shared/extension-platforms.ts`, not mapped by anything in this folder (`index.ts:1-5`). See
[Quirks](#quirks) for what that lens covers.

For canonical field meanings, see the [lorebook](../entities/lorebook.md),
[persona](../entities/persona.md), [preset](../entities/preset.md), and [regex](../entities/regex.md)
entity references. For the hub-and-spoke, escrow, and detection model, see
[architecture.md](../architecture.md). For the whole matrix of formats, see
[FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md).

@fig codecs

## Detection

The registry runs every adapter's `detect()` and keeps the single highest score above `0.5`, so more
specific formats outrank generic ones (`architecture.md`, "Detection and the registry").

### Regex

`detect()` returns `0.95` for a recognizable Marinara dump, `0` otherwise (`index.ts:69-71`). It is `0.95`,
not lower, because SillyTavern's regex codec also claims `0.9` on the same wire shape: both dialects carry
`findRegex`/`replaceString` on every row. The ST-form fixture used in this adapter's own tests is even
named `_fixtures/regex/marinara-essentials.json` despite being an ST-dialect pack
(`marinara.test.ts:1-5,13-16`).

`readMarinaraRows` runs four gates in order, returning `null` on the first failure (`index.ts:50-59`):

1. The JSON must parse to a non-empty array whose every entry is a plain object (`index.ts:52-54`).
2. Any row carrying an ST `scriptName` key hard-rejects the whole file: that key means ST dialect, not
   Marinara (`index.ts:55`).
3. Every row must parse as a `MarinaraRegexScript` via `readMarinaraRegexScript`, which requires a string
   `id` and a string `findRegex` (`index.ts:56`, `marinara-regex.ts:79-100`).
4. At least one row must carry a Marinara-distinct signal: `targetCharacterIds`, `order`, or a `placement`
   array containing `"ai_output"` or `"user_input"` (`index.ts:41-47,57`). ST's placement is numeric, so
   this signal never appears on a real ST row.

The inverse is safe by construction: a real ST regex row always carries `scriptName`, so this adapter
always scores `0` on it and the ST codec keeps importing its own files (`marinara.test.ts:67-71`).

@fig detect

### Persona

`detect()` returns `0.95` for a recognizable Marinara persona object, `0` otherwise (`persona.ts:36-38`).
`readMarinaraPersona` requires all three (`persona.ts:24-26`):

- A string `id` and a string `name`.
- A string `description` and a string `personality`.
- At least one theming or stat signal: `nameColor`, `boxColor`, or `personaStats`.

The codec's own comment calls this combination "disjoint from Lumi/ST/RC" (`persona.ts:20`): a plain
`{ id, name, description }` object from another platform is missing either `personality` or a theming key,
so it fails gate two or three before any name-based disambiguation is needed.

### Lorebook

`marinara-lorebook` returns `1.0` only for an object tagged `type: "marinara_lorebook"` whose `data`
object contains an `entries` array (`lorebook.ts:433-449`). The unique envelope tag is the format
firewall; version, book metadata, and folders remain tolerant data rather than detection requirements.

### Preset

`marinara-preset` returns `0.95` only for `type: "marinara_preset"` with an object at `data.preset` and
an array at `data.sections` (`preset.ts:72-80,415-421`). Groups and choice blocks are optional. The
codec accepts the engine's raw database-row encoding, where many booleans and nested objects are JSON
strings rather than native JSON values.

## Field map

### Regex

The wire row is `MarinaraRegexScript` (`marinara-regex.ts:33-49`), one row per canonical `RegexRule`. See
[entities/regex.md](../entities/regex.md) for what each canonical field means.

| Marinara field | Canonical path | Notes |
| --- | --- | --- |
| `id` | `id` | `marinara-regex.ts:160` |
| `name` | `label` | `marinara-regex.ts:161` |
| `findRegex` | `find` | Bare pattern, no delimiters; Marinara stores flags separately, the Risu/RC/Lumi encoding. `marinara-regex.ts:162` |
| `flags` | `flags` | `marinara-regex.ts:163` |
| `replaceString` | `replace` | `marinara-regex.ts:164` |
| `trimStrings` | `trimStrings` | Empty array reads as `undefined`. `marinara-regex.ts:165,195` |
| `placement[]` | `phases[]` | `ai_output` maps to `output`, `user_input` maps to `input`; dedup, order preserved. `marinara-regex.ts:113-131,166` |
| `promptOnly` | `targets` | `true` maps to `["prompt"]`, `false` maps to `undefined`. `marinara-regex.ts:149-151,167` |
| `minDepth` / `maxDepth` | `minDepth` / `maxDepth` | Passthrough `number \| null`. `marinara-regex.ts:168-169` |
| `targetCharacterIds` | `characterIds` | Empty array reads as `undefined`. `marinara-regex.ts:170,199` |
| `enabled` | `enabled` | `marinara-regex.ts:171` |
| `order` | `sortOrder` | `marinara-regex.ts:172,200` |
| `createdAt` / `updatedAt` | `extras.marinaraCreatedAt` / `extras.marinaraUpdatedAt` | No canonical home for the timestamps. `marinara-regex.ts:173,203-204` |

The regex SET itself has no Marinara wire home. `RegexSetBody.name` comes from the imported filename via
the shared `setNameFromFilename` helper, because Marinara's own wire is a bare row array with no container
object (`index.ts:77`, `_shared/regex-set-name.ts:11-18`). `RegexSetBody.description` and the set-level
`enabled` toggle are never read from or written to a Marinara file at all.

### Persona

The wire object carries no spec or envelope name; it is whatever Marinara's persona API serves and is
recognized by the shape check in [Detection](#detection) (`persona.ts:21-27`). Canonical field meanings
are also documented in [entities/persona.md](../entities/persona.md); the type is `PersonaBody`
(`src/entities/persona/schema.ts`).

| Marinara field | Canonical path | Notes |
| --- | --- | --- |
| `name` | `name` | Required. `persona.ts:44` |
| `description` | `content` | The full first-person text injected as `{{user}}`'s voice. `persona.ts:45` |
| `comment` | `brief` | Library-card blurb. Set only when non-empty after trim. `persona.ts:47-48` |
| `appearance` | `sections.appearance` | Set only when non-empty after trim. `persona.ts:50` |
| `personality` | `sections.personality` | Set only when non-empty after trim. `persona.ts:51` |
| `backstory` | `sections.history` | Set only when non-empty after trim. `persona.ts:52` |
| `avatarPath` | `presentation.imageUrl` | Set only when truthy. `persona.ts:54-55` |
| (no wire field) | `attribution.source` | Always synthesized as the literal string `"marinara"`. The wire has no attribution field, so this never reads from a twin, it is stamped fresh on every import. `persona.ts:56` |

`id`, `scenario`, and every theming, stat, crop, tag, or timestamp field (`nameColor`, `dialogueColor`,
`boxColor`, `personaStats`, `avatarCrop`, `tags`, `savedStatusOptions`, `isActive`, `createdAt`,
`updatedAt`) have no canonical slot and ride sealed in escrow; see
[Escrow and round-trip](#escrow-and-round-trip).

### Lorebook

The native envelope contains one book row, entry rows, and folder rows. Book fields map name,
description, category, tags, enabled state, scan depth, recursive scanning, token budget, and entry
limit. Each entry maps plain-string primary and secondary keys, one shared `useRegex` flag, selective
logic, matching flags, injection position/depth/role, the single `order` axis, timing, groups, folder,
probability, recursion, character filters, and additional matching sources
(`lorebook.ts:84-230`). Marinara `order` maps to canonical `sortOrder`, never eviction `priority`.
Folder rows project to flat canonical categories; their `parentFolderId` and other engine-only fields
remain in escrow so nested trees survive an unedited round trip.

### Preset

The preset envelope maps section rows to canonical prompts, including role, enabled/marker state,
group, ordered versus depth placement, XML wrapping, override refusal, and marker slot
(`preset.ts:88-121`). Group rows map parent, order, and enabled state. Choice blocks map question,
variable name, single versus multi-select, JSON-string options, separator, random pick, and sort order.
The parameters JSON string supplies supported samplers plus squash-system-messages, show-thoughts, and
reasoning-effort API options (`preset.ts:123-200`). Conversation/game prompts, variable storage,
unmapped parameters, authoring metadata, and other engine-only fields stay in the raw twin.

## Escrow and round-trip

The escrow envelope is the canonical wrapper's `original` field, a `Record<FormatId, OriginalEntry>` keyed
by format id (`canonical.ts:39-51,80`). The architecture calls this concept "escrow"; the wrapper field is
named `original`. Each Marinara codec stores its twin under its own adapter id, but the codecs consult
those twins differently on export.

The regex codec seals the entire imported row array verbatim on import, `original["marinara-regex"] = {
raw: rows }` (`index.ts:85`), then does not read it back on export: `fromCanonical` builds the output rows
straight from `entity.body.rules` via `rulesToMarinaraScripts` and never touches `entity.original`
(`index.ts:89-92`). Round-trip fidelity comes entirely from `ruleToMarinaraScript` being a total inverse of
`marinaraScriptToRule`, not from overlaying onto the raw twin the way the persona codec below and the
SillyTavern character codec do (`marinara-regex.ts:158-206`, pinned by the deep-equal round-trip test at
`marinara.test.ts:86-94`). Every wire field either has a canonical slot or rides in `extras`
(`createdAt`/`updatedAt`), so nothing is lost on an unedited Marinara-to-Marinara round trip; the stored
`raw` is not read back on export.

The persona codec, by contrast, does overlay onto the twin. `toCanonical` seals the whole imported object,
`original["marinara-persona"] = { raw: w }` (`persona.ts:62`). `fromCanonical` clones that twin, spreads it
first, then overwrites only the fields the codec maps: `id`, `name`, `comment`, `description`,
`personality`, `appearance`, `backstory`, `avatarPath` (`persona.ts:67-80`). An unedited round trip is
structurally lossless: mapped values re-derive unchanged, and theming, stats, crop, tags, scenario, and
timestamps ride the twin. JSON whitespace and object-key order are not preserved. A from-scratch persona has no wire twin, so export
materializes Marinara's minimum readable shape: a derived wire `id`, `name`, `description`, a possibly
empty `personality`, and a disabled empty `personaStats` signal. Optional authored and presentation fields
remain absent until the canonical persona supplies them (`persona.ts`).

The two ids diverge. The canonical entity's own `id` is the hub id every adapter mints the same way,
`canonicalId(body.name)` (`canonical.ts:23`), and has no relation to Marinara's own wire `id` field.
`toCanonical` never reads `w.id` into the canonical body at all; `fromCanonical` writes the wire `id` from
the sealed twin, falling back to `canonicalId(name)` only when there is no twin (`persona.ts:60,72`). The
canonical entity id is the storage key; the wire `id` is Marinara's own business-object id, carried through
escrow, never derived from name on a real import.

The lorebook and preset codecs both clone their complete native envelope and patch mapped values against
the twin's own decode. Lorebook entries match by id, book scalars update only when canonical values
change, and folder rows retain parent links and engine-only state (`lorebook.ts:232-430`). Preset
sections, groups, and choices also match by stable id; supported parameters are merged into the original
JSON string while unmapped keys survive (`preset.ts:202-412`). A from-scratch entity emits a minimal
native envelope instead. These are structural JSON round trips, not byte preservation of whitespace.

## Quirks

- Detection firewall against SillyTavern. Both wires carry `findRegex`/`replaceString` on every row, so a
  Marinara dump also satisfies the ST regex codec's row check and ST bids `0.9` on it. The Marinara codec
  closes this with the four gates above and then outbids ST at `0.95`. See [Detection](#detection).
- Empty persona sections are omitted, not blanked. On import, `appearance`, `personality`, and `backstory`
  only populate `sections` when the source string is non-empty after `trim()`; an absent or
  whitespace-only field is left out of `sections` entirely rather than stored as `""` (`persona.ts:50-53`).
- Clearing a persona section on export is a real `""`, not a revert to the twin. `sections.personality` set
  to the empty string, as opposed to `undefined`, short-circuits the `?? str(base.personality)` twin
  fallback, because `??` only falls through on `null`/`undefined`, not `""`. A cleared section survives
  export as `""` instead of reverting to the sealed twin's old value (`persona.ts:76`, regression-pinned at
  `persona.test.ts:53-60`).
- `avatarPath` is optional. A fresh export does not fabricate it. On an imported twin, clearing the
  canonical image deletes the existing key; unchanged absence remains absent (`persona.ts:109-114`).
- The character-side Marinara dialect is not this folder. A Marinara character card reads through the
  `sillytavern` adapter; the fields with no canonical home (`backstory`, `rpgStats.enabled`,
  `rpgStats.attributes[]`, `rpgStats.hp`, `avatarCrop`, `trackerCardColors`, `nameColor`, `dialogueColor`,
  `boxColor`) are declared for the editor's Marinara lens in `_shared/extension-platforms.ts:55-71`, not
  mapped by any code under `formats/marinara/`.
- No design spec on file. Unlike some format families, there is no `specs/formats/marinara*.md` design
  document in this checkout; this page is sourced from `src/formats/marinara/` and its tests directly.

## Source of truth

| Concern | File |
| --- | --- |
| Regex adapter (detect, toCanonical, fromCanonical) | `src/formats/marinara/index.ts` |
| Persona adapter (detect, toCanonical, fromCanonical) | `src/formats/marinara/persona.ts` |
| Lorebook adapter | `src/formats/marinara/lorebook.ts` |
| Preset adapter | `src/formats/marinara/preset.ts` |
| Shared Marinara regex-script mapping | `src/formats/_shared/marinara-regex.ts` |
| Regex set filename-derived naming | `src/formats/_shared/regex-set-name.ts` |
| JSON boundary readers (`readJsonAny`, `readJsonObject`) | `src/formats/_shared/card-io.ts` |
| Character-side Marinara extensions lens (not this folder) | `src/formats/_shared/extension-platforms.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Regex entity (canonical fields) | `src/entities/regex/schema.ts`, [entities/regex.md](../entities/regex.md) |
| Persona entity | `src/entities/persona/schema.ts`, [entities/persona.md](../entities/persona.md) |
| Tests | `src/formats/marinara/*.test.ts` |
| ST-dialect regression fixture | `src/formats/_fixtures/regex/marinara-essentials.json` |
