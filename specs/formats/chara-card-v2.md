# Spec: Character Card V2 (chara_card_v2)

**Package:** `packages/formats` · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/png-embedding.md (PNG carriage), specs/formats/rolecall-character.md
(rcpersona-side fields consumed here), specs/formats/st-worldinfo.md (embedded
lorebook target shape)
**VAUDEVILLE reference:** `apps/rc/src/lib/formats/character/parse-v2.ts`,
`apps/rc/src/lib/formats/character/serialize-v2.ts`,
`apps/rc/src/lib/formats/character/character-book.ts`

## Purpose

Defines the `packages/formats` codec for chara_card_v2 (the SillyTavern/TavernAI
"Character Card V2" JSON format, spec ID `chara_card_v2`). This is the most widely
distributed character card format in the AI-roleplay ecosystem (Chub.ai, SillyTavern,
Backyard-adjacent tooling, RoleCall all read/write it) and is the JSON payload most
often embedded in a PNG `tEXt` chunk (see png-embedding.md for the carriage layer).
This spec covers parsing a V2 JSON object into the canonical `Character` entity plus
escrow, and serializing a canonical `Character` back to V2 JSON. It does not cover PNG
chunk I/O (png-embedding.md) or the RoleCall-native `rcpersona` sibling format
(rolecall-character.md), though it documents the `extensions.rolecall` namespace this
codec must round-trip untouched.

## Behavior

### Top-level shape

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": { "...": "see field map" }
}
```

`spec` MUST equal the literal string `"chara_card_v2"`. `spec_version` is a string,
currently `"2.0"`; the codec does not reject other values (forward-compat: the public
spec states "future minor versions for the same spec MUST be non-breaking"), it is
carried in `meta.origin.version`. `data` is a required object.

Source: public chara_card_v2 spec (github.com/malfoyslastname/character-card-spec-v2,
fetched via web research, section "Character Card V2 JSON Schema"); confirmed against
`apps/rc/src/lib/formats/character/serialize-v2.ts:23-27` (`CharacterCardV2` interface)
and `parse-v2.ts:112-121` (`isV2Card`, which additionally requires `data.name` to be a
string, VAUDEVILLE is stricter than the bare public spec here, and this codec adopts
that stricter check for `detect()`).

### V1 compatibility note

A card with no `spec` field and a top-level `name: string` (no `data` wrapper) is
chara_card_v1 (the original six fields: name, description, personality, scenario,
first_mes, mes_example), not V2. `detect()` for this codec must return false for V1
shape; a separate V1 fallback path is out of scope for this spec (VAUDEVILLE's
`parseV1` in `parse-v2.ts:151-167` upgrades V1 in the same module for convenience, but
V1 is not part of the chara_card_v2 spec contract and is not required here, see
Non-goals). Source: `parse-v2.ts:96-106` (`isV1Card`).

### Flat V2 data (no wrapper), detection trap

SillyTavern's own PNG exporter, and RoleCall's PNG exporter for ST compatibility,
embed the V2 `data` payload directly as the PNG chunk contents with no `{spec, data}`
wrapper. A JSON object that has `name: string`, no `spec`, no `data`, AND at least one
of `alternate_greetings` / `system_prompt` / `post_history_instructions` /
`creator_notes` / `extensions` / `character_version` is "flat V2 data" and must be
parsed as V2 by wrapping it: `{ spec: 'chara_card_v2', spec_version: '2.0', data: json
}`. Without this detection, re-importing your own PNG export silently degrades to V1
and drops `alternate_greetings`, `system_prompt`, and `extensions`. This is a
documented regression trap, not a nice-to-have. Source: `parse-v2.ts:291-311`
(`isFlatV2Data`) and its comment block explaining the regression it fixes.

### Field map: V2 JSON -> canonical Character

| Source field (data.*) | Canonical field | Native/Escrow/Dropped | Notes |
|---|---|---|---|
| `name` | `identity.name` | native | required string |
| `description` | `description` | native | required string, default `''` if absent on lenient parse |
| `personality` | `personality` | native | |
| `scenario` | `scenario` | native | |
| `first_mes` | `firstMessage` | native | |
| `mes_example` | `exampleDialogue` | native | |
| `creator_notes` | `presentation.creatorNotes` | native | V2 "notes for other creators" field; distinct from RC's own `creator_notes` concept, see rolecall extension row below |
| `system_prompt` | `systemPrompt` | native | |
| `post_history_instructions` | `postHistoryInstructions` | native | |
| `alternate_greetings` | `alternateGreetings[].text` | native | plain `string[]` in V2; canonical model's richer `{text, title?}` shape is populated from `extensions.rolecall.alternate_greeting_titles` when present (see below), otherwise `title` is left unset |
| `tags` | `identity.tags` | native | |
| `creator` | `identity.creator` | native | |
| `character_version` | `identity.characterVersion` | native | free-text string, not semver-validated |
| `character_book` (data-level, spec-compliant) | Lorebook reference | native (as reference) | see "Embedded lorebook" below; the parsed `CharacterBook` is converted through `fromCharacterBook()` (character-book.ts:459) into a canonical Lorebook entity, and the Character's `embeddedLorebooks` field holds a reference/id to it, per canonical-model.md rule 3 ("an embedded lorebook is a REFERENCE ... codecs inline/extract at the boundary") |
| `extensions.character_book` (RoleCall exporter location) | Lorebook reference | native (as reference) | non-spec-compliant location some RoleCall exports use; parsed in addition to data-level `character_book` if the two are not the same object (dedup by reference identity, not deep-equal) |
| `extensions.character_books` (array) | multiple Lorebook references | native (as reference) | RoleCall-only extension for multiple embedded lorebooks (spec has no native multi-book concept) |
| `extensions.rolecall.tagline` | `identity.tagline` (canonical field, see canonical-model.md's "RoleCall native" list) | native | canonical-model.md lists `tagline` explicitly as a canonical-model field the Character superset must cover; full RC-side semantics owned by rolecall-character.md, but this codec must treat it as a first-class round-trippable field, not opaque escrow |
| `extensions.rolecall.genre` | `rc.genre` | escrow | not named in canonical-model.md's Character superset list; no canonical home yet |
| `extensions.rolecall.fandom` | `rc.fandom` | escrow | not named in canonical-model.md's Character superset list; no canonical home yet |
| `extensions.rolecall.nsfw` | `rc.nsfw` | escrow | not named in canonical-model.md's Character superset list; no canonical home yet |
| `extensions.rolecall.content_rating` | `identity.contentRating` (canonical field) | native | canonical-model.md lists "content rating" explicitly; `'all_hours' \| 'late_night' \| 'after_dark'` |
| `extensions.rolecall.source_url` | `rc.sourceUrl` | escrow | not named in canonical-model.md's Character superset list; no canonical home yet |
| `extensions.rolecall.image_url` | `rc.imageUrl` | escrow | not named in canonical-model.md's Character superset list; no canonical home yet |
| `extensions.rolecall.creator_notes` | `rc.creatorNotesRolecall` | escrow | distinct key from `data.creator_notes`; RoleCall keeps both because the V2 `creator_notes` slot is sometimes backfilled from RC's `tagline` on serialize (see serializer note below) |
| `extensions.rolecall.creators_note` | `rc.creatorsNote` | escrow | yes, a third similarly-named field; do not collapse these three (`data.creator_notes`, `rolecall.creator_notes`, `rolecall.creators_note`) into one canonical slot without a dedicated design pass, treat all three as escrow under `rolecall` except `data.creator_notes` which is native |
| `extensions.rolecall.accent_color` | `rc.accentColor` | escrow | listed under canonical-model.md's "palette/signature colors" umbrella but not itself named field-by-field; treat as escrow until rolecall-character.md fixes the exact canonical path |
| `extensions.rolecall.details` | `identity.details` (canonical field: CharacterDetails, palette, full_name, title, age, pronouns, fieldOrder, prompt_depth_injections) | native | canonical-model.md explicitly lists `details (palette/signature colors, full_name, title, age, pronouns, fieldOrder, prompt_depth_injections)` as part of the RoleCall-native canonical surface; full shape owned by rolecall-character.md, this codec must round-trip it as a native field, not escrow |
| `extensions.rolecall.recommendations` | `rc.recommendations` | escrow | not named in canonical-model.md's Character superset list; no canonical home yet |
| `extensions.rolecall.trackerPreset` | `rc.trackerPreset` | escrow | not named in canonical-model.md's Character superset list; VAUDEVILLE-internal shape not part of this spec |
| `extensions.rolecall.alternate_greeting_titles` | merged into `alternateGreetings[].title` | native (consumed, not separately escrowed) | parallel array to `data.alternate_greetings`; index `i` title applies to greeting `i`; `null` entries mean no title. This is one of the `rolecall.*` sub-fields that IS pulled fully into a canonical field rather than parked in escrow, because canonical `alternateGreetings` already models `{text, title}` |
| `extensions.rolecall.linkedRegexScripts` | `embeddedRegexScripts` | native (as reference source) | PRIMARY source for embedded regex scripts. Read at parse-v2.ts:200 (`rolecall?.linkedRegexScripts`) before either top-level fallback below; source tag `'linkedRegexScripts'` when non-empty |
| `extensions.rolecall.id`, `.token_count`, `.thumbnail_url`, `.loadout`, `.linkedLorebooks` | n/a | escrow | present in the serializer's `rolecall` shape (serialize-v2.ts:105-135) but not consumed by the parser (`parseV2` in parse-v2.ts:169-267 does not read `id`, `token_count`, `thumbnail_url`, `loadout`, or `linkedLorebooks` off the incoming object), carry them opaquely in escrow so a parse->serialize round trip of a RoleCall-sourced card does not lose them |
| `extensions.linkedRegexScripts` (top-level, not under `rolecall`) | `embeddedRegexScripts` | native (as reference source) | fallback location checked ONLY when `extensions.rolecall.linkedRegexScripts` is absent/empty (parse-v2.ts:201-207); source tag `'linkedRegexScripts'` |
| `extensions.regex_scripts` | `embeddedRegexScripts` | native (as reference source) | flat SillyTavern-style regex script array, used only if no `linkedRegexScripts` were found from either location above; source tag `'regex_scripts'` |
| `extensions.talkativeness`, `.fav`, `.world`, `.depth_prompt`, any other unrecognized key | `extensions` (canonical passthrough map) | escrow (verbatim) | per canonical-model.md rule 4: "extensions maps pass through untouched inside escrow unless a codec claims them." `depth_prompt` in particular (`{prompt, depth, role?}`) is a common third-party single depth-injection extension; this codec does not attempt to fold it into canonical `depthInjections[]`, it stays escrow only, because RC's own `depthInjections` concept lives under `rolecall.details.prompt_depth_injections`, a different shape, and conflating the two risks corrupting one on round-trip |

Absent optional string fields (`description`, `personality`, `scenario`, `first_mes`,
`mes_example`, `system_prompt`, `post_history_instructions`, `creator_notes`) parse to
`''`, not `undefined`, matching `parse-v2.ts:219-226` (`data.description || ''` etc.).
`tags` absent parses to `[]`. `character_version` absent parses to `'1.0'`
(`parse-v2.ts:229`), which is a parser-assigned default, not a value read from the
source file, record this as a parser default, not a native field read, in any
generated report.

### Embedded lorebook (character_book) field map

Source: `apps/rc/src/lib/formats/character/character-book.ts`. `CharacterBook` ->
canonical `Lorebook` via `fromCharacterBook()` (character-book.ts:459-558); the reverse
direction canonical `Lorebook` -> `CharacterBook` is `toCharacterBook()`
(character-book.ts:318-422).

| character_book field | canonical LorebookEntry / Lorebook field | Native/Escrow/Dropped | Notes |
|---|---|---|---|
| `name` | `Lorebook.name` | native | defaults to `'Imported Lorebook'` if absent |
| `description` | `Lorebook.description` | native | |
| `scan_depth` | `Lorebook.globalScanDepth` (RC: `global_scan_depth`) | native | default `100` |
| `token_budget` | `Lorebook.tokenBudget` | native | default `0` |
| `recursive_scanning` | `Lorebook.globalRecursion` | native | default `false` |
| `extensions` (book-level) | `Lorebook.extensions` (escrow-adjacent passthrough, incl. `categories`) | escrow | preserved verbatim so a re-export rebuilds the same category set |
| entry `keys` | `LorebookEntry.triggers[]` | native | each key run through `parseRegexKeyword()`: a `/pattern/flags` string becomes a regex trigger, otherwise a plain keyword trigger; `use_regex: true` on the entry forces `isRegex: true` for all keys regardless of `/…/` wrapping |
| entry `secondary_keys` | `LorebookEntry.secondaryTriggers[]` | native | same parsing as `keys` |
| entry `selective` | drives `trigger_mode: 'advanced'` when true or when `secondary_keys` present | native (folded into trigger_mode + selective_logic) | |
| entry `content` | `LorebookEntry.content` | native | |
| entry `enabled` | `LorebookEntry.enabled` | native | disabled entries are still exported/imported (character-book.ts:321-322 comment: "include ALL entries ... so that a re-import can restore them faithfully") |
| entry `insertion_order` | `LorebookEntry.sortOrder` | native | falls back to array index |
| entry `use_regex` | folds into trigger `isRegex` flags | native (not separately stored) | |
| entry `case_sensitive` | `LorebookEntry.caseSensitive` | native | nullable |
| entry `name` | `LorebookEntry.title` | native | defaults to `Entry {index+1}` if absent |
| entry `priority` | `LorebookEntry.priority` | native | default `100` if absent, read via `extensions.order` fallback too |
| entry `id` | not mapped to a canonical entry id (canonical ids are ulids) | dropped (or escrow if the codec wants exact round-trip of numeric ids) | `toCharacterBook()` emits `id: index` on serialize (character-book.ts:398), i.e. it does not preserve an original numeric `id`, it re-numbers by position, this is a known non-round-trip point for the `character_book.entries[].id` field specifically |
| entry `comment` | `LorebookEntry.comment` | native | |
| entry `constant` | `LorebookEntry.constant` | native | |
| entry `position` (`'before_char' \| 'after_char'`) | `LorebookEntry.position` (`'world' \| 'character' \| 'before_example' \| 'after_example' \| 'depth' \| 'scene'`) | native (lossy mapping, see edge case 3) | `before_char` -> `world`, `after_char` -> `character`; the reverse direction collapses RC's richer position enum down to only two spec values, see Edge case 3 |
| entry `extensions.*` (RC-only fields: `depth`, `role`, `scan_depth`, `match_whole_words`, `selective_logic`, `probability`, `probability_mode`, `sticky`, `cooldown`, `delay`, `group_name`, `group_weight`, `allow_recursion`, `exclude_recursion`, `prevent_recursion`, `delay_until_recursion`, `use_memo`, `ignore_budget`, `scan_character_description`, `scan_character_personality`, `scan_user_persona`, `scan_scenario`, `scan_preset`) | corresponding `LorebookEntry.*` fields | native (via extensions, not escrow) | `fromCharacterBook()` actively reads these keys off `entry.extensions` with camelCase/snake_case fallback pairs (`firstDefined(entryRecord.scanDepth, entryRecord.scan_depth, entryExt.scanDepth, entryExt.scan_depth)` etc., character-book.ts:481-529); this codec must replicate that dual-casing tolerance, not just the snake_case form |
| entry `extensions.category` / `extensions.category_name` | `LorebookEntry.categoryName` (pass-through field, not part of the entry proper) | native (pass-through) | resolved by the standalone lorebook importer later, not by this codec |

Full field-level detail for LorebookEntry / trigger semantics (selectiveLogic values,
position depth/role defaults, recursion controls, budgets) is owned by
`specs/engine/lorebook-engine.md` and `specs/formats/st-worldinfo.md`; this table only
covers the character_book <-> canonical mapping specific to embedding inside a V2 card.

### Serialization: canonical Character -> V2 JSON

Source: `serialize-v2.ts:148-260` (`serializeToV2`).

- Required string fields (`description`, `personality`, `scenario`, `first_mes`,
  `mes_example`, `system_prompt`, `post_history_instructions`) are always emitted as
  strings, defaulting to `''` when the canonical value is empty/undefined.
- `creator_notes`: VAUDEVILLE emits this from `character.creator_notes` with a
  fallback to `character.tagline` when `creator_notes` itself is empty, a legacy
  compatibility fallback for "older rows that only had a tagline"
  (serialize-v2.ts:245-248). This codec MUST NOT replicate that fallback. It is a
  Round-Trip Law violation over a canonical data field: a card with
  `data.creator_notes: ''` and `extensions.rolecall.tagline: 'X'` parses to
  canonical `presentation.creatorNotes: ''` + `identity.tagline: 'X'`; re-serializing
  with the fallback would emit `data.creator_notes: 'X'`, and re-parsing yields
  `creatorNotes: 'X'` which is not deep-equal to the original `''`. This codec
  therefore emits `creator_notes` from `presentation.creatorNotes` ONLY (defaulting
  to `''`), with no tagline fallback. The parsed `identity.tagline` still round-trips
  independently through `extensions.rolecall.tagline` (see field map). This is a
  deliberate deviation from VAUDEVILLE parity in favor of the Round-Trip Law, the M0
  constitution.
- `alternate_greetings` is emitted as `string[]` (text only); any `title` on a
  canonical alternate greeting is emitted separately into
  `extensions.rolecall.alternate_greeting_titles` as a parallel nullable array, only
  when at least one greeting has a title (`hasTitles` check, serialize-v2.ts:199,221).
  A foreign (non-RoleCall) consumer that does not understand `rolecall.*` therefore
  sees plain greetings with silently dropped titles, this is expected escrow
  behavior, not a bug, per escrow-and-roundtrip.md rule 3 (serialize to a foreign
  format carries what it can, escrows the rest into the target's extension
  mechanism).
- `character_version` is always serialized as the literal `'1.0'`
  (serialize-v2.ts:254), regardless of the canonical value read at parse time. This
  is a VAUDEVILLE-specific behavior, not a spec requirement, OPEN QUESTION: should
  this codec preserve the parsed `character_version` on round-trip instead of
  hardcoding `'1.0'`? VAUDEVILLE's serializer does not do so; doing so would improve
  round-trip fidelity but deviates from the reference implementation. Default to
  preserving the parsed value (better Round-Trip Law compliance) and flag the
  VAUDEVILLE behavior as a known deviation, since M0's constitution is the Round-Trip
  Law, not bug-for-bug VAUDEVILLE parity, confirm with Chi before implementation.
- `creator` is emitted from an explicit `creatorName` option, not from a canonical
  identity field read at parse time, i.e. VAUDEVILLE's serializer takes the creator
  name as a caller-supplied parameter, defaulting to `''`. This codec should instead
  round-trip the parsed `identity.creator` field directly (falling back to `''`),
  since holding it in escrow/refusing to round-trip an already-native field would
  violate the Round-Trip Law for the common case of parse-then-serialize with no
  intervening edit.
- `extensions` is rebuilt by re-emitting every entry from the canonical passthrough
  extensions map EXCEPT the keys `rolecall`, `character_book`, `character_books`
  (those three are reconstructed from first-class canonical data, not passed
  through blindly), serialize-v2.ts:170-175.
- Embedded lorebook(s): single lorebook -> `extensions.character_book`; more than one
  -> `extensions.character_books` (array). Note this differs from the parse side,
  which additionally recognizes a spec-compliant `data.character_book` (V3-style,
  data-level) location, VAUDEVILLE's V2 serializer never writes to `data.character_book`,
  only to `extensions.character_book`. Both are spec-legal per the public schema
  (which places `character_book` inside `data`, i.e. at the same level as
  `extensions`, not nested under `extensions`), VAUDEVILLE's choice to nest it under
  `extensions.character_book` on write is a deviation from the strict public schema.
  This codec's serializer MUST write `character_book` at `data.character_book`
  (spec-compliant location) to maximize compatibility with strict V2 readers, and
  MAY additionally mirror it at `extensions.character_book` for RoleCall-ecosystem
  compatibility. OPEN QUESTION: confirm with Chi whether mirroring at both locations
  is desired or whether spec-compliant-only is preferred (mirroring doubles payload
  size for large lorebooks).
- `extensions.rolecall.*` is populated from canonical RC-escrow fields when
  `includeRoleCallExtensions` is true (default true in VAUDEVILLE); this codec's
  equivalent flag should default to on only when escrow actually contains a
  `rolecall` namespace from a prior parse (i.e. do not synthesize an empty
  `rolecall` block for a card that never had RC data), to avoid VAUDEVILLE-branding
  cards that started life as plain SillyTavern exports.

### Detection precedence

For a bare JSON object (not yet known to be a character card), detection order per
`parseCharacterJson` (parse-v2.ts:316-391): V3 first, then V2 (wrapped), then flat V2
data, then V1, then Backyard.ai heuristic detection. This codec (chara_card_v2) owns
steps 2 and 3 of that order; V3 is owned by chara-card-v3.md, V1 and Backyard by their
own specs/OPEN QUESTIONs. The combined `detectFormat`/content-detection ordering across
ALL formats (not just character-card variants) is owned by content-detection.md, this
spec only guarantees that within the character-card family, V2-flat is tried before
V1 so a V2-shaped object with no wrapper is never misclassified as V1.

## Public API sketch

```ts
// packages/formats/src/character/chara-card-v2.ts

import type { Character, Escrow, ParseReport, SerializeReport } from '@vaud/core';

export interface CharaCardV2Json {
  spec: 'chara_card_v2';
  spec_version: string;
  data: CharaCardV2Data;
}

export interface CharaCardV2Data {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  character_book?: CharacterBookJson;
  extensions: Record<string, unknown>;
}

export interface CharacterBookJson {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: CharacterBookEntryJson[];
}

export interface CharacterBookEntryJson {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char';
}

export const charaCardV2Codec: {
  id: 'chara_card_v2';

  /** Structural shape test only; does not validate field values. */
  detect(input: unknown): boolean;

  /** Also accepts "flat V2 data" (no {spec,data} wrapper) per the detection trap
   *  documented above; callers that need strict-spec-only detection should check
   *  `isStrictlyWrapped(input)` before calling detect(). */
  isStrictlyWrapped(input: unknown): boolean;

  parse(input: unknown): {
    data: Character;
    escrow: Escrow;
    report: ParseReport;
  };

  serialize(
    character: Character,
    escrow: Escrow,
    options?: {
      includeRoleCallExtensions?: boolean; // default: true only if escrow has a rolecall namespace
      creatorNameOverride?: string;        // overrides identity.creator if set
      mirrorCharacterBookInExtensions?: boolean; // default: false; see OPEN QUESTION above
    }
  ): { json: CharaCardV2Json; report: SerializeReport };

  capabilities: Record<string, 'native' | 'escrow' | 'dropped'>;
};
```

## Edge cases & failure modes

1. **Flat V2 data (no wrapper).** Must be detected and parsed as V2 (see "Flat V2
   data" above), not silently degraded to V1. This is a permanent fixture
   requirement per escrow-and-roundtrip.md's "every past misdetection/parsing bug
   becomes a permanent fixture" rule.
2. **`data.character_book` vs `extensions.character_book` vs
   `extensions.character_books`.** All three locations may independently be present
   on the same card (observed in the wild across Chub.ai/ST vs RoleCall exports).
   Parse must check all three, dedup `data.character_book` against
   `extensions.character_book` by reference identity (not deep-equal, two
   independently-authored books with identical content are NOT deduped), and
   concatenate the result into however many Lorebook entities the canonical model
   ends up referencing. See parse-v2.ts:181-198.
3. **Position field lossy mapping.** `character_book` entry `position` only has two
   spec values (`before_char`, `after_char`); canonical `LorebookEntry.position` has
   six (`world`, `character`, `before_example`, `after_example`, `depth`, `scene`).
   Parsing `before_char` -> `world`, `after_char` -> `character`. Serializing
   canonical position values other than `world`/`character` (i.e. `before_example`,
   `after_example`, `depth`, `scene`) back to a two-value `position` field has no
   lossless answer; VAUDEVILLE's `toCharacterBook()` only emits `position` at all
   when the RC position is `character` or `world`/`scene` (character-book.ts:344-349)
   and otherwise omits the field, relying on `extensions.position` (the RC-native
   value) to carry the real value for round-trip through RC-aware readers. This
   codec should do the same: omit spec `position` for non-mappable values, always
   write the true value into `extensions.position`, and record an
   `escrowShadowed`-style note in the SerializeReport for foreign-format fidelity
   loss.
4. **`character_book.entries[].id` is not stable across round-trip.** VAUDEVILLE
   always re-numbers `id` by array index on serialize, discarding any original `id`
   value on parse. Fixture tests must not assert byte-identity or even
   canonical-json-identity on this specific field; declare `character_book` at
   `semantic` byte-identity level even if the rest of the card can achieve
   `canonical-json`.
5. **Three overlapping "creator notes" fields.** `data.creator_notes` (native, spec
   field), `extensions.rolecall.creator_notes` (escrow), `extensions.rolecall.creators_note`
   (escrow, note the singular "creators_note" vs "creator_notes", this is not a typo
   in this spec, both keys exist independently in VAUDEVILLE's shape, see
   serialize-v2.ts:116,117). Do not merge them. A round trip must preserve all three
   independently even though they often contain near-duplicate text.
6. **Missing required data fields on lenient parse.** The public spec lists these
   nine as part of the required `data` shape: name, description, personality,
   scenario, first_mes, mes_example, creator_notes, system_prompt,
   post_history_instructions (plus alternate_greetings, tags, creator,
   character_version, extensions as required-but-possibly-empty). `name` missing or
   non-string fails `detect()` outright (card is not V2). Every other listed string
   field missing defaults to `''` on lenient parse (matches VAUDEVILLE behavior);
   `--strict` CLI mode should warn (not error) when a spec-required field is absent
   from the source JSON, per escrow-and-roundtrip.md's report/warnings mechanism.
7. **`extensions` is itself missing from the source object.** The public spec marks
   `extensions` as a required object (default `{}`). Some real-world exports omit it
   entirely. Parse must tolerate this and treat as `{}`, not error.
8. **Regex-looking key that isn't meant as regex.** `character_book` entry
   `use_regex: false` but a key literally looks like `/foo/i` (e.g., user typed a
   literal slash-wrapped string as a keyword). Per `parseRegexKeyword()`
   (character-book.ts:262-270), the codec detects the `/…/flags` shape regardless of
   the `use_regex` entry flag and treats it as regex UNLESS `use_regex` on the entry
   forces it to true anyway (in which case the flag is moot), there is no way in
   this parsing scheme to represent a literal keyword string that happens to look
   like `/foo/i` without it being reinterpreted as regex. OPEN QUESTION: is this
   accepted lossy behavior to carry forward, or should the canonical parser preserve
   a literal flag to avoid the ambiguity? VAUDEVILLE accepts the ambiguity; flag for
   Chi review before locking capabilities matrix to "native" for this sub-case (mark
   trigger-parsing capability as "native (lossy: literal /slash/ text
   misinterpreted as regex)").
9. **`spec_version` other than `"2.0"`.** No VAUDEVILLE code branches on
   `spec_version` value at all (only `spec === 'chara_card_v2'` is checked). This
   codec should accept any `spec_version` string and store the raw value in
   `meta.origin.version`; it must not reject a card for having, e.g., `"2.1"`.
10. **`alternate_greetings` entries that are objects, not strings.** The parser type
    signature (`ParsedCharacter.alternate_greetings`) allows
    `Array<string | {text, title?}>`, but the actual V2 JSON field per spec is
    `string[]`. In practice this only happens via RoleCall's own internal
    `character.alternate_greetings` value being pre-normalized before it reaches the
    V2 serializer (serialize-v2.ts:189-190 `normalizeGreeting`); a RAW V2 JSON file
    read from disk should never contain object-shaped greetings, only strings. If one
    is encountered anyway (malformed/foreign export), treat entries that are
    `{text: string}` shaped objects as if they were `text` (defensive parse), and put
    a warning in the ParseReport.
11. **Exact canonical field paths for `tagline`, `details`, `content_rating`.**
    canonical-model.md names these as part of the RoleCall-native canonical Character
    surface but does not give exact TypeScript field paths (it is described as a
    "hand-written skeleton"). This spec uses `identity.tagline`, `identity.details`,
    `identity.contentRating` as placeholder paths for the field-map table above.
    OPEN QUESTION: confirm the exact canonical field paths (and whether they live
    under `identity`, a separate `presentation` group, or their own top-level group)
    against `packages/core`'s actual zod schema once it exists, and against
    rolecall-character.md once written; update this table's "Canonical field" column
    to match without changing the native/escrow classification.

## Test plan

- Fixtures required (place under `fixtures/chara-card-v2/`):
  - `minimal.json`, only the nine required string fields + empty arrays/extensions;
    exercises default-filling on parse and round-trip of empties.
  - `full-spec-compliant.json`, every public-spec field populated, `character_book`
    at `data.character_book` (spec-compliant location), no RoleCall extensions;
    exercises a "foreign card" parse/serialize with no `rolecall` namespace and
    verifies this codec does not synthesize one.
  - `rolecall-export.json`, a real RoleCall V2 export with `extensions.rolecall`
    fully populated (tagline, genre, details, recommendations, trackerPreset,
    alternate_greeting_titles) and `extensions.character_book`; exercises the full
    field map table above end to end.
  - `flat-v2-no-wrapper.json`, a bare `data`-shaped object with no `spec`/`data`
    wrapper (the SillyTavern/RC PNG export convention); exercises edge case 1.
  - `dual-character-book.json`, both `data.character_book` and
    `extensions.character_book` present as distinct objects (not the same
    reference); exercises edge case 2's non-dedup branch.
  - `character-books-array.json`, `extensions.character_books` (plural, array of 2+)
    with no singular `character_book`; exercises the RoleCall multi-lorebook
    extension.
  - `three-creator-notes.json`, `data.creator_notes`, `rolecall.creator_notes`, and
    `rolecall.creators_note` all present with different text; exercises edge case 5.
  - `foreign-extensions-passthrough.json`, `extensions.talkativeness`,
    `extensions.fav`, `extensions.depth_prompt`, and an unrecognized third-party
    namespace key all present with no `rolecall` block; exercises escrow passthrough
    per canonical-model.md rule 4.
  - `regex-lookalike-keys.json`, a character_book entry with `use_regex: false` and
    a key literally `"/foo/i"`; exercises edge case 8.
  - `missing-extensions-object.json`, valid V2 card with `data.extensions` entirely
    absent; exercises edge case 7.
  - `position-nonstandard.json`, embedded lorebook entry authored in RC with
    `position: 'depth'` (via `extensions.position` on a from-RC export), serialized
    to V2, then re-parsed; exercises edge case 3's lossy-then-recovered path when
    re-imported by an RC-aware reader vs. the honest degradation for a
    non-RC-aware reader.

- Round-Trip Law applicability: full applicability for this format. Declare
  byte-identity level `canonical-json` for the top-level card, EXCEPT
  `character_book.entries[].id` which must be excluded from the equality check or the
  whole `character_book` block declared `semantic` (see edge case 4), pick whichever
  the fixture harness supports; if the harness cannot exclude a single field, declare
  the entire format `semantic`.
- Property/unit tests beyond fixtures:
  - `detect()` returns false for a V1 card, a V3 card (`spec: 'chara_card_v3'`), and
    a Backyard.ai export.
  - `isFlatV2Data`-equivalent detection returns false for an object with `name` only
    and none of the V2-distinguishing fields (i.e. correctly stays classified as V1,
    not misclassified upward).
  - Serializing a canonical Character parsed from a foreign format (e.g. a Backyard
    card) into V2 produces `extensions.rolecall` absent (no RC branding synthesized
    from nothing).
  - `character_version` round-trips the parsed value unless overridden (see
    serialization OPEN QUESTION, write the test to lock in whichever answer Chi
    picks).

## Non-goals

- V1 (`chara_card_v1`) parsing/serialization is not part of this spec; VAUDEVILLE
  bundles a V1 fallback in the same file for convenience but this codec's contract is
  V2 only. A V1 codec, if wanted, gets its own spec.
- V3 (`chara_card_v3`) additions (assets, nickname, multilingual notes, source,
  group_only_greetings, entry decorators) are out of scope; see chara-card-v3.md.
- Backyard.ai's own native export shape is out of scope; see backyard.md. This spec
  only notes that V2 detection must not false-positive on a Backyard card.
- `.charx` zip packaging is out of scope; see charx.md.
- PNG `tEXt` chunk reading/writing (base64 encode/decode, keyword selection) is out of
  scope; see png-embedding.md. This spec assumes it is handed already-decoded JSON.
- Deep semantic validation of `character_book` trigger/position/recursion runtime
  behavior (what a lorebook engine does with these values at chat time) is out of
  scope; see specs/engine/lorebook-engine.md.
- RoleCall-native `rcpersona` format (a different, non-chara_card_v2 PNG keyword and
  JSON shape) is out of scope; see rolecall-character.md. This spec only documents
  the `extensions.rolecall` namespace as it appears embedded inside a V2 card.

## Sources consulted

- `<RoleCall>\apps\rc\src\lib\formats\character\parse-v2.ts`
  (full file read; key lines: 22-68 `ParsedCharacter`, 96-106 `isV1Card`, 112-121
  `isV2Card`, 127-145 `CharacterCardV3`/`isV3Card`, 151-167 `parseV1`, 169-267
  `parseV2`, 269-285 `parseV3`, 291-311 `isFlatV2Data`, 316-391
  `parseCharacterJson`, 474-482 `detectFormat`).
- `<RoleCall>\apps\rc\src\lib\formats\character\serialize-v2.ts`
  (full file read; key lines: 23-52 `CharacterCardV2`/`CharacterCardV2Data`, 87-139
  `CharacterCardV2Extensions` incl. `rolecall` sub-shape, 148-260 `serializeToV2`,
  330-350 `isValidV2Card`).
- `<RoleCall>\apps\rc\src\lib\formats\character\character-book.ts`
  (full file read; key lines: 19-58 `CharacterBookEntry`/`CharacterBook`, 262-270
  `parseRegexKeyword`, 318-422 `toCharacterBook`, 459-558 `fromCharacterBook`,
  564-598 `mergeCharacterBooks`).
- Public chara_card_v2 spec: github.com/malfoyslastname/character-card-spec-v2,
  fetched via WebFetch during this session (2026-07-02); confirmed top-level shape
  (`spec`/`spec_version`/`data`), the nine `data`-level scalar fields plus
  `alternate_greetings`/`tags`/`creator`/`character_version`/`character_book`/
  `extensions`, the `character_book` sub-object shape (`name`, `description`,
  `scan_depth`, `token_budget`, `recursive_scanning`, `extensions`, `entries[]`),
  the entry shape (`keys`, `content`, `extensions`, `enabled`, `insertion_order`,
  `case_sensitive`, `name`, `priority`, `id`, `comment`, `selective`,
  `secondary_keys`, `constant`, `position`), the V1-compatibility note, and the
  `extensions` namespacing convention.
- `docs\00-MASTER-PLAN.md`,
  `docs\02-ARCHITECTURE.md`, `docs\06-PRODUCTION-BIBLE.md` (brief row for this file),
  `specs\formats\canonical-model.md`, `specs\formats\escrow-and-roundtrip.md`,
  `templates\SPEC-TEMPLATE.md`, read in full for conventions and the canonical
  model / escrow rules this spec must conform to.
