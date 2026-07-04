# Format: Agnai

Agnai (Agnaistic) is a browser/self-hosted AI roleplay app with its own native JSON character shape. It
is **not** Tavern-lineage: instead of a flat description block, its persona is *structured* (a `kind` plus
an attribute map), which is exactly what the canonical [`persona.structured`](../entities/character.md#persona)
field exists to preserve. vaud treats Agnai as a single **character** adapter.

- Character: `id: "agnai"`, kind `character`, container JSON, writes `.json`.
- Label: `Agnai (Agnaistic) character (.json)`.
- Source: `src/formats/agnai/index.ts`. The Agnai schema was read from Agnai's own source
  (`common/types/library.ts`, `common/adapters.ts`; AGPL-3.0) as interop facts only. No Agnai code is
  copied.

## Detection

`detect()` returns `1.0` for a recognizable Agnai card, `0` otherwise. It parses the input as JSON and
requires **all** of:

- `kind === "character"`,
- `persona` is a non-null object,
- `greeting` is a string,
- `schemaVersion` is `undefined`,
- `body` is `undefined`.

The last two clauses are the firewall against vaud's own native wrapper: a `vaud-json` entity carries
`schemaVersion` and `body`, so requiring both to be absent stops Agnai from fighting `vaud-json` on the
same file. Any parse failure returns `0`. Agnai scores `1.0` (not `0.9`) because it is a specific,
self-identifying shape, not a generic reader.

## Field map

Decode (`toCanonical`) via `cardToBody`, encode (`fromCanonical`) via `applyBodyToCard`. Only string
values survive decode (a tolerant `str()` returns `undefined` for non-strings); only defined values are
written back on encode.

| Canonical | Agnai wire |
| --- | --- |
| `identity.name` | `name` (defaults to `""` if absent) |
| `identity.description` | `description` |
| `identity.characterVersion` | `characterVersion` |
| `persona.scenario` | `scenario` |
| [`persona.appearance`](../entities/character.md#persona) | `appearance` |
| `persona.personality` + `persona.structured` | `persona` (see below) |
| `prompts.systemPrompt` | `systemPrompt` |
| `prompts.postHistoryInstructions` | `postHistoryInstructions` |
| [`prompts.prefill`](../entities/character.md#prompts) | `prefill` |
| `prompts.depthInjections[0]` | `insert` (`{ depth, prompt }`) |
| `greetings.firstMessage` | `greeting` |
| `greetings.alternateGreetings` | `alternateGreetings` (string array) |
| `examples.exampleMessages` | `sampleChat` |
| `attribution.creator` | `creator` |
| `discovery.tags` | `tags` |

Notes on the non-obvious mappings:

- **`appearance`** is a first-class Agnai field kept out of `description`, specifically so it can drive
  image generation. Only Agnai produces canonical `persona.appearance`; other formats fold physical
  description into `description`.
- **`prefill`** is Agnai's assistant-response prefill (prepended to the model reply, common with Claude).
- **`insert`** is Agnai's single fixed-depth injection `{ depth, prompt }`. It decodes to one
  `DepthInjection` (`{ text: prompt, depth }`) and re-encodes only from `depthInjections[0]`. Agnai has
  exactly one injection slot, so a canonical entity with **multiple** depth injections keeps only the
  first on export. The Agnai `insert` carries no role/origin/enabled, so those `DepthInjection` fields
  stay `undefined` on decode.
- **`alternateGreetings`** are plain strings both ways. Each decodes to a `Greeting` `{ text }`; on encode
  only `.text` is written, so any canonical greeting `title` (from another format) is dropped.

## Structured persona

This is the Agnai-specific core. Agnai's `persona` is `{ kind, attributes }`, where `kind` is one of
`boostyle | wpp | sbf | attributes | text` and `attributes` is a `Record<string, string[]>`. It maps to
the canonical [`persona.structured`](../entities/character.md#persona) discriminated union.

Decode (`toStructured`):

| Agnai `persona.kind` | Canonical result |
| --- | --- |
| `"text"` | `structured = { kind: "text" }`, and `persona.personality = attributes.text[0]` |
| `boostyle` / `wpp` / `sbf` / `attributes` | `structured = { kind, attributes: attributes ?? {} }`; `personality` is left unset |

So a plain-text persona lands in the human-readable `personality` field (with `structured` recording that
it *was* text), while W++ / square-bracket / boostyle attribute maps are preserved intact in
`structured.attributes`. The union is designed so illegal states are unrepresentable: `{ kind: "text" }`
carries no attributes, and every attribute-map kind requires its attributes.

Encode (`toAgnaiPersona`):

- If `structured` exists and its `kind` is not `"text"`, emit `{ kind, attributes }` verbatim.
- Otherwise emit a text persona: `{ kind: "text", attributes: { text: [personality ?? ""] } }`.

Attribute-map kinds therefore round-trip exactly. A text persona re-wraps `personality` back into
`attributes.text`.

## Escrow and round-trip

The whole original card rides in `escrow.agnai.raw`. On export, `fromCanonical` deep-clones that raw card
(or a minimal `baseCard()` when there is no escrow, e.g. a cross-format import) and overlays the canonical
body onto it with `applyBodyToCard`, then serializes with `JSON.stringify(card, null, 2)` (2-space
indent). Any raw Agnai key with no canonical slot survives verbatim through the clone.

Round-trip caveat worth calling out honestly: `applyBodyToCard` **always rebuilds** `persona` from the
canonical body via `toAgnaiPersona`, rather than preserving the cloned raw persona. For attribute-map
kinds this is exact. But for a **text** persona whose `attributes.text` had more than one element, decode
keeps only `attributes.text[0]` (as `personality`), and encode re-emits `{ text: [personality] }`. So a
multi-element text array collapses to its first element even on an Agnai to Agnai round-trip. This is the
one place the persona rebuild is lossy; single-element text personas and all attribute-map personas are
faithful.

Everything else (name, description, scenario, appearance, prompts, greetings, examples, creator, tags)
overlays cleanly and, for an unedited card, re-projects to the same values it was decoded from.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter | `src/formats/agnai/index.ts` |
| Canonical character schema | `src/entities/character/schema.ts` |
| Interop reference | Agnai `common/types/library.ts`, `common/adapters.ts` (facts only) |
