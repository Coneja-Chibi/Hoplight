# Format: Agnai

Agnai (Agnaistic) is a browser/self-hosted AI roleplay app with its own native JSON character shape. It
is **not** Tavern-lineage: instead of a flat description block, its persona is *structured* (a `kind` plus
an attribute map), which is exactly what the canonical [`persona.structured`](../entities/character.md#persona)
field exists to preserve. The Agnai folder ships **two** adapters (its `index.ts` default-exports the
array `[character, lorebook]`): the character adapter below and the native **memory book** lorebook codec.

- Character: `id: "agnai"`, kind `character`, container JSON, writes `.json`.
- Label: `Agnai (Agnaistic) character (.json)`.
- Lorebook: `id: "agnai-lorebook"`, kind `lorebook`, container JSON, writes `.json` (see
  [Native memory book](#native-memory-book-agnai-lorebook)).
- Source: `src/formats/agnai/index.ts` (character), `src/formats/agnai/lorebook.ts` (memory book). The
  Agnai schema was read from Agnai's own source (`common/types/library.ts`, `common/adapters.ts`,
  `common/types/memory.ts`, `common/memory.ts`; AGPL-3.0) as interop facts only. No Agnai code is copied.

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

## Native memory book (`agnai-lorebook`)

Agnai's lorebook is the **memory book**: a standalone `.json` its Memory editor downloads. The download
(`web/pages/Memory/Memory.tsx` `encodeBook`) strips the DB-only `_id`/`userId` and emits:

```json
{ "kind": "memory", "name": "...", "description": "...", "entries": [ ... ],
  "scanDepth": 0, "tokenBudget": 0, "recursiveScanning": false }
```

`scanDepth`/`tokenBudget`/`recursiveScanning` are optional and omitted when unset. Each entry is a
`MemoryEntry` whose native field names differ from CCv3: the content is `entry` (not `content`), the
keywords are a plain **array** `keywords` (not a CSV string), and, uniquely, the two ordering axes are
**both explicit**: `weight` is placement ("highest renders at the bottom") and `priority` is eviction
("lowest is discarded first").

### Detection

`detect()` reads JSON and requires `entries` to be an **array** (ST worldbooks use a keyed object; RC
nests entries under `lorebook`). It returns `1.0` when the unambiguous `kind: "memory"` marker is present,
and `0.9` for a kind-less book whose first entry still carries the native `entry` + `keywords` shape (this
distinguishes it from a bare CCv3 `character_book`, whose entries use `content`/`keys`). Otherwise `0`.

### Field map

| Canonical `LorebookEntry` | Agnai `MemoryEntry` | Notes |
| --- | --- | --- |
| `title` | `name` | falls back to `Entry N` if absent |
| `content` | `entry` | Agnai's content field |
| `comment` | `comment` | Agnai has a **distinct** note field, separate from the label (unlike ST/Risu, where they are the same) |
| `enabled` | `enabled` | defaults `true` |
| `constant` | `constant` | |
| `triggers` | `keywords` | **plain** strings, always `isRegex: false` (Agnai has no regex-key feature) |
| `secondaryTriggers` | `secondaryKeys` | plain strings |
| `sortOrder` | `weight` | **placement** axis |
| `priority` | `priority` | **eviction** axis |
| `position` | `position` | `before_char` <-> `world`, `after_char` <-> `character` (the ST-parity floor) |
| `probability` | `probability` + `useProbability` | entry-level chance; emitted only when `< 100` |
| `excludeRecursion` | `excludeRecursion` | emitted only when `true` |

The `weight`/`priority` split is grounded in Agnai's own round-trip code: `memoryEntryToNative`
(`common/memory.ts`) maps CCv3 `insertion_order` -> `weight` and CCv3 `priority` -> `priority`, so
`weight` -> `sortOrder` and `priority` -> `priority` matches Agnai's own convention exactly.

Agnai carries **both** axes explicitly, so it is the format that shows the reconciled model cleanly:
placement has one canonical home (`sortOrder`) and eviction another (`priority`). An Agnai to SillyTavern
convert carries `weight` -> `sortOrder` -> ST `order` (the runtime placement axis); Agnai's `priority`
(eviction) has no ST home and is dropped, since ST has no eviction field. The earlier placement-order
split that mis-slotted placement into ST `displayIndex` is reconciled (#15, see
[design/LOREBOOK-FORMATS.md](../../../design/LOREBOOK-FORMATS.md)); Agnai needed no change.

### Not interpreted (escrow-only)

`selectiveLogic` is a `number` on the `MemoryEntry` type, but Agnai's own mappers never author it and its
integer convention is not verifiable from any Agnai source. Rather than guess an ST-style encoding, vaud
does **not** interpret it: the canonical `selectiveLogic` stays `and_any`, the raw value rides
escrow-of-raw untouched, and a same-format round-trip re-emits it byte-for-byte. Cross-format exports into
Agnai omit it entirely (Agnai ignores it anyway).

Verified against Agnai's runtime matcher (`buildMemoryPrompt` -> `findMatchWithLowestAge`,
`common/memory.ts`): match-time scanning iterates **only** `entry.keywords`. `secondaryKeys`, `selective`,
`constant`, `position`, `probability`, and `useProbability` are storage/interop fields Agnai never
consults when injecting memory. vaud still preserves and re-emits them for interop fidelity: because
Agnai's own ST importers set `secondaryKeys` and `selective` together, a fresh/cross-format encode emits
that pair (or neither), so the output is a well-formed Agnai book rather than one Agnai would never write.
An unedited twin is left byte-for-byte untouched.

### Escrow and round-trip

The whole source book rides in `escrow["agnai-lorebook"].raw`. On export, `bookToWire` clones that twin
and overlays only the fields whose canonical value **changed** (an index/`id`-keyed per-entry diff, the
same escrow-of-raw twin strategy the Risu and ST lorebook codecs use), so an unedited book re-emits
byte-identical (verified live: Agnai -> Agnai is deep-equal, `selectiveLogic` residue and all). Optional
book fields preserve the twin's presence/absence, and `_id`/`userId` are never injected. With no twin
(cross-format import) a clean `{ kind: "memory", ... }` book is written from the canonical body alone.

### Embedded book (`characterBook`)

Agnai's native character download (`charToJson` for the `native` target = the full character minus its
top-level `_id`) carries the character's lore inline as `characterBook`, a **MemoryBook** (validated by
Agnai's `validBook`, **not** a CCv3 `character_book`). vaud's character adapter extracts and re-embeds it
so Agnai character conversions carry their lore both ways:

- **Extract**: the character adapter implements the optional `extractLorebook` hook (`src/core/adapter.ts`),
  reading `card.characterBook` and mapping it through the **same** `memoryBookToCanonical` the standalone
  `agnai-lorebook` codec uses. So a given MemoryBook canonicalizes identically whether it arrives as a
  standalone file or embedded here (container-invariance by construction, tested). The bundle layer
  (`src/convert.ts`) calls this override instead of the shared CCv3 extractor.
- **Re-embed**: `fromCanonical` writes any linked lorebook back into `card.characterBook` via
  `canonicalToMemoryBook`. A single book twin-overlays its own `agnai-lorebook` escrow, so a same-format
  round-trip re-emits byte-identical (verified live: Agnai -> Agnai with a book is deep-equal). A foreign
  lorebook (cross-format, no Agnai twin) full-encodes into a clean MemoryBook. No book present means no
  `characterBook` is written - never an empty one.

Agnai's `native` import passes `characterBook` through verbatim (`jsonToCharacter`: `if (format ===
'agnai') return json`), so vaud emits a minimal `{ kind: "memory", ... }` book with no `_id`/`userId`
sentinels. Agnai's **Tavern/CCv2** export path instead lowers the book to CCv3 `data.character_book`
(`nativeToCharacterBook`), which vaud's shared CCv3 extractor already handles when such a card is read.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter (incl. `extractLorebook`) | `src/formats/agnai/index.ts` |
| Memory book (lorebook) adapter + shared mappers | `src/formats/agnai/lorebook.ts` |
| Bundle extract/re-embed wiring | `src/convert.ts`, `src/core/adapter.ts` (`extractLorebook`) |
| Canonical character schema | `src/entities/character/schema.ts` |
| Canonical lorebook schema | `src/entities/lorebook/schema.ts` |
| Interop reference | Agnai `common/types/library.ts`, `common/adapters.ts`, `common/types/memory.ts`, `common/memory.ts` (facts only) |
