---
id: reference/formats/pygmalion
title: Pygmalion format
audience: dev
summary: How the Pygmalion adapter detects, maps, and round-trips the classic flat five-field character JSON and its PNG chara chunk through the canonical model.
tags: [format, pygmalion, character, flat-json, legacy, png]
related: [reference/architecture, reference/entities/character, reference/formats/sillytavern]
---

# Pygmalion format

Pygmalion is the classic flat character shape used before Character Card V2 existed: bare snake_case keys
(`char_name`, `char_persona`, `char_greeting`, `world_scenario`, `example_dialogue`), carried as a
standalone `.json` file or embedded in a PNG's `chara` tEXt chunk the same way SillyTavern embeds a card.
It is legacy surface, not Tavern-lineage: the adapter must not claim a CCv2/v3 card (`index.ts:1-7`), a
vaud-json wrapper, an Agnai card, or a Backyard card, all of which can share a PNG carrier or overlapping
key names (`index.ts:26-29`).

The format is one folder, `src/formats/pygmalion/`, whose `index.ts` default-exports one codec
(`index.ts:114-125,172-173`):

- `pygmalion`, kind `character`, reads PNG or JSON, writes `.json` (or `.png` when a source carrier
  survives the round-trip).

There is no lorebook, persona, or regex codec in this family: the classic wire has five prose fields and
nothing else. For the canonical field meanings this format maps onto, see
[entities/character.md](../entities/character.md). For the hub-and-spoke, escrow, and detection model, see
[architecture.md](../architecture.md). For the whole matrix of formats, see
[FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md).

## Detection

The registry runs every adapter's `detect()` and keeps the single highest score above `0.5`, so a
correctly-scoped adapter outranks a generic one that also matches the same bytes (`architecture.md`,
"Detection and the registry").

`detectPygmalion` returns `1` for a recognizable classic card, `0` otherwise (`index.ts:42-48`). It reads
`1`, not `0.9` like SillyTavern's generic Tavern reader: no more-specific sibling adapter currently shares
Pygmalion's wire vocabulary, so it claims full confidence outright.

`isPygmalionCard` (`index.ts:24-39`) rejects known shapes before it ever looks for a positive signal, so
adding those adapters later never became a coincidence-of-fields problem:

- `spec` or `data` present rejects a CCv2/v3 card (`index.ts:26`).
- `schemaVersion` or `body` present rejects a vaud-json canonical wrapper (`index.ts:27`).
- `kind === "character"` rejects an Agnai card (`index.ts:28`).
- `aiName` or `aiPersona` as a string rejects a Backyard/Faraday card (`index.ts:29`).

Only past those gates does it look for a positive signal: at least two of `char_persona`,
`char_greeting`, `world_scenario` (the "classic" count), or the minimal fallback `char_name` plus
`char_persona` (`index.ts:31-38`). A card with only `char_name` and `char_greeting`, no persona, is not
recognized by either path.

@fig detect

`readCardJson` decodes either a PNG's `chara`/`ccv3` tEXt chunk or raw JSON text (`card-io.ts:9-21`), the
same shared reader SillyTavern and RoleCall use, so `detectPygmalion` runs the identical positive/negative
scan whether the input is `.json` or `.png`. That produces one deliberate asymmetry at the PNG boundary:
SillyTavern's own PNG branch scores `0.9` purely from chunk presence, without checking the decoded
payload's shape (`sillytavern/index.ts:90`), because `embedCharacterJson` defaults to the same `chara`
keyword ST's V2 embed uses (`png.ts:84`). A Pygmalion PNG is therefore technically "readable" by the
SillyTavern adapter too; the registry's highest-score rule resolves it in Pygmalion's favor (`1` beats
`0.9`), not a shape check on SillyTavern's side. The reverse direction is guarded explicitly: if a PNG
carries a recognizable `chara`/`ccv3` chunk that decodes to something that is not Pygmalion's shape,
`detectPygmalion` returns `0` rather than guessing, so a real SillyTavern PNG is never misclaimed
(`index.ts:45-47`).

## Field map

| Source field | Canonical path | Notes |
| --- | --- | --- |
| `char_name` (fallback `name`) | `identity.name` | Defaults to `""` when both are absent. `index.ts:51` |
| `char_persona` | `persona.personality` | The one persona blob. `index.ts:60` |
| `char_persona` | `identity.description` | Mirrored on import only, so a UI surface that only shows description still has text. `index.ts:56-58` |
| `world_scenario` | `persona.scenario` | `index.ts:61` |
| `char_greeting` | `greetings.firstMessage` | `index.ts:65` |
| `example_dialogue` | `examples.exampleMessages` | `index.ts:68` |
| PNG carrier pixels | `media.portrait` | Set only when the input decodes as a PNG (`pngSourceMedia`); not a JSON wire key. `index.ts:102-112,133-134` |
| `metadata` (tool provenance) | (none) | Not a canonical slot; rides `original.pygmalion.raw` untouched. `coverage.ts:19-24` |

There is no `prompts` mapping: the classic wire has no system-prompt slot, so `body.prompts` is always
`{}` on import (`index.ts:63`). `attribution` and `discovery` are likewise always `{}`: the classic wire
has no creator, tag, or timestamp fields (`index.ts:71-72`).

Export (`applyBodyToCard`, `index.ts:76-90`) is a plain overlay: its `set` helper writes a wire key only
when the canonical value is not `undefined` (`index.ts:77-79`), so `char_name`, `char_greeting`,
`world_scenario`, and `example_dialogue` each write straight from their one canonical field. `char_persona`
is the exception: it writes `persona.personality`, falling back to `identity.description` only when
personality is `undefined` (`index.ts:82-83`). Since import always sets `persona.personality` whenever
`char_persona` was present, editing only `identity.description` after import does not reach the wire; see
[Quirks](#quirks). The legacy `name` alias is written back only if the source card already carried a
`name` key (`base.name !== undefined`); the adapter never invents it (`index.ts:87-88`).

## Escrow and round-trip

The escrow envelope is the canonical wrapper's `original` field, a `Record<FormatId, OriginalEntry>` keyed
by format id (`canonical.ts:39-51,80`). The architecture calls this concept "escrow"; the wrapper field is
named `original`. The Pygmalion codec stores its twin under `original.pygmalion`.

On import the adapter stores the whole parsed card verbatim, plus the PNG carrier when the input was a PNG
(`index.ts:141-146`):

```
original.pygmalion = {
  raw:         <the entire parsed card, verbatim>,
  sourceMedia: { b64, mime: "image/png" }   // only for PNG input
}
```

Unlike SillyTavern's twin, there is no `unmapped` entry: Pygmalion has exactly one wire shape, so there is
no variant to remember across a round-trip.

On export, `fromCanonical` clones the raw card (`structuredClone`) when escrow exists, or starts from
`baseCard()`'s five empty-string keys for a from-scratch entity with no escrow (`index.ts:92-100,152-153`),
then overlays the canonical body onto the clone via `applyBodyToCard` (`index.ts:154`). A same-format
round-trip with no edits reproduces the source object byte-for-byte, `metadata` included, because export
only ever touches the five known keys and leaves everything else on the cloned object untouched
(confirmed by `pygmalion.test.ts`, "round-trip is lossless for classic card including metadata").

When the escrow's `sourceMedia` carries PNG bytes, `fromCanonical` decodes the base64 carrier and
re-embeds the (possibly edited) JSON into a fresh `chara` tEXt chunk via `embedCharacterJson`, returning
`.png` bytes and suggested extension `png`; any embed failure falls through to plain `.json` text output
rather than throwing (`index.ts:158-167`).

What crosses a cross-format conversion is only the canonical body: name, persona, scenario, first message,
and example dialogue. `metadata` and the PNG carrier stay in escrow and are deliberately not copied into
another app's file (`architecture.md`, "Escrow: lossless round-trips, contained cross-format loss"). A
Pygmalion-to-SillyTavern conversion carries those four prose fields into a fresh CCv2 envelope
(`pygmalion.test.ts`, "cross-format: Pygmalion -> SillyTavern keeps core text").

## Quirks

- Description mirror is display-only, not an edit path. Import always sets both `persona.personality` and
  `identity.description` to the same `char_persona` blob (`index.ts:56-58`). Export prefers
  `persona.personality` and only falls back to `identity.description` when personality is `undefined`
  (`index.ts:82-83`). Because import always sets personality when `char_persona` was present, an edit made
  only to `identity.description` after import never reaches `char_persona` on export.
- `name` alias is never invented. `applyBodyToCard` writes the legacy `name` key back only behind
  `base.name !== undefined`; a classic card that only ever used `char_name` stays that way on export
  (`index.ts:87-88`), confirmed by the "name alias" test in `pygmalion.test.ts`.
- Overlay writes, never clears. `set()` only assigns a wire key when the canonical value is not
  `undefined` (`index.ts:77-79`). Unlike the shared Tavern three-state overlay (equal / changed / cleared,
  [sillytavern.md](sillytavern.md), "Escrow and round-trip"), there is no explicit-clear branch: a
  canonical field that goes from a string back to `undefined` leaves the last-written wire value in place.
- The minimal detection path needs persona specifically. `isPygmalionCard`'s single-field fallback
  requires `char_name` **and** `char_persona` together; a card with only `char_name` and `char_greeting`
  is not recognized even though it is a plausible partial classic card (`index.ts:36-38`).
- `metadata` rides raw untouched. Tool provenance (`{ tool: { name, version } }` in community exports) is
  not mapped to any canonical slot. It survives a round-trip only because export clones `raw` and sets
  just the five known keys onto the clone, never touching unknown keys (`index.ts:153-154`).
- One codec, no siblings. There is no Pygmalion lorebook, persona, or regex format: the classic wire never
  carried those concepts, so this page's whole scope is the one character codec above.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter (detect, toCanonical, fromCanonical) | `src/formats/pygmalion/index.ts` |
| Coverage declaration | `src/formats/pygmalion/coverage.ts` |
| Shared card JSON reader (PNG chara/ccv3 chunk or raw text) | `src/formats/_shared/card-io.ts` |
| Shared PNG chunk read/write | `src/formats/_shared/png.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Samples | `samples/pygmalion/` (`classic.native.json`) |
| Tests | `src/formats/pygmalion/pygmalion.test.ts` |
| Research provenance | `docs/reference/platform-native-fields.md`, "Pygmalion" |
