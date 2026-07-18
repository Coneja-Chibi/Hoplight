---
id: reference/formats/vaud-json
title: vaud-json format
audience: dev
summary: How the vaud-json adapter serializes the canonical character entity straight to plain JSON with no wire translation, and why it always wins detection on its own files.
tags: [format, vaud-json, character, canonical, native]
related: [reference/architecture, reference/entities/character]
---

# vaud-json format

vaud-json is vaud's own native format: the [canonical entity](../architecture.md#the-canonical-entity)
written straight to plain JSON. Every other adapter translates between its app's wire shape and the
canonical model; vaud-json does no translation at all. It serializes the `CanonicalCharacter` wrapper
itself (`schemaVersion` / `kind` / `id` / `body` / `profiles?` / `original?`, `canonical.ts:70-81`) and
reads it back unchanged. That makes it the lossless local save and interchange format, the simplest real
adapter in the registry, and proof the drop-in folder pattern works end to end.

- `id: "vaud-json"`, label `Vaudeville native (.json)`, kind `character`, container JSON, writes `.json`.
- One codec, one file: `src/formats/vaud-json/index.ts:21-46`. No `lorebook` variant exists in this
  folder.
- `native: true` (`index.ts:26`): importable and exportable like any other adapter, but never listed as
  an external "publish to" platform. The Press room's format picker and the export dialog both skip
  adapters flagged `native` (`src/ui/apps/press/press-core.ts:26`, `src/ui/components/export-dialog/index.tsx:53`).

For the canonical field meanings this format carries, see
[entities/character.md](../entities/character.md). For the hub-and-spoke, escrow, and detection model, see
[architecture.md](../architecture.md). For the whole matrix of formats, see
[FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md) (`FORMAT-SUPPORT.md:23`).

@fig detect

## Detection

`detect()` parses the input text as JSON, then scores by whether it is already a canonical character
(`index.ts:28-36`):

- `1.0` when `kind === "character"` and `schemaVersion` is a `string`. This is the highest score any
  adapter returns, so a vaud-json file always wins detection over every app format on its own output.
- `0.1` when the text parses as JSON but is not a canonical character (wrong `kind`, or no string
  `schemaVersion`).
- `0` when there is no text, or the text does not parse as JSON.

The registry only ever hands back the highest-scoring adapter, and only when that score clears
`DETECT_THRESHOLD = 0.5` (`registry.ts:10,30-41`). Because `0.1 < 0.5`, the fallback branch can never make
`registry.detect()` return vaud-json: a plain JSON blob that fails the `1.0` check simply leaves the whole
registry with no winner, the same as if vaud-json were not registered at all. Every consumer routes through
that gated `registry.detect()` (`cli.ts:185,241,286,322`, `ui/server-engine.ts:58`), so today the `0.1`
score has no observable effect on which format is picked; see [Quirks](#quirks).

The `1.0` case keys on the canonical wrapper, not on any body field, because that wrapper is what
uniquely identifies a vaud-native file. `toCanonical()` then re-checks the wrapper and additionally
requires a `body.identity.name` string, throwing if either is missing (parse, don't validate at the
boundary, `index.ts:9-19`). So `detect()` can return `1.0` on a wrapper whose `body` is otherwise
malformed; the hard validation happens on read, not on detection.

## Field map

There is no wire translation to tabulate. The on-disk JSON is the canonical entity, one to one
(`index.ts:43-45`):

| Canonical | vaud-json wire |
| --- | --- |
| `schemaVersion` | `schemaVersion` |
| `kind` | `kind` (`"character"`) |
| `id` | `id` |
| `body` (`CharacterBody`) | `body` |
| `profiles` (per-app overrides) | `profiles` |
| `original` (escrow envelope) | `original` |

Every field of `CharacterBody`, the eight always-present sub-objects (`identity`, `persona`, `prompts`,
`greetings`, `examples`, `media`, `attribution`, `discovery`) plus the optional `presentation` /
`settings` / `bias` / `worldName` / `knowledgeRefs` / `behavior` / `behaviorRefs` / `variants`, is
written verbatim under `body`. See [entities/character.md](../entities/character.md) for what each field
means; this adapter has no opinion on any of them.

`fromCanonical()` is `JSON.stringify(entity, null, 2)` with a suggested extension of `json` (`index.ts:43-45`).
It writes the whole entity, including any `original` and `profiles` the entity is carrying, with no
filtering or re-projection.

## Escrow and round-trip

vaud-json is the one format where "same-format round-trip is lossless" is exact and unconditional rather
than reconstructed from an escrowed twin. Because it serializes the canonical entity directly, a
vaud-json to canonical to vaud-json round-trip returns the identical entity, the same `body`, and the same
`original` and `profiles` untouched (proven by the adapter's own round-trip test, `vaud-json.test.ts:22-25`,
and by the registry-level round-trip test, `registry.test.ts:37-43`).

Its relationship to escrow is different from every app adapter, too. The app adapters fill an `original`
entry keyed by their own id on import, so their private fields survive a same-format round-trip
(`architecture.md`, "Escrow"). vaud-json neither reads nor writes an `original` entry keyed to itself: it
carries whatever `original` the entity already holds straight through, untouched, because `toCanonical`
and `fromCanonical` never inspect that field at all (`index.ts:9-19,43-45`). So a card imported from, say,
SillyTavern and then saved as vaud-json keeps its `original.sillytavern.raw` intact in the file, ready to
re-project if it is later exported back to SillyTavern.

## Quirks

- Detection is wrapper-only; validation is on read. `detect()` can score `1.0` on a file whose `body` is
  missing or has no `identity.name`; `toCanonical()` is what rejects that. It throws one of two messages
  depending on what is missing: `"vaud-json: not a canonical character (missing kind/schemaVersion)"` when
  the wrapper itself does not match, or `"vaud-json: malformed canonical character (missing
  body.identity.name)"` when the wrapper matches but the body does not carry a name (`index.ts:12-17`, both
  paths exercised in `vaud-json.test.ts:31-40`). The two checks are not identical by design: detect is
  cheap recognition, toCanonical is the trust boundary.
- Validation stops at `identity.name`. `toCanonical()` casts the parsed object straight to
  `CanonicalCharacter` once `kind`, `schemaVersion`, and `body.identity.name` check out (`index.ts:18`); it
  never confirms `persona`, `prompts`, `greetings`, `examples`, `media`, `attribution`, or `discovery` are
  actually present, even though `CharacterBody` declares all eight required. A hand-edited file that drops
  one of those sub-objects still passes `toCanonical()` and only breaks whatever downstream code reads the
  missing field.
- The `0.1` fallback cannot currently win detection. `DETECT_THRESHOLD` is `0.5` (`registry.ts:10`), so a
  `0.1` score never clears it; every real caller goes through the gated `registry.detect()`, never through
  a raw per-adapter score. No test exercises a plain-JSON blob winning detection as vaud-json, which
  matches this reading. The branch exists to rank a plain JSON blob above the hard `0` non-match, but as
  of `registry.ts:30-41`'s threshold it has no path to actually being selected. See [Detection](#detection).
- Pretty-printed output. Exports are two-space-indented JSON (`JSON.stringify(entity, null, 2)`,
  `index.ts:44`), so the file is human-readable and diff-friendly, not minified.
- No container, no images inline beyond what the body already holds. vaud-json is pure JSON text; it has
  no PNG or zip container. Media rides exactly as the canonical `media` fields encode it (asset refs or
  data URIs), unchanged.
- `native` keeps it off the publish surface and the coverage lens. The Studio's Press room and export
  dialog filter on `!f.native` when building their "publish to" platform lists, and the publish setup
  step's own comment says "our own storage format is not a platform" (`src/ui/apps/press/press-core.ts:26`,
  `src/ui/components/export-dialog/index.tsx:53`, `src/ui/setup/steps/publish/index.tsx:61`). The
  Workbench's coverage lens applies the same exclusion one step earlier: `/api/coverage` only returns
  character adapters where `a.coverage && !a.native` both hold (`src/ui/server.ts:272-276`), so vaud-json,
  which is native and has no `coverage.ts` of its own, never reaches that list at all, not even as an
  undeclared-coverage entry. vaud-json still works as an ordinary import/export target everywhere else,
  including `vaud convert` and the Workbench's editing surface.

## Source of truth

| Concern | File |
| --- | --- |
| Adapter (detect / toCanonical / fromCanonical) | `src/formats/vaud-json/index.ts` |
| Adapter tests | `src/formats/vaud-json/vaud-json.test.ts` |
| Registry (detection threshold, gating) | `src/core/registry.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
| Adapter contract (`native`, `coverage`, `lens`) | `src/core/adapter.ts` |
| Character superset (`CharacterBody`) | `src/entities/character/schema.ts` |
| Publish-surface filtering (`native` excluded) | `src/ui/apps/press/press-core.ts`, `src/ui/components/export-dialog/index.tsx`, `src/ui/setup/steps/publish/index.tsx` |
| Generated format matrix | `docs/FORMAT-SUPPORT.md` |
