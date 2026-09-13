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
key names (`index.ts:27-30`).

The format is one folder, `src/formats/pygmalion/`, whose `index.ts` default-exports one codec
(`index.ts:148-155,210-211`):

- `pygmalion`, kind `character`, reads PNG or JSON, writes `.json` or a `.png` carrier when the
  current canonical portrait is an inline PNG and the caller did not explicitly request JSON.

There is no lorebook, persona, or regex codec in this family: the classic wire has five prose fields and
nothing else. For the canonical field meanings this format maps onto, see
[entities/character.md](../entities/character.md). For the hub-and-spoke, escrow, and detection model, see
[architecture.md](../architecture.md). For the whole matrix of formats, see
[FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md).

## Detection

The registry runs every adapter's `detect()` and keeps the single highest score above `0.5`, so a
correctly-scoped adapter outranks a generic one that also matches the same bytes (`architecture.md`,
"Detection and the registry").

`detectPygmalion` returns `1` for a recognizable classic card, `0` otherwise (`index.ts:43-48`). It reads
`1`, not `0.9` like SillyTavern's generic Tavern reader: no more-specific sibling adapter currently shares
Pygmalion's wire vocabulary, so it claims full confidence outright.

`isPygmalionCard` (`index.ts:25-40`) rejects known shapes before it ever looks for a positive signal, so
adding those adapters later never became a coincidence-of-fields problem:

- `spec` or `data` present rejects a CCv2/v3 card (`index.ts:27`).
- `schemaVersion` or `body` present rejects a vaud-json canonical wrapper (`index.ts:28`).
- `kind === "character"` rejects an Agnai card (`index.ts:29`).
- `aiName` or `aiPersona` as a string rejects a Backyard/Faraday card (`index.ts:30`).

Only past those gates does it look for a positive signal: at least two of `char_persona`,
`char_greeting`, `world_scenario` (the "classic" count), or the minimal fallback `char_name` plus
`char_persona` (`index.ts:32-38`). A card with only `char_name` and `char_greeting`, no persona, is not
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
| `char_name` (fallback `name`) | `identity.name` | Defaults to `""` when both are absent. `index.ts:52` |
| `char_persona` | `persona.personality` | The one persona blob. `index.ts:61` |
| `char_persona` | `identity.description` | Mirrored on import only, so a UI surface that only shows description still has text. `index.ts:57-58` |
| `world_scenario` | `persona.scenario` | `index.ts:62` |
| `char_greeting` | `greetings.firstMessage` | `index.ts:66` |
| `example_dialogue` | `examples.exampleMessages` | `index.ts:69` |
| PNG carrier pixels | `media.portrait` | Set when the input decodes as a PNG (`pngSourceMedia`); on export, an inline `data:image/png` portrait can become the output carrier. It is not a JSON wire key. `index.ts:104-130,167-168,193-206` |
| `metadata` (tool provenance) | (none) | Not a canonical slot; rides `original.pygmalion.raw` untouched. `coverage.ts:19-24` |

There is no `prompts` mapping: the classic wire has no system-prompt slot, so `body.prompts` is always
`{}` on import (`index.ts:64`). `attribution` and `discovery` are likewise always `{}`: the classic wire
has no creator, tag, or timestamp fields (`index.ts:72-73`).

Export (`applyBodyToCard`, `index.ts:77-90`) is a plain overlay: its `set` helper writes a wire key only
when the canonical value is not `undefined` (`index.ts:78-80`), so `char_name`, `char_greeting`,
`world_scenario`, and `example_dialogue` each write straight from their one canonical field. `char_persona`
is the exception: it writes `persona.personality`, falling back to `identity.description` only when
personality is `undefined` (`index.ts:83-84`). Since import always sets `persona.personality` whenever
`char_persona` was present, editing only `identity.description` after import does not reach the wire; see
[Quirks](#quirks). The legacy `name` alias is written back only if the source card already carried a
`name` key (`base.name !== undefined`); the adapter never invents it (`index.ts:89`).

## Escrow and round-trip

The escrow envelope is the canonical wrapper's `original` field, a `Record<FormatId, OriginalEntry>` keyed
by format id (`canonical.ts:39-51,80`). The architecture calls this concept "escrow"; the wrapper field is
named `original`. The Pygmalion codec stores its twin under `original.pygmalion`.

On import the adapter stores the whole parsed card verbatim, plus the PNG carrier when the input was a PNG
(`index.ts:175-180`):

```
original.pygmalion = {
  raw:         <the entire parsed card, verbatim>,
  sourceMedia: { b64, mime: "image/png" }   // only for PNG input
}
```

Unlike SillyTavern's twin, there is no `unmapped` entry: Pygmalion has exactly one wire shape, so there is
no variant to remember across a round-trip.

On export, `fromCanonical` clones the raw card (`structuredClone`) when escrow exists, or starts from
`baseCard()`'s five empty-string keys for a from-scratch entity with no escrow (`index.ts:93-101,187-188`),
then overlays the canonical body onto the clone via `applyBodyToCard` (`index.ts:188`). A same-format
round-trip with no edits reproduces the source object byte-for-byte, `metadata` included, because export
only ever touches the five known keys and leaves everything else on the cloned object untouched
(confirmed by `pygmalion.test.ts`, "round-trip is lossless for classic card including metadata").

`fromCanonical` treats the current canonical portrait as the output authority. An inline
`data:image/png;base64,...` portrait is decoded and receives a fresh `chara` tEXt chunk via
`embedCharacterJson`, returning `.png` bytes and suggested extension `png`. The imported source carrier
uses that same path because import placed its pixels in `media.portrait`. Replacing the portrait replaces
the carrier, and clearing it produces JSON instead of resurrecting escrowed pixels. An explicit JSON
request produces plain `.json` and reports the portrait as dropped. Without an explicit container
request, an unsupported portrait reference or embed failure also falls back to that honest JSON output.
An explicit PNG request with no usable inline PNG fails instead of returning the wrong container.

What crosses a cross-format conversion is the canonical body: name, persona, scenario, first message,
example dialogue, and an inline PNG portrait that can serve as the Pygmalion carrier. Remote URLs,
archive-private references, and non-PNG images are not fetched or transcoded; JSON export reports those
portraits as dropped. `metadata` stays in escrow and is deliberately not copied into another app's file
(`architecture.md`, "Escrow: lossless round-trips, contained cross-format loss"). A
Pygmalion-to-SillyTavern conversion carries the prose fields into a fresh CCv2 envelope
(`pygmalion.test.ts`, "cross-format: Pygmalion -> SillyTavern keeps core text").

## Quirks

- Description mirror is display-only, not an edit path. Import always sets both `persona.personality` and
  `identity.description` to the same `char_persona` blob (`index.ts:57-58`). Export prefers
  `persona.personality` and only falls back to `identity.description` when personality is `undefined`
  (`index.ts:83-84`). Because import always sets personality when `char_persona` was present, an edit made
  only to `identity.description` after import never reaches `char_persona` on export.
- `name` alias is never invented. `applyBodyToCard` writes the legacy `name` key back only behind
  `base.name !== undefined`; a classic card that only ever used `char_name` stays that way on export
  (`index.ts:89`), confirmed by the "name alias" test in `pygmalion.test.ts`.
- Overlay writes, never clears. `set()` only assigns a wire key when the canonical value is not
  `undefined` (`index.ts:78-80`). Unlike the shared Tavern three-state overlay (equal / changed / cleared,
  [sillytavern.md](sillytavern.md), "Escrow and round-trip"), there is no explicit-clear branch: a
  canonical field that goes from a string back to `undefined` leaves the last-written wire value in place.
- The minimal detection path needs persona specifically. `isPygmalionCard`'s single-field fallback
  requires `char_name` **and** `char_persona` together; a card with only `char_name` and `char_greeting`
  is not recognized even though it is a plausible partial classic card (`index.ts:36-38`).
- `metadata` rides raw untouched. Tool provenance (`{ tool: { name, version } }` in community exports) is
  not mapped to any canonical slot. It survives a round-trip only because export clones `raw` and sets
  just the five known keys onto the clone, never touching unknown keys (`index.ts:187-188`).
- PNG output is deliberately narrow. Only a validated inline PNG portrait becomes a carrier. Hoplight
  does not fetch remote portraits, resolve archive-private references, or transcode JPEG/WebP/GIF for
  this legacy format; JSON export names that loss in its report.
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
