# Spec: Backyard.ai / Faraday Character Codec

**Package:** `packages/formats` (module `backyard`) · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/rolecall-lorebook.md (canonical LorebookEntry target), specs/formats/regex-scripts.md
(macro placeholder precedent, if written) · **VAUDEVILLE reference:**
`apps/rc/src/lib/formats/character/backyard.ts` (identical copy at
`apps/plot/src/lib/formats/character/backyard.ts`)

## Purpose

Backyard.ai (formerly Faraday.dev) is a desktop roleplay-chat client with its own
character export shape. This codec converts Backyard/Faraday character data to and
from the Vaudeville canonical `Character` (+ referenced `Lorebook`) model. There are
**two distinct source shapes** this codec must handle, from two different eras of the
product, and they are not interchangeable:

1. **Legacy flat JSON** (Faraday-era and early Backyard; still produced by some
   third-party export tools and still what VAUDEVILLE's `backyard.ts` implements
   today): a single flat JSON object (`aiName`, `aiPersona`, `customDialogue`, ...),
   embeddable in a PNG, no lorebook, no scenario/chat data.
2. **`.byaf` (Backyard Archive Format)**: the current, officially documented export
   format as of the ahoylabs/byaf spec (v1, "nearing finalization" at time of
   writing). A ZIP archive with a root manifest, one character manifest (with
   `loreItems` and multiple images), and one or more scenario files (samplers, chat
   history, multiple greetings).

An implementing agent must not assume these are the same shape. Detection must
distinguish them (see Behavior: Detection) and the codec must expose both a
`parseLegacyJSON` path and a `parseByaf` path behind one `Codec` surface.

## Behavior

### A. Legacy flat JSON

Source: VAUDEVILLE `apps/rc/src/lib/formats/character/backyard.ts` (full file; the
`apps/plot` copy is byte-identical). This is the only Backyard shape VAUDEVILLE
currently implements; it has no lorebook support and no round-trip fidelity work
(VAUDEVILLE treats it as a one-way-ish converter into `CharacterContent`, not through
an escrow envelope). Vaudeville Studios must upgrade it to full escrow-backed
round-trip per the Law.

**Field map (legacy JSON to canonical `Character`):**

| Source field(s) (first non-empty wins) | Canonical field | Native/escrow/dropped | Notes |
|---|---|---|---|
| `aiDisplayName`, `aiName`, `displayName`, `name` | `identity.name` | native | VAUD default `'Unnamed'` if all absent (backyard.ts:111-116). Studio should treat all-absent as a parse warning, not silently synthesize a name - see edge case 1. |
| `aiPersona`, `description`, `persona` | `description` | native | Placeholder-converted (see Macro conversion below). VAUD backyard.ts:119-120. |
| `personality` | `personality` | native | Placeholder-converted. backyard.ts:123-124. |
| `scenario` | `scenario` | native | Placeholder-converted. backyard.ts:127-128. |
| `firstMessage`, `greeting`, `first_mes` | `firstMessage` | native | Placeholder-converted. backyard.ts:131-132. |
| `customDialogue`, `examples`, `mes_example` | `exampleDialogue` | native | Placeholder-converted. backyard.ts:135-136. |
| `systemPrompt`, `system_prompt` | `systemPrompt` | native | Placeholder-converted. backyard.ts:139-140. |
| `creator` | `identity.creator` | native | backyard.ts:155. |
| `tags` | `tags` | native | backyard.ts:154, defaults to `[]`. |
| `version` | `character_version` | native | VAUD stores it as `character_version` with `|| '1.0'` default (backyard.ts:156). canonical-model.md's Character source list names `character_version` explicitly as a field shared with CCv2/v3, so this maps native, not escrow - escrowing it would strand the value in Backyard-only escrow and drop it on a Backyard-to-CCv2/v3 conversion. Do not apply VAUD's `'1.0'` default on parse; leave the canonical field unset if the source omits `version` (inventing a value on parse contradicts the "nothing invented" posture of this suite), and only fall back to `'1.0'` on serialize-to-legacy-JSON when the canonical field is genuinely unset. |
| - (no source) | `postHistoryInstructions` | dropped on parse, native on serialize-to-legacy is moot | VAUD explicitly sets `post_history_instructions: ''` with comment "Backyard doesn't have this field" (backyard.ts:151). Canonical field stays unset (not empty string) after parse. |
| - (no source) | `creatorNotes` | n/a | VAUD sets `''` (backyard.ts:152); canonical field stays unset. |
| - (no source) | `alternateGreetings[]` | n/a | VAUD sets `[]` (backyard.ts:153); canonical field stays empty, not escrowed (there is nothing to escrow - the source format has no concept of alternate greetings). |
| any other key on the object | escrow `backyard.fields.<key>` | escrow | `BackyardCharacter` is typed with an index signature `[key: string]: unknown` (backyard.ts:54), so any unrecognized key (e.g. Faraday-specific fields not enumerated by VAUD) must be captured, not silently dropped. |

**Serialize (canonical to legacy JSON), from VAUD `serializeToBackyard`
(backyard.ts:200-221):**

| Canonical field | Target field(s) | Notes |
|---|---|---|
| `identity.name` | `aiName` AND `aiDisplayName` | VAUD writes the same value to both (backyard.ts:209-210). |
| `description` | `aiPersona` | Placeholder-converted back (tavernToBackyardPlaceholders). |
| `personality` | `personality` | Placeholder-converted back. |
| `scenario` | `scenario` | Placeholder-converted back. |
| `firstMessage` | `firstMessage` | Placeholder-converted back. |
| `exampleDialogue` | `customDialogue` | Placeholder-converted back. |
| `systemPrompt` | `systemPrompt` | Placeholder-converted back. |
| `identity.creator` or `options.creatorName` override | `creator` | backyard.ts:206,217: caller-supplied `creatorName` option takes precedence over the character's own creator field in VAUD's signature - Vaudeville Studios should default to the character's creator and treat the option as an explicit override, not silently prefer it. |
| `tags` | `tags` | |
| `character_version` if set, else `'1.0'` | `version` | Canonical field now maps native (see parse table above), so this is a direct write, not an escrow merge. VAUD's hardcoded `'1.0'` (backyard.ts:219) is the fallback only when the canonical field is unset (e.g. character built fresh in the studio, never carried a `version`). |
| `postHistoryInstructions`, `creatorNotes`, `alternateGreetings[]`, `depthInjections[]`, embedded lorebook reference | none | Legacy Backyard JSON has no target field for any of these. If the canonical character carries them (e.g. it round-tripped through a CCv2/v3 source first), the serializer reports them under `dropped` per escrow rule 3 (there is no legacy-Backyard extension mechanism to carry them in). |

**Detection (legacy JSON), from VAUD `isBackyardFormat` (backyard.ts:93-102):**

```
true if obj.aiName is present, OR obj.aiPersona is present, OR
obj.aiDisplayName is present, OR obj.customDialogue is present, OR
(obj.persona is present AND obj.description is absent)
```

The last clause is a heuristic and the weakest of the five: a bare `{persona: "..."}`
object with no `description` is common enough in ad hoc community JSON that it can
misfire against non-Backyard sources. This detector must run **after** `chara_card_v2`
/`v3` and RC `rcpersona` detection in the content-detector's priority chain (see
content-detection.md) so that a CCv2-shaped object with a stray `persona` key never
gets misclassified. VAUD does not enforce this ordering inside `backyard.ts` itself -
it is the caller's (content-detector's) responsibility, so the Vaudeville Studios
detector must encode the ordering explicitly rather than relying on this module.

**Macro conversion (legacy JSON only), from VAUD `backyardToTavernPlaceholders` /
`tavernToBackyardPlaceholders` (backyard.ts:66-84):**

Parse direction (Backyard to Tavern-style, applied to every prompt-bearing field
listed above):
```
{character} -> {{char}}   (case-insensitive)
{user}      -> {{user}}   (case-insensitive)
{char}      -> {{char}}   (case-insensitive; VAUD comment: "Also handle {char} variant")
```
Serialize direction (Tavern-style back to Backyard):
```
{{char}} -> {character}   (case-insensitive)
{{user}} -> {user}        (case-insensitive)
```

This conversion is **not a bijection** and is a direct Round-Trip Law risk (see edge
cases 4-6). `{{char}}` maps back to `{character}`, never to `{char}` - so a source
text containing literal `{char}` produces `{{char}}` on parse, which then produces
`{character}` on serialize, not `{char}`. The single-brace `{char}` variant is
parse-only in VAUD's implementation; there is no serialize-side inverse. Vaudeville
Studios' codec must either (a) escrow the pre-conversion raw text alongside the
converted canonical text so serialize-to-origin can replay the original bytes
verbatim, or (b) accept and document the lossy behavior as a named exception to the
Law for this one input class. Given the Law's "no codec merges without fixture-backed
round-trip proof" rule (the master plan (private planning notes)), option (a) is required, not optional:
raw pre-conversion text for each converted field goes into
`escrow.backyard.fields.raw.<fieldName>`.

This raw-text-preference scheme is a codec-specific refinement layered on top of
escrow rule 4, not a direct application of it - rule 4 (escrow-and-roundtrip.md)
says canonical wins outright when a canonical field and an escrowed field would
write to the same output location; it does not itself define a change-detection
mechanism. The mechanism this codec needs, and must implement explicitly: on
serialize-to-legacy-JSON, recompute what the parse-time canonical value would have
been by re-running `backyardToTavernPlaceholders` against the escrowed raw text; if
the current canonical field value is deep-equal to that recomputed value, the field
was never edited since parse, so emit the escrowed raw text verbatim (exact
round-trip); if the canonical value differs, the user edited it, so emit
`tavernToBackyardPlaceholders(currentCanonicalValue)` instead (a fresh, possibly
lossy conversion) and record `escrowShadowed` in the report per escrow rule 4. This
recompute-and-compare step, not rule 4 by itself, is what edge cases 4-6 below and
byaf edge case 9 rely on.

OPEN QUESTION: the canonical model has no documented cross-codec placeholder
convention (`canonical-model.md` does not mention `{{char}}`/`{{user}}` normalization
at all, and no macro-engine spec exists yet in this suite as of this writing). This
spec assumes `{{char}}`/`{{user}}` (ST/CCv2 convention) is the canonical in-text
convention, consistent with VAUD's own choice of Tavern-style as the intermediate
form, but that assumption should be confirmed against `specs/engine/macro-engine.md`
once written and this spec updated to match.

### B. `.byaf` (Backyard Archive Format, current)

Source: ahoylabs/byaf spec v1 (public, https://github.com/ahoylabs/byaf), fetched
2026-07-02. VAUDEVILLE has **no implementation** of this format (its only Backyard
codec is the legacy JSON above) - this section is written entirely from the public
spec, per the brief's allowance ("note where VAUD lacks an implementation, OPEN
QUESTIONs acceptable").

**Archive layout:**
```
archive.byaf                          (ZIP)
  manifest.json                       root manifest
  characters/<character-id>/
    character.json
    images/<filename>.<png|jpg|jpeg|webp|gif>
  scenarios/<scenario-id>.json        one or more
```

**Root manifest (`manifest.json`) fields**, from
`schemas/v1/byaf-manifest.schema.json`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | integer, const `1` | yes | |
| `$schema` | string (URI) | no | |
| `createdAt` | string (ISO-8601 date-time) | yes | |
| `author.name` | string | no | |
| `author.backyardURL` | string (URI) | no | |
| `characters` | array of string, exactly 1 item, pattern `characters/<id>/character.json` | yes | Spec note: "Only one character is allowed. Future versions may support multiple." |
| `scenarios` | array of string, >=1 item, pattern `scenarios/<id>.json` | yes | |

**Character manifest (`characters/<id>/character.json`) fields**, from
`schemas/v1/byaf-character.schema.json`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | integer, const `1` | yes | |
| `$schema` | string | no | |
| `id` | string | yes | |
| `name` | string | yes | "shorthand name or nickname" |
| `displayName` | string | yes | "full name of the character" |
| `isNSFW` | boolean | yes | |
| `persona` | string | yes | character description/personality, single field (no split between description/personality) |
| `createdAt` | string (date-time) | yes | |
| `updatedAt` | string (date-time) | yes | |
| `loreItems` | array of `{key: string, value: string}` | yes | may be empty array |
| `images` | array of `{path: string (pattern `images/<file>.<ext>`), label: string}` | yes | may be empty array |

**Scenario file (`scenarios/<id>.json`) fields**, from
`schemas/v1/byaf-scenario.schema.json` and confirmed against the SillyTavern BYAF
importer (`src/byaf.js`, SillyTavern/SillyTavern repo, fetched 2026-07-02):

| Field | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | integer, const `1` | yes | |
| `$schema` | string | no | |
| `title` | string | no | |
| `model` | string | no | "the model most recently used in the scenario" (GGUF filename reference) |
| `backgroundImage` | string | no | path to background image |
| `formattingInstructions` | string | yes | |
| `narrative` | string | yes | |
| `firstMessages` | array of `{characterID: string, text: string}`, 0-1 items | yes | |
| `exampleMessages` | array of `{characterID: string, text: string}` | yes | |
| `canDeleteExampleMessages` | boolean | yes | |
| `messages` | array, `oneOf` AI-type (`type:"ai"`, `outputs[]`) or human-type (`type:"human"`, `createdAt`, `updatedAt`, `text`) | yes | full chat transcript, not prompt-authoring data |
| `promptTemplate` | string or null | yes | |
| `grammar` | string or null | yes | |
| `minP`, `minPEnabled`, `temperature`, `repeatPenalty`, `repeatLastN`, `topK`, `topP` | number/boolean | yes | sampler settings |

**Field map (`.byaf` to canonical, single-scenario projection):**

| Source | Canonical field | Native/escrow/dropped | Notes |
|---|---|---|---|
| `character.displayName` (fallback `character.name`) | `identity.name` | native | Spec says `displayName` is "the full name"; `name` is "shorthand/nickname." VAUD's own precedent for the legacy codec prefers display-style names first, so this spec follows the same precedence. OPEN QUESTION: whether `name` should instead map to a canonical nickname field once the canonical Character's identity block gains one (canonical-model.md only lists `full_name`, not nickname, in the RC-derived detail set; CCv3 has a dedicated `nickname` field per chara-card-v3.md's brief - reconcile there). |
| `character.persona` | `description` | native | Single persona field with no personality/description split; do not fan it out into both canonical fields - leave `personality` unset. |
| `character.isNSFW` | content-rating field (RC surface: canonical-model.md "content rating") | native, with caveat | See edge case 9: the ahoylabs schema is a boolean, coarser than RC's graded content rating. Map `true` to the studio's most restrictive tier and `false` to unrated/general, and record the boolean original in escrow so no information is invented going the other way. |
| `character.loreItems[]` | referenced canonical `Lorebook` (`LorebookEntry[]`), per canonical-model.md rule 3 (embedded lorebook is a reference, not inline) | native | See Lorebook mapping below. |
| `character.images[]` | asset references (canonical-model.md "Open items": binary assets stored beside the entity, canonical model stores typed references) | native | `label` maps to the asset's display label; `path` becomes the on-disk asset reference inside the production. |
| `character.createdAt` / `updatedAt` | `meta.importedAt` is NOT this - these are source timestamps, not import timestamps | escrow `byaf.fields.character.createdAt/updatedAt` | Canonical `meta.importedAt` (canonical-model.md) is set by Vaudeville Studios at parse time; the source's own timestamps are provenance, not the same field, so they escrow. |
| `manifest.author.name` | `identity.creator` | native | |
| `manifest.author.backyardURL` | escrow `byaf.fields.manifest.author.backyardURL` | escrow | ST's importer folds this into `creator_notes` as a convenience (see below); this spec keeps it in escrow instead and lets the studio's UI surface it, since folding provenance into a free-text notes field is a lossy, one-way convention this spec does not want to inherit for round-trip purposes. |
| `scenarios[0].narrative` | `scenario` | native | Precedent: SillyTavern's `ByafParser.getCharacterCard()` maps `narrative` to the v2 card's `scenario` field. |
| `scenarios[0].firstMessages[0].text` | `firstMessage` | native | `firstMessages` is capped at 0-1 items per the schema (`maxItems: 1`), so there is at most one first message per scenario. |
| `scenarios[1..n].firstMessages[0].text` (every scenario after the first) | `alternateGreetings[]` | native | Precedent: the SillyTavern BYAF discussion (SillyTavern/SillyTavern#4691) states "the character now populates its alt greetings from all possible scenario's first messages." A `.byaf` archive with multiple scenario files becomes one canonical Character whose extra scenarios' openings fold into `alternateGreetings`. |
| `scenarios[0].exampleMessages[]` (`{characterID, text}[]`) | `exampleDialogue` | native, with format note | Canonical `exampleDialogue` is understood elsewhere in this suite as CCv2/v3-style `<START>`-block text (see chara-card-v2.md brief). This codec must join the `characterID`-tagged message list into that convention; see edge case 10 for the exact join rule (OPEN QUESTION on speaker-label formatting, since neither the byaf spec nor the ST importer document a canonical text join format - ST keeps them as separate structured entries internally). |
| `scenarios[0].formattingInstructions` | `systemPrompt` | native, precedent-based | Precedent: SillyTavern's importer maps `formattingInstructions` to `system_prompt`. An equally defensible reading is `postHistoryInstructions` (it describes desired *output* formatting, which is usually a post-history concern) - this spec follows the ST precedent since it is the only real-world mapping decision on record, but flags the alternative. OPEN QUESTION: confirm against a real Backyard export once one is added to the fixture corpus. |
| `scenarios[1..n]` (every non-primary scenario, in full) | escrow `byaf.fields.scenarios[]` (whole object) | escrow | Required for the Round-Trip Law - see Behavior note on multi-scenario below. |
| `scenarios[0].messages[]` (chat transcript) | escrow `byaf.fields.scenarios[0].messages` | escrow | Chat history has no canonical Character home; it is conversation data, not card-authoring data. |
| `scenarios[0].model`, `.promptTemplate`, `.grammar`, `.backgroundImage`, `.title`, `.canDeleteExampleMessages`, `.minP`, `.minPEnabled`, `.temperature`, `.repeatPenalty`, `.repeatLastN`, `.topK`, `.topP` | escrow `byaf.fields.scenarios[0].<field>` | escrow | Sampler/runtime settings have no canonical Character home (canonical `Preset` is a separate content type per canonical-model.md; a future ticket may map these into a companion `Preset` entity, but that is out of scope for this spec - see Non-goals). |
| `character.id`, `manifest.schemaVersion`, `character.schemaVersion`, any `$schema` pointers | escrow `byaf.fields.*` | escrow | Preserved for exact archive reconstruction. |

**Lorebook mapping (`loreItems[]` to canonical `LorebookEntry[]`):**

Precedent, from SillyTavern's `ByafParser.convertCharacterBook()`:
- `key` is comma-separated; split and trim into the entry's trigger keys array
  (canonical `LorebookEntry.keys`, per `packages/lorebook/src/types.ts:216` baseline
  adopted by canonical-model.md).
- `value` maps to the entry's content field.
- Entries get a sequential `insertion_order`/order index in source order.
- `enabled: true` is the default for every entry (`.byaf` carries no per-item
  enabled/disabled flag).
- No selectiveLogic, secondary keys, position, depth, probability, or budget data
  exists in the source; those canonical `LorebookEntry` fields (st-worldinfo.md,
  rolecall-lorebook.md) stay at their canonical defaults, not escrowed (there is
  nothing format-specific to preserve - the absence is total, not a dropped value).

**Multi-scenario handling:** a `.byaf` archive requires exactly one character
manifest but allows any number >= 1 of scenario files. This codec treats
`scenarios[0]` (first path listed in the manifest's `scenarios` array, in array
order) as the primary source for `scenario`/`firstMessage`/`exampleDialogue`/
`systemPrompt`, and every other scenario becomes escrow plus an `alternateGreetings`
contribution as described above. Full scenario objects (not just the fields not
otherwise mapped) are escrowed in full so that `serialize` can reconstruct
byte-for-byte-equivalent scenario JSON files, per escrow rule 1 ("nothing is dropped,
ever, at parse time").

**Detection (`.byaf`):** a file is a `.byaf` archive if it is a ZIP whose central
directory contains a `manifest.json` at the archive root matching the root-manifest
schema (`schemaVersion: 1`, `characters`, `scenarios` arrays present). This is
distinct in kind from every other codec in this suite (which detect from JSON object
shape or PNG chunk keyword) because the input is a ZIP container, not a bare JSON
payload or PNG. It belongs in the same detection tier as `charx.md`'s `.charx` ZIP
detection (both are ZIP-container formats) - see bundle-import.md and
content-detection.md for how ZIP-container detection is ordered relative to
mixed-content bundle detection (a `.byaf` is not a Vaudeville bundle export and must
not be misclassified as one).

**Legacy PNG embedding for Backyard/Faraday:**

OPEN QUESTION: this spec cannot state with confidence how the older Backyard/Faraday
character-in-PNG format embeds its payload. A WebFetch summary of the ahoylabs/byaf
README states the "legacy character PNG format embedded data via EXIF metadata," but
this claim is from an AI-generated summary of fetched page text, not a byte-level
inspection of an actual file or the parsing source code, and it is not corroborated
by any VAUDEVILLE source (VAUD's own PNG codec, `library/png-parser.ts`, handles only
tEXt-chunk keywords per png-embedding.md's brief, and `backyard.ts` in this repo only
ever consumes/produces a JSON string - it has no PNG-reading code path of its own).
If true, this would mean legacy Backyard PNGs are NOT read by Vaudeville Studios'
tEXt-chunk-based PNG codec at all and need a separate EXIF-reading code path - a
materially different implementation shape from every other PNG-embedded format in
this suite. Do not implement PNG-embedded Backyard support until this is confirmed
against a real sample file (add one to the fixture corpus and inspect its bytes
directly) or against the ahoylabs/byaf source code's actual PNG-parsing routine.
content-detection.md should treat legacy-Backyard-PNG detection as unimplemented
until this is resolved, rather than guessing a chunk keyword.

## Public API sketch

```ts
// packages/formats/src/backyard/index.ts
import type { Entity, Character, Lorebook } from '@vaud/core';
import type { Escrow, ParseReport, SerializeReport, Capabilities } from '@vaud/core';

export type BackyardVariant = 'legacy-json' | 'byaf';

export interface BackyardParseInput {
  variant: BackyardVariant;
  // legacy-json: a JSON string or parsed object.
  // byaf: raw archive bytes (the codec unzips internally).
  data: string | Uint8Array;
}

export interface BackyardParseResult {
  character: Entity<Character>;
  // .byaf may carry a referenced lorebook; legacy JSON never does.
  lorebook?: Entity<Lorebook>;
  // .byaf may carry embedded images; legacy JSON never does.
  assets?: Array<{ path: string; label: string; bytes: Uint8Array }>;
  report: ParseReport;
}

export interface BackyardSerializeOptions {
  variant: BackyardVariant;
  creatorName?: string;
  pretty?: boolean;
}

export interface BackyardSerializeResult {
  // legacy-json: a single JSON text file.
  // byaf: a full archive (manifest + character.json + scenario file(s) + images),
  // returned as a path->bytes map so the caller decides how to zip/write it.
  files: Record<string, string | Uint8Array>;
  report: SerializeReport;
}

export function detectBackyardVariant(
  input: { kind: 'json'; obj: Record<string, unknown> } | { kind: 'zip'; bytes: Uint8Array }
): BackyardVariant | null;

export function parseBackyard(input: BackyardParseInput): BackyardParseResult;

export function serializeBackyard(
  character: Entity<Character>,
  lorebook: Entity<Lorebook> | undefined,
  options: BackyardSerializeOptions
): BackyardSerializeResult;

export const backyardCapabilities: Record<BackyardVariant, Capabilities>;
```

Notes on this surface, given the dependency rule (`core <- formats <- everything`,
02-ARCHITECTURE.md): `parseBackyard`/`serializeBackyard` import only `@vaud/core`
types. Because `.byaf` bundles a Character, an optional Lorebook, and optional binary
assets, this codec's result is not a single `Entity<T>` the way a chara_card_v2 JSON
parse is - it is a small bundle, matching how canonical-model.md already treats an
embedded lorebook as "a REFERENCE to a canonical Lorebook entity" rather than an
inline blob. The legacy-JSON variant never populates `lorebook` or `assets`.

## Edge cases & failure modes

1. Legacy JSON with no name field at all (`aiName`, `aiDisplayName`, `displayName`,
   `name` all absent). VAUD silently defaults to `'Unnamed'` (backyard.ts:116).
   Vaudeville Studios must instead emit a `warnings` entry ("no name field found;
   using placeholder") and still produce `'Unnamed'`, so the report is honest per
   the "vaud convert prints reports honestly" rule (escrow-and-roundtrip.md).
2. Legacy JSON with neither `aiPersona`/`description`/`personality` present. VAUD
   already emits a `'No description or personality found'` warning
   (backyard.ts:160-162); preserve this warning text/intent.
3. Legacy JSON with neither `firstMessage`/`greeting`/`first_mes` present. VAUD
   emits `'No first message found'` (backyard.ts:163-164); preserve.
4. Legacy JSON field containing literal `{char}` (single brace). Parses to
   `{{char}}`; naive serialize-back produces `{character}`, not `{char}` - a
   round-trip failure unless the raw pre-conversion text is escrowed (see Behavior
   A, Macro conversion). Required fixture.
5. Legacy JSON field containing `{{char}}` literally (already double-braced, e.g. a
   card that started life as a CCv2 export and was hand-edited into Backyard JSON).
   Trace it through VAUD's `backyardToTavernPlaceholders` regex chain
   (backyard.ts:69-71) in the order it actually runs: the first two replaces
   (`{character}`, `{user}`) do not match. The third, `/\{char\}/gi -> '{{char}}'`,
   DOES match - it matches the inner `{char}` substring found inside `{{char}}`
   (the substring at offset 1-6 of `{{char}}` is exactly `{char}`), so the whole
   string mutates to `{{{char}}}` (three opening braces, three closing) at PARSE
   time, not serialize time. This is worse than a serialize-side rewrite: it is a
   parse-time corruption of a string that was already in the target convention and
   needed no conversion at all. A subsequent serialize-direction
   `tavernToBackyardPlaceholders` pass on `{{{char}}}` matches the inner `{{char}}`
   token (its regex is `/\{\{char\}\}/gi`) and produces `{{character}}` (note the
   doubled outer brace is NOT consumed by that regex), not a clean `{character}` and
   not the original `{{char}}` - a compounding, not merely lossy, transformation.
   Required fixture; the fixture's `expected.json` must encode this exact
   `{{char}}` -> `{{{char}}}` parse-time behavior, not a "left untouched" assumption.
   Document as a known non-bijection unless raw-text escrow (Behavior A) is applied,
   in which case escrow prevents the mutation from surfacing on serialize-to-origin
   (the corrupted intermediate value is still what lands in the canonical field
   after parse, but serialize-to-origin restores the untouched raw text per the
   recompute-and-compare mechanism in Behavior A, and only editing surfaces that
   read the canonical field directly, not through serialize-to-origin, would see the
   corrupted form - flag this as a UI-facing concern for whatever surface displays
   canonical `description`/etc. text for a round-tripped Backyard character).
6. Legacy JSON field containing `{User}` mixed case, or `{Character}` - VAUD's
   regexes are case-insensitive (`/gi` flag, backyard.ts:69-71) so casing is
   normalized away on parse; serialize-back always produces lowercase
   `{character}`/`{user}` (backyard.ts:82-83), which is a second non-bijective path
   distinct from edge case 4. Escrow raw text covers this too.
7. Legacy JSON with unrecognized top-level keys beyond the enumerated field list
   (the type's `[key: string]: unknown` index signature, backyard.ts:54). Must
   escrow every one, not just the ones VAUD's TypeScript interface happens to name.
8. `.byaf` archive whose `manifest.json` lists a `characters` path that does not
   exist inside the ZIP, or whose referenced file fails schema validation. Parse
   must fail with a clear error (not attempt a partial parse), since the root
   manifest is the archive's only entry point.
9. `.byaf` `character.isNSFW: true` mapping into a graded content-rating field
   (canonical-model.md's RC content-rating surface has more than two tiers per
   `rolecall-character.md`'s brief). Do not invent an intermediate tier; map `true`
   to the single most-restrictive tier the canonical model defines and record the
   source boolean in escrow so serialize-to-`.byaf` can recover the exact original
   value regardless of what a user later picks in a graded UI (escrow rule 4:
   canonical wins on conflict, but only once actually edited).
10. `.byaf` `exampleMessages[]` join format. The array is a flat, ordered list of
    `{characterID, text}` with no explicit format for turning it into the
    `<START>`-block prose convention canonical `exampleDialogue` uses elsewhere in
    this suite. OPEN QUESTION: exact join template (e.g. `{{char}}: text` per line,
    blank-line-separated turns, or something else) - needs a real fixture to confirm
    against how Backyard's own UI renders these back, or against SillyTavern's
    ByafParser output byte-for-byte. Until resolved, implement the join as
    `${characterID}: ${text}` lines separated by newlines (matching the `#{character}:`
    /`#{user}:` speaker-prefix convention the byaf macro replacer already expects,
    per Behavior A's ST-precedent macro table) and flag it a warning-level assumption
    in the parse report, not a silent default.
11. `.byaf` archive with zero scenario files. The manifest schema requires
    `minItems: 1` on `scenarios`, so a conforming archive cannot have zero - but a
    hand-edited or corrupted archive might. Treat as a validation failure (edge
    case 8's handling), not a soft fallback to an empty scenario.
12. `.byaf` `loreItems[]` with an empty `key` or `value` string (schema allows any
    string, including empty). Parse it as a canonical entry with empty
    keys/content rather than dropping it - dropping would violate "nothing is
    dropped, ever, at parse time" (escrow-and-roundtrip.md rule 1). Flag as a
    warning.
13. `.byaf` `images[]` entries whose declared `path` does not resolve to an actual
    ZIP entry, or whose bytes are not a valid image of the declared extension. Treat
    like edge case 8: a validation failure for that entry, reported, not a silent
    skip that would corrupt round-trip fidelity for the archive as a whole.
14. A file that satisfies the legacy-JSON detector (`isBackyardFormat`) AND is also
    valid CCv2 JSON (contrived but possible if a card has both `spec: "chara_card_v2"`
    and a stray `persona` key with no `description`). Detection ordering (Behavior A)
    must be enforced by the caller (content-detection.md); this spec does not itself
    resolve the ambiguity, only documents that it exists and names the priority
    (CCv2/v3/rcpersona before legacy Backyard).
15. Legacy-JSON serialize when the canonical character carries an
    `alternateGreetings[]`, `postHistoryInstructions`, `depthInjections[]`, or a
    referenced lorebook (fields legacy Backyard cannot express and has no escrow
    slot to recover from, since the source format itself has no such concept).
    Report each as `dropped` per escrow rule 3 ("serialize to a foreign format ...
    else noted as dropped in the report"); `--strict` CLI runs must exit nonzero
    (escrow-and-roundtrip.md, Reports section).

## Test plan

- Fixtures required:
  - `fixtures/backyard/legacy-json/minimal.json` - only `aiName` + `aiPersona`,
    exercises the "mostly empty" path and warnings 2/3.
  - `fixtures/backyard/legacy-json/full-fields.json` - every field VAUD's
    `BackyardCharacter` interface names populated, including `persona` (not
    `description`) to exercise the detector's weak fifth clause.
  - `fixtures/backyard/legacy-json/single-brace-char.json` - exercises edge case 4
    (`{char}` literal).
  - `fixtures/backyard/legacy-json/already-double-braced.json` - exercises edge
    case 5.
  - `fixtures/backyard/legacy-json/mixed-case-placeholders.json` - exercises edge
    case 6.
  - `fixtures/backyard/legacy-json/unknown-extra-fields.json` - exercises edge
    case 7 (escrow completeness).
  - `fixtures/backyard/legacy-json/no-name.json` - exercises edge case 1.
  - `fixtures/backyard/byaf/single-scenario-minimal.byaf` - one character, one
    scenario, no lore items, no images.
  - `fixtures/backyard/byaf/full-lorebook.byaf` - multiple `loreItems` with
    comma-separated multi-keyword entries, exercising the Lorebook mapping.
  - `fixtures/backyard/byaf/multi-scenario.byaf` - 3+ scenarios, exercising
    `alternateGreetings` folding and full-scenario escrow (edge case list item on
    multi-scenario handling).
  - `fixtures/backyard/byaf/with-images.byaf` - 2+ images, exercising asset
    reference mapping and edge case 13 (one entry deliberately pointing at a
    missing path).
  - `fixtures/backyard/byaf/corrupted-manifest.byaf` - references a
    nonexistent character path, exercising edge case 8/11.
  - `fixtures/backyard/byaf/example-messages.byaf` - populated `exampleMessages[]`,
    exercising edge case 10's join format (marked provisional pending the OPEN
    QUESTION).
- Round-Trip Law applicability:
  - Legacy JSON: byte-identity level `canonical-json` is achievable for fields with
    no placeholder content; for any fixture containing placeholder text, byte-identity
    level is `semantic` only, gated on raw-text escrow (Behavior A) actually being
    implemented - until then, those fixtures are expected to FAIL byte/canonical-json
    comparison and must be tracked as known failures, not silently excluded from the
    harness.
  - `.byaf`: byte-identity level `semantic` at most. A re-zipped archive will not be
    byte-identical (ZIP central directory metadata, compression settings); image
    bytes should be preserved exactly (verify with a checksum comparison inside the
    harness even though full-archive byte comparison is not required) and every
    JSON file's *parsed* content (not raw bytes) must deep-equal the original after a
    parse -> serialize -> parse cycle.
- Property/unit tests beyond fixtures:
  - Placeholder conversion round-trip property test: for a corpus of generated
    strings containing `{char}`, `{{char}}`, `{character}`, `{user}`, `{{user}}` in
    combination, assert that with raw-text escrow enabled, serialize-to-origin
    recovers the exact original string, for every combination.
  - `loreItems` key-splitting property test: comma-separated keys with surrounding
    whitespace, empty segments, and duplicate keys across entries.
  - Detector priority test: assert legacy-Backyard detection never wins against a
    valid CCv2/v3 or `rcpersona` object in the shared content-detector, per edge
    case 14.

## Non-goals

- This spec does not define how `.byaf` sampler/runtime settings
  (`temperature`, `topP`, `model`, etc.) map into the canonical `Preset` content
  type. They are escrowed as opaque data. A future ticket may add a
  scenario-to-Preset projection; it needs its own spec update first.
- This spec does not define chat-history import (`.byaf` `messages[]`). Vaudeville
  Studios has no canonical "chat session" content type as of this writing
  (canonical-model.md's v1 surface list does not include one); the data is
  escrowed, not modeled.
- This spec does not resolve legacy Backyard/Faraday PNG-embedded character
  support (see the OPEN QUESTION in Behavior). No PNG detection or parsing code
  should be written against this spec's guesses.
- This spec does not cover Backyard's live import-from-URL/hub flow (fetching a
  character from `backyard.ai/hub/...`) - only the two on-disk export shapes.

## Sources consulted

- VAUDEVILLE `apps/rc/src/lib/formats/character/backyard.ts` (full file, all line
  refs above point here); confirmed byte-identical against
  `apps/plot/src/lib/formats/character/backyard.ts` by direct read.
- `vaudeville-studios/the master plan (private planning notes)`
- `vaudeville-studios/docs/02-ARCHITECTURE.md`
- `vaudeville-studios/the production bible (private planning notes)` (this file's brief row)
- `vaudeville-studios/specs/formats/canonical-model.md`
- `vaudeville-studios/specs/formats/escrow-and-roundtrip.md`
- `vaudeville-studios/templates/SPEC-TEMPLATE.md`
- ahoylabs/byaf (public spec repo), fetched 2026-07-02:
  - `https://github.com/ahoylabs/byaf` (overview)
  - `https://raw.githubusercontent.com/ahoylabs/byaf/main/README.md`
  - `https://raw.githubusercontent.com/ahoylabs/byaf/main/specs/v1/root-manifest.md`
  - `https://raw.githubusercontent.com/ahoylabs/byaf/main/specs/v1/character.md`
  - `https://raw.githubusercontent.com/ahoylabs/byaf/main/specs/v1/scenario.md`
  - `https://raw.githubusercontent.com/ahoylabs/byaf/main/schemas/v1/byaf-manifest.schema.json`
  - `https://raw.githubusercontent.com/ahoylabs/byaf/main/schemas/v1/byaf-character.schema.json`
  - `https://raw.githubusercontent.com/ahoylabs/byaf/main/schemas/v1/byaf-scenario.schema.json`
    (schema content for `firstMessages`/`exampleMessages`/`messages` retrieved via
    fetch-and-summarize; not read as raw bytes directly for this one file, unlike
    the manifest/character schemas which were retrieved verbatim)
- SillyTavern/SillyTavern GitHub discussion #4691, "Full support for BYAF import.",
  fetched 2026-07-02 (https://github.com/SillyTavern/SillyTavern/discussions/4691) -
  source of the multi-scenario / alternate-greetings folding behavior and the
  pointer to the ahoylabs/byaf spec.
- SillyTavern/SillyTavern `src/byaf.js` (release branch), fetched 2026-07-02
  (`https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/src/byaf.js`) -
  source of the `replaceMacros()` regex table, the `getCharacterCard()` field
  mapping table, and the `convertCharacterBook()` loreItems-to-character-book
  conversion described above. Retrieved via fetch-and-summarize, not raw bytes;
  treat the exact regex ordering as reported, not independently verified byte-for-
  byte, and re-verify against the actual file before implementing.
- `https://backyard.ai/docs/feature-guides/import-export` - checked, but the page
  states only "Docs on imports and exports coming soon" as of the fetch date; no
  usable content.
- `https://backyard.ai/docs/creating-characters/lorebooks` - general lorebook
  behavior description (keyword/value pairs, 384-token combined budget, case-
  insensitive keywords) used only as corroborating context, not as a field-map
  source (it describes the product UI, not the export JSON shape).
- GitHub `EliseWindbloom/Convert-BackyardAI-card-to-TavernAI-png-json` - checked as
  a secondary community source; its field list matches VAUD's legacy-JSON field set
  and added no new information.
