---
id: reference/formats/backyard
title: Backyard format
audience: dev
summary: How the Backyard.ai (Faraday) adapter family detects, maps, and round-trips legacy flat-JSON cards and modern .byaf archives through the canonical model.
tags: [format, backyard, byaf, faraday, character]
related: [reference/architecture, reference/entities/character]
---

# Backyard format

Backyard.ai (formerly Faraday.dev) has shipped two unrelated on-disk character shapes across its
lifetime. vaud reads and writes both. Neither is a Tavern superset: each carries its own vocabulary, and
each is handled by its own adapter.

The format is one folder, `src/formats/backyard/`, whose `index.ts` default-exports two codecs
(`index.ts:158-163`):

- `backyard`, kind `character`, reads a flat JSON object (`aiName` / `aiPersona` / `customDialogue` era).
  Writes `.json`.
- `byaf`, kind `character`, reads a `.byaf` ZIP archive (manifest + `characters/<id>/character.json` +
  one or more `scenarios/*.json` + images). Writes `.byaf`.

This page documents both in full. For the canonical field meanings each maps onto, see
[entities/character.md](../entities/character.md). For the hub-and-spoke, escrow, and detection model, see
[architecture.md](../architecture.md). For the whole matrix of formats, see
[FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md).

@fig codecs

## Detection

The registry runs every adapter's `detect()` and keeps the single highest score above `0.5`, so a more
specific format still outranks a generic one on a shared input (`architecture.md`, "Detection and the
registry").

### Legacy JSON

`detect()` reads only `input.text`, returning `0` immediately if there is no text, the text does not
parse as JSON, or the parsed value is not an object (`index.ts:100-108`). Otherwise it scores in two
tiers (`index.ts:109-111`):

- `0.9`: any of `aiName`, `aiPersona`, `aiDisplayName`, `customDialogue` is present as a string. These
  keys are Backyard-unique, so a match is a confident identification.
- `0.55`: `persona` is a string, `description` is `undefined`, and `kind` is not `"character"`. This is a
  weak fallback for a stripped card carrying only a `persona` field. The two extra guards exist so it does
  not misfire: `description === undefined` keeps it off a flat card that pairs `persona` with
  `description`, and `kind !== "character"` keeps it off an Agnai card, which sets `kind: "character"`.
- Otherwise `0`.

Both scores sit below the `1.0` adapters (RoleCall, Risu, Agnai) and the generic `0.9` Tavern reader on a
shared input. `0.55` clears the `0.5` recognition threshold but only just, by design.

### BYAF

`detect()` reads only `input.bytes`. It returns `0` unless the bytes start with the ZIP local-file-header
signature `PK` (`0x50 0x4b`), then unzips just `manifest.json`, parses it, and checks that `characters`
and `scenarios` are arrays and `characters[0]` is a string; any failure at any step returns `0`
(`byaf.ts:288-301`, `readManifestBytes`, `byaf-container.ts:142-148`). A match scores `1`: unlike the
legacy adapter, there is no weaker fallback tier, because a ZIP carrying a schema-shaped `manifest.json`
is not ambiguous with any other format in the registry.

@fig detect

## Field map

### Legacy JSON

See [entities/character.md](../entities/character.md) for what each canonical slot means. Backyard uses
several alias keys per concept. Reads take the first non-empty string among a key list, `firstStr`
(`index.ts:18-24`). Text fields listed as "converted" run through placeholder conversion on the way in;
see [Escrow and round-trip](#escrow-and-round-trip).

| Canonical | Legacy wire (first non-empty wins) | Converted | Notes |
| --- | --- | --- | --- |
| `identity.name` | `aiDisplayName`, `aiName`, `displayName`, `name` | no | Defaults to `""` when all four are absent. `index.ts:44,51` |
| `identity.nickname` | `aiName` | no | Carried only when it differs from the resolved name; see the two-names quirk below. `index.ts:52-58` |
| `identity.description` | `aiPersona`, `description`, `persona` | yes | `index.ts:45,59` |
| `identity.characterVersion` | `version` | no | Left unset if absent; no synthesized default at parse time. `index.ts:61` |
| `persona.personality` | `personality` | yes | `index.ts:64` |
| `persona.scenario` | `scenario` | yes | `index.ts:65` |
| `prompts.systemPrompt` | `systemPrompt`, `system_prompt` | yes | `index.ts:48,67` |
| `greetings.firstMessage` | `firstMessage`, `greeting`, `first_mes` | yes | `index.ts:46,68` |
| `examples.exampleMessages` | `customDialogue`, `examples`, `mes_example` | yes | `index.ts:47,69` |
| `attribution.creator` | `creator` | no | `index.ts:71` |
| `discovery.tags` | `tags` | no | Array; non-string entries are dropped. `index.ts:72` |

Everything else in `CharacterBody` (taglines, prompts other than system, alternate greetings, media,
presentation, lorebook/behavior refs) is left unset by this adapter; if the source card carried anything
under other keys, it survives only through escrow.

The two Backyard name keys are distinct authored fields and are modeled that way: `aiDisplayName` is the
display name (`identity.name`), `aiName` is the `{{char}}` shorthand (`identity.nickname`), carried only
when it differs from the resolved name (`index.ts:52-58`). See [Quirks](#quirks) for the export side of
this.

### BYAF

See [entities/character.md](../entities/character.md) for what each canonical slot means. Container
parsing (open the ZIP, locate the manifest, character, and scenario files) lives in `byaf-container.ts`
and does no body mapping; the field map itself lives in `byaf.ts`'s `archiveToBody` (`byaf.ts:50-147`).
`arc.scenarios[0]` is always the primary scenario, taken in manifest array order. Unlike the legacy codec,
BYAF text fields carry over verbatim: there is no brace-placeholder conversion anywhere in `byaf.ts` or
`byaf-scenarios.ts`.

| Canonical | BYAF wire | Notes |
| --- | --- | --- |
| `identity.name` | `character.displayName`, fallback `character.name` | `byaf.ts:53,115` |
| `identity.nickname` | `character.name` | Carried only when it differs from the resolved display name. `byaf.ts:54,116` |
| `identity.description` | `character.persona` | Single field; there is no personality/description split, so `persona.personality` is left unset. `byaf.ts:117` |
| `persona.scenario` | `scenarios[0].narrative` | `byaf.ts:120` |
| `prompts.systemPrompt` | `scenarios[0].formattingInstructions` | `byaf.ts:123` |
| `greetings.firstMessage` | `scenarios[0].firstMessages[0].text` | `byaf.ts:56,126` |
| `greetings.alternateGreetings[]` | extra `scenarios[0].firstMessages[]` entries, plus every later scenario's first message | See below. `byaf.ts:57-75` |
| `examples.exampleMessages` | `scenarios[0].exampleMessages[].text`, newline-joined | `byaf.ts:76,130` |
| `media.portrait` | the `character.images[]` entry labeled `avatar` (case-insensitive), else the first image | `byaf.ts:78-99` |
| `media.assets[]` | every other `character.images[]` entry | Bytes are read from the archive and re-embedded as a `data:` URI; a row whose file is missing from the archive is skipped. `byaf.ts:78-99` |
| `presentation.background` | `scenarios[0].backgroundImage`, if the path resolves in the archive | Re-embedded as a `data:` URI. `byaf.ts:101-108` |
| `attribution.creator` | `manifest.author.name` | `byaf.ts:138` |
| `attribution.sourceUrl` | `manifest.author.backyardURL` | `byaf.ts:139` |
| `attribution.createdAt` | `character.createdAt`, fallback `manifest.createdAt` | ISO string parsed to unix seconds. `byaf.ts:32-37,140` |
| `attribution.updatedAt` | `character.updatedAt` | `byaf.ts:141` |
| `discovery.rating` | `character.isNSFW` | `true` maps to `explicit`, `false` to `all-ages`; the middle tier `mature` is never produced from BYAF, which only has a boolean. `byaf.ts:111,144` |

`character.loreItems[]` is not mapped to a canonical lorebook reference by this adapter. It rides
untouched inside `original.byaf.raw` until a lore content-type projection is built (`byaf-coverage.ts:36`).
Sampler and runtime settings
(`temperature`, `topP`, `topK`, `minP`, `minPEnabled`, `repeatPenalty`, `repeatLastN`, `promptTemplate`,
`grammar`, `model`), the scenario `messages[]` chat transcript, and every non-primary scenario's fields
other than its opening message stay on escrow only; none of it is first-classed canonical.

Alternate greetings: `scenarios[0]`'s own `firstMessages` beyond the first become untitled alternate
greetings. Every scenario after the first contributes one alternate greeting: its title is the scenario's
`narrative`, falling back to its `title`, and its text is that scenario's first message
(`byaf.ts:56-75`). Each alternate greeting gets a deterministic id minted from the archive-internal
scenario path, `byaf:<path>` or `byaf:<path>#<index>` for extra primary messages
(`byaf-scenarios.ts:9-15`), so re-importing the same archive yields identical ids and export can match a
titled alt back to its originating scenario file. See [Quirks](#quirks).

## Escrow and round-trip

The escrow envelope is the canonical wrapper's `original` field, a `Record<FormatId, OriginalEntry>` keyed
by format id (`canonical.ts:39-51,80`). The architecture calls this concept "escrow"; the wrapper field is
named `original`. Legacy cards store their twin at `original.backyard`; BYAF archives store theirs at
`original.byaf`.

The whole raw parsed object rides in `original.backyard.raw` (`index.ts:123`). That escrow is what makes
round-trips safe, because the placeholder conversion below is not a bijection.

Backyard writes placeholders in single braces (`{character}` / `{user}`, and a bare `{char}`). The
canonical model uses Tavern double braces, so on import every text field is rewritten: `{character}` and
`{char}` become `{{char}}`, `{user}` becomes `{{user}}` (`toTavern`, `index.ts:32-36`). The `{char}`
fallback uses lookarounds so it matches a genuine single brace and never the inner `{char}` of an
already-converted `{{char}}`. The inverse (`toBackyard`, `index.ts:39-40`) only handles `{{char}}` /
`{{user}}` and drops any other Tavern token, so it is lossy.

On export (`fromCanonical`) the adapter clones the escrowed raw card, or starts from `{}` if there is no
escrow, and overlays the canonical body (`index.ts:127-155`). Per text field, `fieldOut` decides
(`index.ts:82-87`):

- If the field is unedited since parse (converting the raw string forward equals the current canonical
  value), it re-emits the raw bytes verbatim, so the non-bijective conversion cannot corrupt an untouched
  card.
- If the field was edited, it writes a fresh single-brace conversion of the canonical value, which takes
  the lossy inverse.

So an unedited legacy card survives a Backyard to canonical to Backyard round-trip with its text values
intact; only fields actually changed re-encode and risk placeholder loss.

The whole opened archive (manifest, character, every scenario, and every file's bytes as base64) rides in
`original.byaf.raw` (`byaf.ts:313`, `archiveToOriginal`, `byaf-container.ts:84-97`). On export,
`originalToArchive` rebuilds the in-memory archive shape from that twin (`byaf-container.ts:99-125`), the
canonical body is overlaid onto it (`applyBodyToArchive`, `byaf.ts:262-279`), and `packByaf` re-serializes
`manifest.json`, `character.json`, and every scenario file as JSON and re-zips the whole file map
(`byaf-container.ts:127-139`). Sampler settings, the chat transcript, `promptTemplate`, and `grammar` are
never read by `applyBodyToArchive`, so they ride the twin through untouched (`byaf.test.ts:74-86`
exercises this directly).

Media follows the same unedited-vs-edited split as legacy text: a portrait, gallery asset, or background
re-opened from the archive round-trips as a `data:` URI, and re-writing that same URI back is safe; only a
genuinely new or cleared image touches the archive's `images[]` rows and files
(`applyMediaToArchive`, `byaf.ts:173-260`). Clearing every image deletes the character's `images/` files
from the archive, not just the `images[]` rows; clearing the background does the same for
`backgroundImage`, unless another scenario still references the same file (`byaf.ts:184-191,247-259`).

Alternate greetings round-trip through the stable per-scenario id, not through title matching alone: on
export, an alt whose id resolves to a known archive-internal scenario path is written back into that exact
scenario file (preserving its chat transcript, sampler knobs, and grammar); only an alt with no resolvable
id and a title is matched by title against an unused secondary scenario, or else becomes a freshly minted
`scenarios/scenarioN.json` (`byaf-scenarios.ts:82-120`; `scenarioFromAlt`). A secondary scenario whose alt
was removed from the edited list is deleted from the archive as an orphan (`byaf-scenarios.ts:178-180`).
An id is only ever resolved to a path when that path is already present in the twin; a hostile or
malformed id (path traversal, an unknown path) never becomes a filesystem write
(`resolveGreetingPath`, `byaf-scenarios.ts:21-35`).

A from-scratch canonical character with no `original.byaf` twin gets a minimal manifest, character, and
single scenario shell synthesized before the same `applyBodyToArchive` overlay runs, so BYAF export never
requires a source BYAF archive to have existed (`byaf.ts:317-363`).

## Quirks

- Two names, two keys. `aiDisplayName`/`character.displayName` is the display name
  (`identity.name`); `aiName`/`character.name` is the `{{char}}` shorthand (`identity.nickname`). An
  earlier version of the legacy adapter folded both into `identity.name` and stamped the same value onto
  both keys on export, destroying a distinct authored `aiName` on every round-trip; this was a fix with a
  regression test (`index.ts:132-137`, `backyard.test.ts:94-113`, "WB-1"). BYAF's `applyBodyToArchive`
  applies the identical rule (`byaf.ts:265-266`).
- No version fabrication. Legacy `version` is left unset at parse time if the source omitted it, and
  export never invents one onto an existing twin; only a from-scratch cross-format card (no
  `original.backyard`) gets a `"1.0"` floor so it still emits valid JSON (`index.ts:149-152`,
  `backyard.test.ts:115-119`).
- BYAF's boolean rating is lossy toward canonical, not away from it. `character.isNSFW` only has two
  states, so canonical's middle `mature` tier can never come from a BYAF import. Export only writes
  `isNSFW` for an exact `"explicit"` or `"all-ages"` match; a `mature` rating (or one arriving from a
  richer cross-format source) falls into neither branch and leaves the archive twin's existing `isNSFW`
  untouched, while a from-scratch character with no twin defaults `isNSFW` to `false` for anything but
  `"explicit"` (`byaf.ts:268-269,328`).
- BYAF has one character per archive. The manifest's `characters` array is read as `characters[0]` only
  (`byaf-container.ts:56`); the ahoylabs spec itself caps the array at one entry, so this is not a
  simplification vaud made, it is the format.
- Untitled vs titled alternate greetings take different archive homes. An alt with no title is folded into
  the primary scenario's own `firstMessages[]`; an alt with a title becomes (or updates) its own secondary
  `scenarios/*.json` file. Retitling an alt does not move it between the two homes on its own, only its
  resolvable id and whether the edited title is blank decide that
  (`byaf-scenarios.ts:127-148`).
- BYAF detect has no weak tier. Unlike the legacy adapter's `0.55` fallback, a `.byaf` either has a
  ZIP-with-manifest shape scoring `1`, or it scores `0`. There is no ambiguous middle case in this
  registry (`byaf.ts:288-301`).
- `creator` and `tags` bypass placeholder conversion. Both directions copy them straight through on the
  legacy adapter; `tags` is only written on export when the canonical value is present (`index.ts:71-72,147-148`).

## Source of truth

| Concern | File |
| --- | --- |
| Legacy adapter (detect, toCanonical, fromCanonical) | `src/formats/backyard/index.ts` |
| Legacy coverage declaration | `src/formats/backyard/coverage.ts` |
| BYAF adapter (detect, toCanonical, fromCanonical) | `src/formats/backyard/byaf.ts` |
| BYAF ZIP container (open, pack, original twin) | `src/formats/backyard/byaf-container.ts` |
| BYAF scenario/greeting id mapping | `src/formats/backyard/byaf-scenarios.ts` |
| BYAF coverage declaration | `src/formats/backyard/byaf-coverage.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Samples | `samples/backyard/{1,2,3}.byaf` (ahoylabs/byaf's own conformance archives; no clean public legacy-JSON sample found, so that shape is fixtured only in `backyard.test.ts`) |
