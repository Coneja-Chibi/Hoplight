---
id: reference/formats/agnai
title: Agnai format
audience: dev
summary: How the Agnai adapter family detects, maps, and round-trips its native character JSON and memory-book lorebooks, including the embedded characterBook, through the canonical model.
tags: [format, agnai, character, lorebook, persona, memory-book]
related: [reference/architecture, reference/entities/character, reference/entities/lorebook]
---

# Agnai format

Agnai (Agnaistic) is a browser/self-hosted AI roleplay app with its own native JSON character shape. It
is not Tavern-lineage: instead of a flat description block, its persona is structured, a `kind` plus an
attribute map, which is exactly what the canonical [`persona.structured`](../entities/character.md#persona-and-voice)
field exists to preserve. Every adapter here reads and writes `.json`.

The format is one folder, `src/formats/agnai/`, whose `index.ts` default-exports two codecs
(`index.ts:363`):

- `agnai`, kind `character`, reads and writes JSON.
- `agnai-lorebook`, kind `lorebook`, reads and writes JSON. This is Agnai's standalone memory book; the
  same MemoryBook shape also comes embedded inside a character as `characterBook`, see
  [Escrow and round-trip](#escrow-and-round-trip).

This page documents both codecs in full. The Agnai schema was read from Agnai's own source
(`common/types/library.ts`, `common/adapters.ts`, `common/types/memory.ts`, `common/memory.ts`,
`common/types/texttospeech-schema.ts`, `common/types/sprite.ts`, `common/types/image-schema.ts`;
AGPL-3.0) as interop facts only, no Agnai code is copied (`index.ts:1-7`, `samples/agnai/SOURCES.md`).
For the canonical field meanings this format maps onto, see
[entities/character.md](../entities/character.md) and [entities/lorebook.md](../entities/lorebook.md). For
the hub-and-spoke, escrow, and detection model, see [architecture.md](../architecture.md). For the whole
matrix of formats, see [FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md).

@fig codecs

## Detection

The registry runs every adapter's `detect()` and keeps the single highest score above `0.5`, so more
specific formats outrank generic ones (`architecture.md`, "Detection and the registry").

### Character

`detect()` parses the input as JSON and returns `1.0` only when all five hold, `0` otherwise
(`index.ts:312-329`):

- `kind === "character"`,
- `persona` is a non-null object,
- `greeting` is a string,
- `schemaVersion` is `undefined`,
- `body` is `undefined`.

The last two clauses are the firewall against hoplight's own native wrapper: a `vaud-json` entity carries
`schemaVersion` and `body`, so requiring both absent stops Agnai from fighting `vaud-json` on the same
file (`index.ts:317-324`). A parse failure or missing text returns `0` (`index.ts:313-314,326-327`).
Agnai scores `1.0`, not `0.9`, because it is a specific, self-identifying shape: no other adapter claims
a superset of it the way RoleCall claims a superset of a SillyTavern card.

### Lorebook

`agnai-lorebook` reads the input as a memory book via `coerceMemoryBook` and scores (`lorebook.ts:305-313`):

- `1.0` when the unambiguous `kind: "memory"` marker is present (`lorebook.ts:285,309`).
- `0.9` for a kind-less book whose `entries` is an array and whose first entry still carries the native
  `entry` + `keywords` shape (`lorebook.ts:286-290,309`). This is what distinguishes a native Agnai book
  from a bare CCv3 `character_book`, whose entries use `content`/`keys` instead.
- `0.7` for a standalone CCv3/Chub-style `character_book` (`isStandaloneCharacterBook`, entries carry
  `keys` and/or `content`), re-exported as a real MemoryBook (`lorebook.ts:310-311`,
  `_shared/character-book.ts:270-284`).
- `0` otherwise, including a SillyTavern worldbook (`entries` is a keyed object, not an array) and a Risu
  native envelope (no top-level `entries` array).

## Field map

Decode (`toCanonical`) via `cardToBody` / `bookToCanonical`, encode (`fromCanonical`) via
`applyBodyToCard` / `canonicalToMemoryBook`. Only string values survive character decode (a tolerant
`str()`/`strList()` returns `undefined` for the wrong type); only defined values are written back on
encode.

### Character

| Source field | Canonical path | Notes |
| --- | --- | --- |
| `name` | `identity.name` | Defaults to `""` when absent. `index.ts:178` |
| `description` | `identity.description` | `index.ts:179` |
| `characterVersion` | `identity.characterVersion` | `index.ts:180` |
| `culture` | `identity.culture` | Agnai-only; drives default language/voice selection. `index.ts:181` |
| `persona` | `persona.personality` + `persona.structured` | See the persona notes below the table. `index.ts:175,183-187` |
| `scenario` | `persona.scenario` | `index.ts:185` |
| `appearance` | [`persona.appearance`](../entities/character.md#persona-and-voice) | Agnai-only free-text physical description, kept out of `description` so it can drive image generation. `index.ts:186` |
| `voice` + `voiceDisabled` | `persona.voice` | Discriminated on `service` -> `Voice.provider`; `voiceId`/`rate`/`pitch` are first-classed, everything else rides `Voice.extras`. `index.ts:70-80,188` |
| `imageSettings.{prefix,suffix,negative,template}` | `persona.imagePrompt` | The authored affixes only; sampler/provider knobs stay on the escrow twin. `index.ts:118-126,189` |
| `systemPrompt` | `prompts.systemPrompt` | `index.ts:192` |
| `postHistoryInstructions` | `prompts.postHistoryInstructions` | `index.ts:193` |
| `prefill` | [`prompts.prefill`](../entities/character.md#prompts-and-injections) | Agnai's assistant-response prefill, prepended to the model reply, common with Claude. `index.ts:194` |
| `insert` | `prompts.depthInjections[0]` | `{ depth, prompt }`. Agnai's one fixed-depth slot; a canonical entity with multiple depth injections keeps only the first on export. `index.ts:195,238-240` |
| `greeting` | `greetings.firstMessage` | `index.ts:198` |
| `alternateGreetings` | `greetings.alternateGreetings[].text` | Bare strings wrapped as `{ text }`; on encode only `.text` is written, so a greeting `title` from another format is dropped. `index.ts:199,231` |
| `sampleChat` | `examples.exampleMessages` | `index.ts:201` |
| `avatar` | `media.portrait` | Face image (data URI or URL, not the sprite recipe). Mime is guessed from the data URI or file extension, `undefined` when unknown. `index.ts:128-151,203` |
| `sprite` | `media.sprite` | Agnai's `FullSprite` is flat (part keys plus `eyeColor`/`bodyColor`/`hairColor`/`gender` at one level); it decodes to `{ parts, ...specials }`. `index.ts:92-107,204` |
| `visualType` | `media.visualKind` | Which visual mode the creator chose, `"avatar"` or `"sprite"`. `index.ts:205` |
| `creator` | `attribution.creator` | `index.ts:207` |
| `tags` | `discovery.tags` | `index.ts:208` |
| `json` | `settings.responseSchema` | Agnai's structured-output `ResponseSchema`, carried verbatim-editable. `index.ts:209` |
| whole card | `original.agnai.raw` | Kept verbatim so the round-trip is lossless. `index.ts:342` |

Agnai's `persona` is `{ kind, attributes }`, where `kind` is one of `boostyle | wpp | sbf | attributes |
text` and `attributes` is `Record<string, string[]>` (`index.ts:29,31-34`). It decodes via `toStructured`
(`index.ts:159-165`):

| Agnai `persona.kind` | Canonical result |
| --- | --- |
| `"text"` | `structured = { kind: "text" }`; `persona.personality = attributes.text[0]` |
| `boostyle` / `wpp` / `sbf` / `attributes` | `structured = { kind, attributes: attributes ?? {} }`; `personality` stays unset |

A plain-text persona lands in the human-readable `personality` field, with `structured` recording that it
was text; a W++/square-bracket/boostyle attribute map is preserved intact in `structured.attributes`. The
union is designed so illegal states are unrepresentable: `{ kind: "text" }` carries no attributes, and
every attribute-map kind requires its attributes.

Encode via `toAgnaiPersona` goes the other way (`index.ts:168-172`): if `structured` is present and its
`kind` is not `"text"`, it emits `{ kind, attributes }` verbatim; otherwise it emits a text persona,
`{ kind: "text", attributes: { text: [personality ?? ""] } }`. `applyBodyToCard` calls this
unconditionally, so `persona` is always rebuilt from canonical rather than overlaid onto the twin
(`index.ts:241`); see [Escrow and round-trip](#escrow-and-round-trip) for the one place that costs.

### Lorebook

Agnai's `MemoryEntry` uses field names that differ from CCv3: the content is `entry` (not `content`), the
keywords are a plain array `keywords` (not a CSV string), and the two ordering axes are both explicit,
`weight` for placement and `priority` for eviction (`lorebook.ts:1-22,41-59`).

| Source field | Canonical path | Notes |
| --- | --- | --- |
| `name` | `title` | Falls back to `Entry N` when absent. `lorebook.ts:101` |
| `entry` | `content` | `lorebook.ts:102` |
| `comment` | `comment` | Agnai's own distinct note field, separate from `name` (unlike ST/Risu, where title and comment coincide). `lorebook.ts:103` |
| `enabled` | `enabled` | Defaults `true`. `lorebook.ts:105` |
| `constant` | `constant` | `lorebook.ts:106` |
| `keywords` | `triggers` | Plain strings, always `isRegex: false`; Agnai has no regex-key feature. `lorebook.ts:81-82,109` |
| `secondaryKeys` | `secondaryTriggers` | Plain strings. `lorebook.ts:97,110` |
| `selectiveLogic` | `selectiveLogic` | ST-import residue on the ST numeric convention (shared `lore-enums` decoder); absent defaults to `and_any`. `lorebook.ts:112`, `_shared/lore-enums.ts:16-17` |
| `position` | `position` | `before_char` maps to `world`, `after_char` maps to `character`, the ST-parity floor. `lorebook.ts:85,118` |
| `weight` | `sortOrder` | The placement axis. `lorebook.ts:122` |
| `priority` | `priority` | The eviction axis. `lorebook.ts:123` |
| `probability` + `useProbability` | `probability` | `useProbability !== false` gates it; clamped `0..100`, defaults to `100`. `lorebook.ts:92-96` |
| `excludeRecursion` | `excludeRecursion` | `lorebook.ts:136` |
| `scanDepth` | `globalScanDepth` | Book-level. `lorebook.ts:164` |
| `tokenBudget` | `tokenBudget` | Book-level. `lorebook.ts:166` |
| `recursiveScanning` | `globalRecursion` | Book-level. `lorebook.ts:165` |

`lorebookType` is a hardcoded `"other"` on import, since Agnai memory books are general library entities,
not character-scoped by default (`lorebook.ts:158`). `caseSensitive`, `matchWholeWords`, and `scanDepth`
are per-entry `null` (Agnai has no per-entry flags for them; scan depth is book-level) (`lorebook.ts:114-116`).

The `weight`/`priority` split is grounded in Agnai's own round-trip code: the codec's header comment
records that Agnai's `memoryEntryToNative` (`common/memory.ts`, not in this repo, cited as an interop
fact) maps CCv3 `insertion_order` to `weight` and CCv3 `priority` to `priority`, so `weight` to
`sortOrder` and `priority` to `priority` matches Agnai's own convention (`lorebook.ts:11-15`). That local
mapping (`weight` to `sortOrder`, `priority` to `priority`) is verified in this repo; the claim about
Agnai's own `memoryEntryToNative` is asserted by the comment, not independently checkable here.

## Escrow and round-trip

The escrow envelope is the canonical wrapper's `original` field, a `Record<FormatId, OriginalEntry>` keyed
by format id (`canonical.ts:39-51,80`). The architecture calls this concept escrow; the wrapper field is
named `original`. The character adapter stores its twin at `original.agnai`, the lorebook codec at its own
key, `original["agnai-lorebook"]`.

```
original.agnai = { raw: <the entire parsed card, verbatim> }
```

On export, `fromCanonical` deep-clones that raw card, or builds a minimal `baseCard()` when there is no
twin, for example a cross-format import, and overlays the canonical body onto it with `applyBodyToCard`,
then serializes with `JSON.stringify(card, null, 2)` (`index.ts:353-359,280-289`). Any raw key with no
canonical slot, `extensions`, `_id`, `userId`, survives verbatim through the clone.

The character overlay does not diff against the decoded twin the way the lorebook and SillyTavern
codecs do: `set()` unconditionally writes the current canonical value whenever it is defined, and deletes
a key only when canonical is undefined and the twin held a string or array (`index.ts:213-224`). For a
well-formed twin this produces the same output as a diff would; a malformed non-string value the importer
skipped is left untouched rather than stripped, because the delete branch only fires on a string or array
(`index.ts:221-224`).

`persona` is the exception: `applyBodyToCard` always rebuilds it from the canonical body via
`toAgnaiPersona`, never preserving the cloned raw persona (`index.ts:241`). For attribute-map kinds this
is exact. For a text persona whose `attributes.text` had more than one element, decode keeps only
`attributes.text[0]` as `personality` (`index.ts:162`), and encode re-emits `{ text: [personality] }`
(`index.ts:171`). A multi-element text array therefore collapses to its first element even on an Agnai to
Agnai round-trip; single-element text personas and all attribute-map personas are faithful.

The lorebook entry overlay, `entryToWire`, is a real three-state diff: with a twin present it clones the
twin and rewrites only the fields whose canonical value changed from the twin's own decode, so an
untouched entry re-emits byte-for-byte, including Agnai-only residue such as `selectiveLogic`
(`lorebook.ts:184-236`). Entries are matched to their twin by `id` (`canonicalToMemoryBook`, a `Map`
keyed by `id`, `lorebook.ts:238-247`). Optional book fields, `scanDepth`, `tokenBudget`,
`recursiveScanning`, preserve the twin's presence or absence rather than always emitting a default
(`lorebook.ts:248-256`), and `_id`/`userId` are never reintroduced. With no twin, `canonicalToMemoryBook`
starts from a clean `{ kind: "memory" }` object instead of a clone, so the book is written from the
canonical body alone (`lorebook.ts:243`).

Agnai's native character export also carries the character's lore inline as `characterBook`, a
MemoryBook, not a CCv3 `character_book` (`index.ts:1-7,55-56`). The character adapter implements the
optional `extractLorebook` hook (`src/core/adapter.ts:75`), reading
`card.characterBook` through the same `memoryBookToCanonical` the standalone `agnai-lorebook` codec uses
(`index.ts:346-351`, `lorebook.ts:267-276`), so a given MemoryBook canonicalizes identically whether it
arrives standalone or embedded, container-invariance by construction. `fromCanonical` re-embeds any linked
lorebook via `applyLorebook` / `canonicalToMemoryBook`, twin-overlaying its own `original["agnai-lorebook"]`
so a same-format round-trip with a book stays byte-identical; a foreign lorebook with no Agnai twin
full-encodes into a clean MemoryBook (`index.ts:291-303`). No book present means no `characterBook` key is
written, never an empty one. An explicitly resolved empty bundle also deletes a stale `characterBook`
from the cloned card twin (`index.ts:298-304`). The bundle layer's `inspectBundle` calls this override
instead of the shared CCv3 extractor used by Tavern-lineage formats (`convert.ts:44-49`).

## Quirks

- Two-state character overlay, three-state lorebook overlay. `applyBodyToCard`'s `set()` helper always
  writes the current canonical value and deletes only on a cleared string/array; it does not compare
  against the decoded twin. `entryToWire` on the lorebook side does compare, and only rewrites a changed
  field. Same observable result on well-formed input, different mechanism. `index.ts:213-224`,
  `lorebook.ts:184-236`.
- Persona is always rebuilt, never twin-preserved. A multi-element text persona (`attributes.text` with
  more than one string) collapses to its first element on any round-trip, including Agnai to Agnai,
  because `toStructured` only reads `attributes.text[0]` and `toAgnaiPersona` only writes one. `index.ts:162,171,241`.
- Detection's firewall is the absence of `schemaVersion`/`body`, not their presence. This is what keeps a
  `vaud-json` entity from being misread as an Agnai card on the same file. `index.ts:317-324`.
- `imageSettings` affixes reconcile per key, not as a whole block. `prefix`/`suffix`/`negative`/`template`
  are canonical's to write or clear; every other key on the twin's `imageSettings`, sampler steps, cfg,
  provider objects, survives an edit untouched because the merge starts from a clone of the twin.
  `index.ts:261-274`.
- `insert` is a single fixed-depth slot. Only `depthInjections[0]` re-encodes; the Agnai wire carries no
  role, origin, or enabled flag for it, so those `DepthInjection` fields stay `undefined` on decode.
  `index.ts:195,238-240`.
- The embedded `characterBook` is Agnai-native, not a CCv3 `character_book`. It is read and written by the
  character adapter's own `extractLorebook`/`applyLorebook`, using the same MemoryBook mapper as the
  standalone `agnai-lorebook` codec, not the shared `_shared/character-book.ts` mapper that Tavern-lineage
  formats use for their embedded books. `index.ts:55-56,291-303,346-351`.
- `selectiveLogic` is ST-import residue, not an Agnai-authored field. It appears only on entries an Agnai
  user imported from SillyTavern and uses the shared ST numeric convention (`0` and_any ... `3` and_all);
  a fresh cross-format encode never emits it, since Agnai's own editor never authors it. `lorebook.ts:112,221-225`,
  `_shared/lore-enums.ts:16-20`.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter (detect, toCanonical, fromCanonical, extractLorebook) | `src/formats/agnai/index.ts` |
| Memory book (lorebook) adapter + shared mappers | `src/formats/agnai/lorebook.ts` |
| Coverage declaration | `src/formats/agnai/coverage.ts` |
| Shared CCv3/Chub `character_book` mapper (the `agnai-lorebook` soft-import path) | `src/formats/_shared/character-book.ts` |
| Shared ST-numeric `selectiveLogic` decoder | `src/formats/_shared/lore-enums.ts` |
| Bundle extract/re-embed wiring | `src/convert.ts` (`inspectBundle`, `emitBundle`), `src/core/adapter.ts` (`extractLorebook`, `EmitContext`) |
| Canonical character schema | `src/entities/character/schema.ts` |
| Canonical lorebook schema | `src/entities/lorebook/schema.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Samples | `samples/agnai/` (native character export + `SOURCES.md`) |
| Fixtures | `samples/lorebooks/agnai/` |
| Interop reference (facts only, no code copied) | Agnai `common/types/library.ts`, `common/adapters.ts`, `common/types/memory.ts`, `common/memory.ts`, `web/pages/Memory` (`encodeBook`), `common/types/texttospeech-schema.ts`, `common/types/sprite.ts`, `common/types/image-schema.ts` (AGPL-3.0) |
