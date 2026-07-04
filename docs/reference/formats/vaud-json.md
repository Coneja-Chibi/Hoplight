# Format: Vaudeville native (vaud-json)

vaud-json is vaud's own native format: the [canonical entity](../architecture.md#the-canonical-entity)
written straight to plain JSON. Every other adapter translates between its app's wire shape and the
canonical model; vaud-json does no translation at all. It serializes the `CanonicalCharacter` wrapper
itself (`schemaVersion` / `kind` / `id` / `body` / `profiles?` / `escrow?`) and reads it back. That makes
it the lossless local save and interchange format, and the simplest possible real adapter, and proof the
drop-in folder pattern works end to end.

- `id: "vaud-json"`, label `Vaudeville native (.json)`, kind `character`, container JSON, writes `.json`.
- Source: `src/formats/vaud-json/index.ts`.

Today it handles the `character` kind only. There is no `lorebook` variant in this folder yet.

## Detection

`detect()` parses the input text as JSON, then scores by whether it is already a canonical character:

- `1.0` when `kind === "character"` **and** `schemaVersion` is a `string`. This is the highest score any
  adapter returns, so a vaud-json file always wins detection over the app formats.
- `0.1` when the text parses as JSON but is not a canonical character (wrong `kind`, or no string
  `schemaVersion`). This is a deliberate low fallback, not a match: any other adapter that recognizes the
  content scores above it, and it clears the registry's `0.5` threshold only when nothing else does.
- `0` when there is no text, or the text is not valid JSON.

The `1.0` case keys on the canonical **wrapper**, not on any body field, because that wrapper is what
uniquely identifies a vaud-native file. `toCanonical()` then re-checks the wrapper and additionally
requires a `body.identity.name` string, throwing if either is missing (parse, don't validate at the
boundary). So `detect()` can return `1.0` on a wrapper whose `body` is malformed; the hard validation
happens on read, not on detection.

## Field map

There is no wire translation to tabulate. The on-disk JSON **is** the canonical entity, one to one:

| Canonical | vaud-json wire |
| --- | --- |
| `schemaVersion` | `schemaVersion` |
| `kind` | `kind` (`"character"`) |
| `id` | `id` |
| `body` (`CharacterBody`) | `body` |
| `profiles` (per-app overrides) | `profiles` |
| `escrow` (source-format carry) | `escrow` |

Every field of `CharacterBody` (`identity`, `persona`, `prompts`, `greetings`, `examples`, `media`,
`attribution`, `discovery`, and the optional `presentation` / `knowledgeRefs` / `behaviorRefs`) is
written verbatim under `body`. See [entities/character.md](../entities/character.md) for what each field
means.

`fromCanonical()` is `JSON.stringify(entity, null, 2)` with a suggested extension of `json`. It writes
the whole entity, including any `escrow` and `profiles` the entity is carrying, with no filtering or
re-projection.

## Escrow and round-trip

vaud-json is the one format where "same-format round-trip is lossless" is exact and unconditional rather
than reconstructed from an escrowed twin. Because it serializes the canonical entity directly, a
vaud-json -> canonical -> vaud-json round-trip returns the identical entity (the same `body`, and the same
`escrow` and `profiles` untouched). Nothing collapses, because nothing is translated.

Its relationship to escrow is different from the app adapters, too. The app adapters *fill* an escrow
entry keyed by their own id on import, so their private fields survive a same-format round-trip. vaud-json
neither reads nor writes an escrow entry keyed to itself: it carries whatever `escrow` the entity already
holds straight through. So a card imported from, say, SillyTavern and then saved as vaud-json keeps its
`escrow.sillytavern.raw` intact in the file, ready to re-project if it is later exported back to
SillyTavern.

## Quirks

- **Detection is wrapper-only; validation is on read.** `detect()` can score `1.0` on a file whose `body`
  is missing or has no `identity.name`; `toCanonical()` is what rejects that, with
  `"vaud-json: malformed canonical character (missing body.identity.name)"`. The two checks are not
  identical by design: detect is cheap recognition, toCanonical is the trust boundary.
- **The `0.1` fallback is not a claim of ownership.** It exists so that a plain JSON blob no other adapter
  recognizes still surfaces vaud-json as a last resort above the `0` non-match, without ever outranking a
  real app format.
- **Pretty-printed output.** Exports are two-space-indented JSON (`JSON.stringify(entity, null, 2)`), so
  the file is human-readable and diff-friendly, not minified.
- **No container, no images inline beyond what the body already holds.** vaud-json is pure JSON text; it
  has no PNG/zip container. Media rides exactly as the canonical `media` fields encode it (asset refs or
  data URIs), unchanged.

## Source of truth

| Concern | File |
| --- | --- |
| Adapter (detect / toCanonical / fromCanonical) | `src/formats/vaud-json/index.ts` |
| Canonical wrapper, escrow, id policy | `src/core/canonical.ts` |
| Character superset (`CharacterBody`) | `src/entities/character/schema.ts` |
| Adapter contract | `src/core/adapter.ts` |
