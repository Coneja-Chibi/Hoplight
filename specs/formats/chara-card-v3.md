# Spec: Character Card V3 Codec

**Package:** `packages/formats` (module `character/chara-card-v3`) · **Milestone:** M1
**Status:** draft
**Depends on:** `specs/formats/canonical-model.md`, `specs/formats/escrow-and-roundtrip.md`,
`specs/formats/chara-card-v2.md` (V3 is a strict superset of V2 and this codec
delegates its V2-shaped fields to the V2 codec's field map; that spec file does
not exist yet in this suite: see OPEN QUESTION 1)
**VAUDEVILLE reference:** `apps/rc/src/lib/formats/character/serialize-v3.ts`,
`apps/rc/src/lib/formats/character/parse-v2.ts` (`parseV3`, `isV3Card`),
`apps/rc/src/lib/library/png-parser.ts` (:62-127), `apps/rc/src/lib/formats/character/character-book.ts`,
`apps/rc/src/lib/sprites/types.ts` (:289 `spritesToV3Assets`, :310 `v3AssetsToSprites`)

## Purpose

This codec converts between the canonical `Character` entity (and its
referenced `Lorebook`, see `canonical-model.md`) and the Character Card V3
JSON format (`chara_card_v3`, `spec_version: "3.0"`), as published at
https://github.com/kwaroran/character-card-spec-v3 (`SPEC_V3.md`). V3 is
consumed by SillyTavern, Risu, Chub.ai, and other community tools; it is the
current de facto interchange format for character cards, superseding V2. This
spec covers the JSON shape only. PNG tEXt-chunk embedding (the `ccv3` keyword
and its precedence over `chara`) is covered in `specs/formats/png-embedding.md`;
this spec references it but does not restate it.

A V3 card's `data` object is a strict superset of a V2 card's `data` object:
every V2 field is present unchanged, plus V3 additions. Consequently this
codec's parse/serialize functions build on top of the V2 codec's field
handling rather than reimplementing it (mirrors VAUDEVILLE's `parseV3` calling
`parseV2` internally, and `serializeToV3` calling `serializeToV2` internally :
`parse-v2.ts:269-285`, `serialize-v3.ts:129-130`).

## Behavior

### Root shape

```json
{
  "spec": "chara_card_v3",
  "spec_version": "3.0",
  "data": { ... }
}
```

Detection: an object is a V3 card iff `obj.spec === "chara_card_v3"`
(VAUDEVILLE `parse-v2.ts:141-145`, `isV3Card`). VAUDEVILLE's detector does not
additionally require `data` to be present or `spec_version` to equal `"3.0"`
at the detection stage: required-field validation happens during parse.
Per the public spec, `spec_version` is parsed as a float for comparison;
newer minor/patch versions (e.g. `"3.1"`) should still import, with a
version-mismatch warning, rather than being rejected. This codec follows that
rule: unknown `spec_version` values produce a `warnings` entry, not a parse
failure.

### Field map

Column "Native/Escrow/Dropped" states this codec's capability for the field
on **parse into canonical** and **serialize from canonical**, per
`escrow-and-roundtrip.md`'s capabilities matrix.

#### V2-inherited fields (unchanged from V2; see chara-card-v2.md for full detail)

| V3 `data` field | Canonical field | Native/Escrow/Dropped | Notes |
|---|---|---|---|
| `name` | `identity.name` | native | Required string. |
| `description` | `description` | native | |
| `personality` | `personality` | native | |
| `scenario` | `scenario` | native | |
| `first_mes` | `firstMessage` | native | |
| `mes_example` | `exampleDialogue` | native | |
| `creator_notes` | `presentation.creatorNotes` | native | See V3 addition `creator_notes_multilingual` below: when that field is present, `creator_notes` is its `en` fallback, not an independent value: see Edge case 1. |
| `system_prompt` | `systemPrompt` | native | |
| `post_history_instructions` | `postHistoryInstructions` | native | |
| `alternate_greetings[]` | `alternateGreetings[]` | native | VAUDEVILLE additionally merges an `extensions.rolecall.alternate_greeting_titles[]` array positionally onto each greeting to recover a title (`parse-v2.ts:230-245`). This is an RC-native extension, not part of the public V3 spec; canonical model does not have a "greeting title" field today: escrow it under `escrow.rolecall.fields["alternate_greeting_titles"]` until canonical model grows one (OPEN QUESTION 2). |
| `tags[]` | `presentation.tags[]` | native | |
| `creator` | `presentation.creator` | native | |
| `character_version` | `presentation.characterVersion` | native | |
| `extensions` (object) | `escrow` (non-claimed keys) + specific canonical fields for claimed keys | escrow (bulk) / native (claimed subkeys) | See "Extensions handling" below. |

#### V3 additions

| V3 `data` field | Type | Canonical field | Native/Escrow/Dropped | Notes |
|---|---|---|---|---|
| `character_book` | `Lorebook` object, optional | reference to canonical `Lorebook` entity (`character.lorebookRef`, per canonical-model.md rule 3) | native | Promoted from `data.character_book` at the V3 top level. VAUDEVILLE's V2 codec also reads `extensions.character_book` and `extensions.character_books[]` as compatibility locations (`parse-v2.ts:181-197`); on V3 parse, `parseV3` additionally checks `data.character_book` and de-duplicates by lorebook `name` against what V2 parsing already found (`parse-v2.ts:274-282`). Entry-level field map lives in `specs/formats/st-worldinfo.md` / `canonical-model.md`'s Lorebook section, since `character_book` entries use the same `LoreEntry` shape as world-info files. If more than one embedded lorebook is present, this codec's serializer merges them into a single `character_book` on output (VAUDEVILLE `mergeCharacterBooks`, `character-book.ts:564-598`) because the V3 spec supports exactly one; escrow records how many were merged and their original names so a re-export to a format that supports multiple (e.g. RC-native) can split them back. |
| `assets[]` | array of `{type, uri, name, ext}`, optional | `presentation.assets[]` (typed reference array; binary payload handling per canonical-model.md "Open items") | native for the array shape and `type`/`name`/`ext`; `uri` handling depends on scheme (see Edge case 2) | `type` is `"icon" \| "background" \| "emotion" \| "user_icon" \| "system_icon"` or an `x_`-prefixed custom type per the public spec (VAUDEVILLE's local type union at `serialize-v3.ts:25` is narrower: `icon\|background\|user_icon\|system_icon\|string`: effectively `string` covers custom/emotion at the TS level but VAUDEVILLE never emits `emotion` itself). `name: "main"` designates the primary icon/background per the public spec; VAUDEVILLE does not special-case this on parse. VAUDEVILLE populates `assets` on serialize from an explicit `options.assets` array plus RC sprites converted via `spritesToV3Assets` (`serialize-v3.ts:132-145`, `sprites/types.ts:289-303`), and reverses that on import via `v3AssetsToSprites` (`sprites/types.ts:310-322`): sprites of type `main/expression/outfit/pose/background` round-trip through assets; other RC sprite types are dropped by that reverse mapping today. |
| `nickname` | string, optional | `identity.nickname` | dropped (VAUDEVILLE) | Not read or written anywhere in VAUDEVILLE's V2/V3 codec paths (confirmed by search of `apps/rc/src/lib`: no `nickname` handling in the character format code). This codec should treat it as native (round-trip via escrow at minimum) since it is a first-class public V3 field; canonical model needs an `identity.nickname` field (OPEN QUESTION 3). Until added, park it in `escrow.chara_card_v3.fields.nickname`. |
| `creator_notes_multilingual` | object, optional (`Record<ISO-639-1, string>`) | `presentation.creatorNotesMultilingual` (new) | dropped (VAUDEVILLE) | Not implemented in VAUDEVILLE. Per public spec, when present it supersedes `creator_notes` and the `en` key is the fallback value for `creator_notes`-only readers. Canonical model has no multilingual field yet (OPEN QUESTION 3); escrow whole object under `escrow.chara_card_v3.fields.creator_notes_multilingual` for now. |
| `source[]` | array of strings, optional | `meta.source[]` (append-only provenance list, not part of `data` payload: see canonical-model.md `meta`) | escrow (VAUDEVILLE emits it, does not parse it back) | VAUDEVILLE's serializer writes `source: [{name: creatorName}]` (`serialize-v3.ts:178-180`): note this is an array of **objects** with a `name` field, not an array of plain strings as the public spec's `SPEC_V3.md` text describes ("Array of the ID or HTTP/HTTPS URL"). This is a divergence: either VAUDEVILLE's shape is wrong relative to spec, or the community has settled on object-shaped source entries in practice. Flag as OPEN QUESTION 4 rather than silently picking one; this codec's fixtures must include both shapes and this codec's parser must accept both (string entries and `{name, url?}` entries) defensively, escrowing whichever shape was found so it round-trips byte-for-shape. Per spec, `source` is append-only and not user-editable: an editing surface must never let a user delete entries, only add.
| `group_only_greetings[]` | array of strings, **required** (may be empty) | `groupOnlyGreetings[]` | native | VAUDEVILLE always serializes this as `[]` (`serialize-v3.ts:171`) and never reads it back on parse (`parseV3` delegates to `parseV2`, which has no knowledge of this field). This codec must both read and write it; canonical model needs a `groupOnlyGreetings[]` array parallel to `alternateGreetings[]` (OPEN QUESTION 3). |
| `creation_date` | number (unix seconds), optional | `meta.importedAt`-adjacent: actually maps to a new `meta.sourceCreatedAt` (creation date reported by the *source* card, distinct from `Entity.meta.importedAt` which is when Vaudeville imported it) | native | VAUDEVILLE derives this from its own DB `created_at` on serialize (`serialize-v3.ts:172-174`, converts ISO string to unix seconds via `Math.floor(...getTime()/1000)`). On parse this codec should read it into canonical rather than discard it (VAUDEVILLE's `parseV2`/`parseV3` do not currently read `creation_date` back at all). |
| `modification_date` | number (unix seconds), optional | `meta.sourceModifiedAt` (new field, parallel reasoning to above) | native | Same divergence as `creation_date`: VAUDEVILLE writes on serialize (`serialize-v3.ts:175-177`) but does not parse it back. Per the public spec this is meant to be updated on every export/modification, non-user-editable. |

#### Extensions handling

`data.extensions` is a free-form object. Per `escrow-and-roundtrip.md` rule 4,
unclaimed keys pass through untouched inside escrow. VAUDEVILLE's own
extension namespace is `extensions.rolecall` (full field list documented in
`specs/formats/rolecall-character.md`); this codec claims that namespace and
maps its subfields to canonical (tagline, genre, fandom, nsfw, content_rating,
source_url, loadout, recommendations: see that spec for detail) and escrows
every other top-level extensions key by name
(`escrow.chara_card_v3.fields.extensions["<key>"]`), e.g. `talkativeness`,
`depth_prompt`, `fav`, `regex_scripts`, `linkedRegexScripts` (VAUDEVILLE
comment confirms these specific foreign-extension keys are preserved for
round-trip: `parse-v2.ts:63-67`).

Note: `character_book` and `character_books` inside `extensions` are V2-era
compatibility locations (see V2 spec); on V3 parse this codec must strip
those two keys from the passthrough-extensions blob before escrowing the
rest, matching VAUDEVILLE's `serialize-v3.ts:148,164` (`const {
character_book, character_books, ...restExtensions } = v2.data.extensions`).
Otherwise a V2->V3 round trip would duplicate the lorebook reference both as
`data.character_book` and inside `data.extensions.character_book`.

### Byte-identity level

`semantic` (per `escrow-and-roundtrip.md`'s three-tier scale). JSON key order
and whitespace are not preserved; VAUDEVILLE's serializer always emits
`JSON.stringify(card, null, 2)` (`serialize-v3.ts:205`) with a fixed key
order determined by object construction order, which will differ from an
arbitrary source card's key order. Round-trip proof is via re-parse and deep
equality of canonical + escrow, not byte diff.

### V2 <-> V3 relationship, precisely

1. **Detection precedence.** When both a V2-shaped and V3-shaped
   representation could apply to the same JSON object (this happens inside a
   single PNG that embeds both `chara` and `ccv3` chunks), V3 wins. This is a
   PNG-layer concern (`png-embedding.md`) but the JSON-level codec also tries
   V3 detection before V2 detection when classifying a bare JSON file
   (VAUDEVILLE `parseCharacterJson`, `parse-v2.ts:320-328` runs `isV3Card`
   before `isV2Card`).
2. **Upgrading V2 -> V3.** Every V2 canonical Character can serialize to V3
   with no data loss: V3 is a strict superset. `assets`, `group_only_greetings`
   default to `[]`; `character_book` (if the V2 card had one via `extensions`)
   is promoted to the `data` top level.
3. **Downgrading V3 -> V2.** V3-only fields (`assets`, `nickname`,
   `creator_notes_multilingual`, `source`, `group_only_greetings`,
   `creation_date`, `modification_date`) have no home in V2's `data` shape.
   Per `escrow-and-roundtrip.md` rule 3 (serialize to a foreign format),
   express what V2 can express and carry the rest inside
   `data.extensions.vaudeville.escrow`. The public spec's own guidance (from
   `SPEC_V3.md`) is that on-downgrade a V2 consumer loading a V3-authored
   card should get a `creator_notes` warning banner
   ("This character card is Character Card V3, but it is loaded as a
   Character Card V2..."): VAUDEVILLE does not currently implement this
   banner-injection behavior anywhere found in the character format code;
   OPEN QUESTION 5 covers whether this codec should replicate it.
4. **`character_book` promotion is one-directional in VAUDEVILLE today.**
   V2 serialize puts the lorebook inside `extensions.character_book`
   (see V2 spec); V3 serialize moves it to `data.character_book`
   (`serialize-v3.ts:147-167`). This codec's serializer must do the same
   promotion; its parser must accept `character_book` in either location
   regardless of the `spec` field, since real-world V2 cards from other tools
   (Chub.ai, SillyTavern exports) may already place it at `data.character_book`
   even under a `chara_card_v2` spec tag, and VAUDEVILLE's own `parseV2`
   already checks both locations defensively (`parse-v2.ts:181-193`).

### Decorators on `character_book` entries

The public V3 spec (`SPEC_V3.md`, "Decorators" section, re-fetched and
quoted verbatim for this spec, not paraphrased: see "Sources consulted")
defines decorators as "a string that starts with `@@` and ends with a
newline. it can contain values that are separated by a comma." This lets a
single lorebook entry carry positioning/activation/scanning overrides without
dedicated JSON fields. The confirmed complete decorator list is:
`@@activate_only_after <n>`, `@@activate_only_every <n>`,
`@@keep_activate_after_match`, `@@dont_activate_after_match`, `@@depth <n>`,
`@@instruct_depth <n>`, `@@reverse_depth`, `@@reverse_instruct_depth`,
`@@role <assistant|system|user>`, `@@scan_depth <n>`,
`@@instruct_scan_depth <n>`, `@@is_greeting <n>`, `@@position <string>`,
`@@ignore_on_max_context`, `@@additional_keys <a,b,c>` (repeatable),
`@@exclude_keys <a,b,c>`, `@@is_user_icon <string>`, `@@dont_activate`,
`@@activate`, `@@disable_ui_prompt <string>`. Decorator lines must be
stripped from `content` before the text is injected into a prompt, and
multiple `@@` lines may stack at the start of an entry's content.
Confirmed: the spec text defines **no escape mechanism** for a literal
`@@`-prefixed line that is not intended as a decorator; Edge case 8's
heuristic (match only against the known decorator-name catalog) is this
codec's own defensive choice, not something the spec mandates.

**VAUDEVILLE does not implement decorators.** No occurrence of `@@` decorator
parsing was found in `apps/rc/src/lib/formats/character/character-book.ts`
or the lorebook engine. VAUDEVILLE's equivalent per-entry overrides
(`position`, `depth`, `role`, `scan_depth`, etc.) are expressed as explicit
`CharacterBookEntry.extensions` object keys (`character-book.ts:353-386`),
not inline `@@` text directives.

This codec's behavior: on parse, this codec must scan each entry's `content`
for leading `@@`-prefixed lines, per the public spec's grammar, and lift them
into the canonical `LorebookEntry`'s structured fields where a canonical
equivalent exists (depth, position, role, scan_depth, additional/exclude
keys, activation windowing), stripping them from the stored content. Any
decorator without a canonical equivalent (e.g. `@@is_user_icon`,
`@@ignore_on_max_context`, `@@disable_ui_prompt`) is escrowed per-entry as
`escrow.chara_card_v3.fields["entries[<index>].decorators"]` with the
original decorator lines verbatim, keyed by entry index (entries do not
reliably have stable ids in the wild: many sources use `id: undefined` or
sequential re-numbering: so index-at-parse-time is the addressing key, and
this codec must guarantee stable entry ordering between parse and serialize
for this to round-trip). On serialize back to V3, decorators are
regenerated as `@@`-prefixed lines prepended to `content` in a fixed,
documented order (canonical-derived decorators first, then escrowed
verbatim decorators), matching the spec's fallback-chain convention
(`@@@` triple-at prefix for compatibility fallbacks) only when re-emitting
an escrowed fallback chain verbatim: this codec does not synthesize new
fallback chains.

OPEN QUESTION 6: whether decorator parsing belongs in this codec (JSON/text
layer) or in the lorebook engine (`specs/engine/lorebook-engine.md`), since
decorators affect activation/injection semantics that the lorebook engine
owns. Recommendation for the reviewer: decorator *parsing/stripping* belongs
here (it's format-specific text surgery on import/export); decorator
*semantics* (what `@@activate_only_after` does at match time) belongs in the
lorebook engine spec, which should cross-reference this section rather than
duplicate the decorator catalog.

### CBS macro tokens introduced/used by V3

The public spec defines `{{random:A,B,C}}`, `{{pick:A,B,C}}`, `{{roll:N}}`,
`{{// A}}`, `{{hidden_key:A}}`, `{{comment:A}}`, `{{reverse:A}}` as part of
the V3 "curly braced syntax" contract, plus `{{char}}` resolving to
`nickname` (falling back to `name`) rather than always `name`. These are
**not** this codec's concern to evaluate: macro evaluation lives in
`specs/engine/macro-engine.md`.
This codec's only obligation is to preserve macro text verbatim inside
`description`/`personality`/etc. (it already does, since those are plain
string fields) and to note in that spec's "which macros the studio evaluates"
section that `{{char}}`'s V3 nickname-aware resolution depends on this
codec's `nickname` field being parsed into canonical (currently dropped :
see field map above).

## Public API sketch

```ts
// packages/formats/src/character/chara-card-v3.ts

import type { Character, Escrow, ParseReport, SerializeReport } from '@vaudeville/core';

export interface CharaCardV3Asset {
  // "icon" | "background" | "emotion" | "user_icon" per the public spec,
  // plus "system_icon" and arbitrary strings per VAUDEVILLE's serializer
  // (VAUDEVILLE's own union is narrower than the public spec's: it never
  // emits "emotion"; see the assets field-map row for the full citation).
  type: 'icon' | 'background' | 'emotion' | 'user_icon' | 'system_icon' | string; // x_ prefixed custom types allowed per public spec
  uri: string; // http(s) URL | data: URI | embeded://path | "ccdefault:"
  name: string;
  ext: string; // lowercase, or "unknown"
}

export interface CharaCardV3Json {
  spec: 'chara_card_v3';
  spec_version: string; // compared as float; "3.0" expected, forward-compatible
  data: CharaCardV3Data;
}

// CharaCardV3Data intentionally not re-exported in full here: see the V2 codec
// spec for the inherited shape. This module imports CharaCardV2Data and
// extends it, it does not redeclare it.

// Escrow travels with the entity per canonical-model.md's Entity<T> envelope
// and escrow-and-roundtrip.md rule 2 ("escrowed fields merge back into their
// original locations... this is what makes the Law hold"). This codec never
// mints an Entity id or hash (core's job, per canonical-model.md: "id...
// assigned on first parse" by the caller that owns entity identity) so it
// works in terms of the bare { data, escrow } pair, not a full Entity<T>.
export interface CodecResult<T> {
  data: T;
  escrow: Escrow; // see escrow-and-roundtrip.md's Escrow envelope shape
}

export function detectCharaCardV3(json: unknown): json is CharaCardV3Json;

export function parseCharaCardV3(
  json: CharaCardV3Json
): { result: CodecResult<Character>; report: ParseReport };

export function serializeCharaCardV3(
  input: CodecResult<Character>,
  options?: {
    creatorName?: string;
    assets?: CharaCardV3Asset[];
    includeGroupOnlyGreetings?: boolean; // default true
  }
): { json: CharaCardV3Json; report: SerializeReport };

// Capabilities matrix consumed by the docs-site format-support generator
// (escrow-and-roundtrip.md's "Capabilities matrix" rule).
export const capabilities: Record<string, 'native' | 'escrow' | 'dropped'>;
```

## Edge cases & failure modes

1. **`creator_notes` vs `creator_notes_multilingual` conflict.** Per the
   public spec, when `creator_notes_multilingual` is present, `creator_notes`
   is defined as its `en`-key fallback and should not be treated as an
   independently authored value. This codec's parser must not silently
   overwrite an edited `creator_notes` with a stale multilingual `en` entry
   on re-serialize; treat `creator_notes_multilingual.en` as the single
   source of truth for the flattened field whenever the multilingual object
   is present, and warn if the two disagree at parse time (indicates the
   source tool desynced them).
2. **`assets[].uri` scheme variety.** Four documented schemes exist:
   `http(s)://`, `data:` base64, `embeded://path/to/asset` (referring to a
   file bundled alongside the card, e.g. inside a `.charx` zip: see
   `specs/formats/charx.md`), and the literal string `"ccdefault:"` (meaning
   "use the card's own embedded PNG image as this asset"). A bare JSON V3
   card (not inside a `.charx` or PNG) cannot resolve `embeded://` or
   `ccdefault:` references to actual bytes; this codec must preserve the URI
   string as-is in canonical (native for the string, not the referenced
   bytes) and let the PNG/charx codec layer resolve actual asset bytes at
   the container level.
3. **Duplicate `name: "main"` assets.** Spec says `name: "main"` designates
   the primary icon/background per `type`. Nothing in the spec prevents two
   assets of the same `type` both claiming `name: "main"`. This codec must
   not deduplicate or reorder assets on parse (preserve source order and all
   entries, even apparent duplicates): that is an authoring-tool bug, not
   this codec's problem to fix, and silently dropping one would violate the
   Round-Trip Law.
4. **`source[]` shape ambiguity** (string vs `{name, url?}` object): see
   field map row above and OPEN QUESTION 4. Parser must accept both; if a
   fixture reveals a third shape in the wild, add it and update this spec
   before merging.
5. **Missing required `group_only_greetings`.** Spec marks this field
   required (may be an empty array, but the key must exist). A card claiming
   `spec_version: "3.0"` without this key is spec-noncompliant. This codec's
   parser must not error on absence: treat as `[]` and add a
   `warnings` entry (`"group_only_greetings missing, defaulted to []"`), since
   real-world producer bugs (including VAUDEVILLE's own historical output,
   before this codec exists) are common and rejecting the file would be
   user-hostile.
6. **`spec_version` other than `"3.0"`.** Parse as float; if greater than the
   highest version this codec knows about, import anyway with a `warnings`
   entry noting unknown fields may exist beyond this spec's field map (they
   land in escrow automatically since they're unclaimed extension/data keys,
   but note per spec V3's `data` object is NOT itself extensible the way
   `extensions` is; an unrecognized top-level `data` key from a hypothetical
   V3.1 must still be escrowed as `escrow.chara_card_v3.fields["<key>"]`
   rather than silently dropped, per the Round-Trip Law's "nothing is
   dropped, ever, at parse time" rule).
7. **Two embedded lorebooks colliding on merge.** When both
   `data.character_book` and a legacy `extensions.character_book` are
   present and non-identical (a malformed or hand-edited card), VAUDEVILLE's
   `parseV3` de-duplicates only by lorebook `name` equality
   (`parse-v2.ts:277-279`): two lorebooks with the same name but different
   entries would silently keep only the first. This codec must instead keep
   both as separate canonical `Lorebook` references and record a `warnings`
   entry, deferring "what a same-named different-content pair means" to the
   user/agent rather than guessing.
8. **Decorator lines that also look like ordinary content.** A user-authored
   entry might legitimately start a line with literal `@@` (e.g. quoting
   a decorator syntax in prose, or a stylized bullet). The public spec
   doesn't define an escape mechanism. This codec's decorator scanner should
   only treat a line as a decorator if it matches
   `^@@[a-z_]+(\s|$)` against the known decorator-name catalog (see
   "Sources consulted" for the full catalog fetched from the public spec);
   unrecognized `@@word` sequences are left in `content` untouched and NOT
   escrowed as decorators, to avoid corrupting legitimate prose. This is a
   best-effort heuristic on this codec's part, not something the spec
   mandates: confirmed per the "Decorators on character_book entries"
   section above, the spec itself defines no escape mechanism, so any line
   starting with a recognized decorator name IS treated as a decorator with
   no way for source content to opt out.
9. **`nickname` round-trip through V2 downgrade.** If a V3 card has
   `nickname` set and is downgraded to V2 for a V2-only target, `{{char}}`
   resolution semantics change (V2 has no nickname concept, so `{{char}}`
   always resolves to `name` in V2-consuming tools). This is a lossy,
   spec-inherent limitation, not a bug in this codec; record it in the
   `SerializeReport` as a `warnings` entry when nickname is non-empty and
   the target is V2.

## Test plan

Fixtures required (place under `fixtures/chara-card-v3/`):

- `minimal.json`: smallest valid V3 card: `spec`, `spec_version`, and only
  the fields the public spec marks required (`name`, `description`,
  `personality`, `scenario`, `first_mes`, `mes_example`, `creator_notes`,
  `system_prompt`, `post_history_instructions`, `alternate_greetings`,
  `tags`, `creator`, `character_version`, `extensions`, `assets`,
  `group_only_greetings`). Exercises the base parse/serialize path.
- `full-fields.json`: every documented V3 field populated, including
  `nickname`, `creator_notes_multilingual` (2+ languages), `source` (both
  string-array and object-array variants, one fixture each:
  `full-fields-source-strings.json` / `full-fields-source-objects.json`),
  `creation_date`, `modification_date`, multiple `assets` with each of the
  four URI schemes.
- `embedded-character-book.json`: single `character_book` at `data` level
  with 3+ entries exercising `use_regex`, `selective`/`secondary_keys`,
  `case_sensitive`, `position`.
- `embedded-character-book-decorators.json`: entries whose `content`
  contains stacked `@@` decorator lines (at least one from each decorator
  category: activation, positioning, scanning, context) plus one fallback
  chain using `@@@`.
- `legacy-character-book-location.json`: a V3-tagged card that places the
  lorebook at `extensions.character_book` instead of `data.character_book`
  (real-world malformed/hand-edited case per Edge case 7).
- `two-embedded-lorebooks-same-name.json`: Edge case 7 regression fixture.
- `v2-upgrade-source.json`: a valid V2 card (paired with the V2 codec's own
  fixture of the same name) used to test the V2->V3 upgrade path
  (Behavior section, "V2 <-> V3 relationship" item 2).
- `rolecall-native-export.json`: a real card as produced by
  `apps/rc/src/lib/formats/character/serialize-v3.ts` today (captured via a
  live RC export, sanitized), to lock in current VAUDEVILLE producer
  behavior as a regression fixture (including its `source: [{name}]` object
  shape and always-empty `group_only_greetings`).
- `unknown-spec-version.json`: `spec_version: "3.7"` with one unrecognized
  top-level `data` key, to exercise Edge case 6.
- `missing-group-only-greetings.json`: spec-noncompliant card missing that
  required key, to exercise Edge case 5.

Each fixture folder contains the input file, `expected.json` (canonical +
escrow), and `notes.md` per `escrow-and-roundtrip.md`'s fixture corpus rules.

Round-Trip Law applicability: full applicability, `semantic` byte-identity
level. Every fixture above must satisfy
`serialize(parse(F), 'chara_card_v3')` re-parsing to a deep-equal canonical
entity and escrow. `v2-upgrade-source.json` additionally proves the
`V2 -> parse -> canonical -> serialize(V3) -> parse -> canonical` chain is
also stable (upgrade is idempotent).

Property/unit tests beyond fixtures:

- Property: for any generated canonical `Character` with a random subset of
  optional fields populated, `parse(serialize(x)) === x` (the inverse
  direction of the Round-Trip Law, guarding against the serializer emitting
  something the parser can't fully recover).
- Unit: decorator scanner correctly strips exactly the recognized decorator
  lines and leaves all other content byte-identical (Edge case 8).
- Unit: `source[]` shape-detection accepts both string and object-array
  forms and escrows the original shape marker so re-serialize reproduces the
  same shape it parsed (not a codec-chosen canonical shape).
- Unit: `capabilities` export has an entry for every field in the field-map
  tables above (a snapshot test per `escrow-and-roundtrip.md`'s capabilities
  matrix rule, so a field silently regressing from native to escrow/dropped
  is visible in review).

## Non-goals

- Does not implement `.charx` zip container handling (asset bytes behind
  `embeded://` URIs): that is `specs/formats/charx.md`.
- Does not implement PNG tEXt chunk read/write or the `ccv3`/`chara`
  keyword-precedence rule: that is `specs/formats/png-embedding.md`.
- Does not evaluate CBS macros (`{{random:...}}`, `{{roll:...}}`, etc.) :
  that is `specs/engine/macro-engine.md`. This codec only preserves macro
  text verbatim and parses `nickname` so the macro engine can resolve
  `{{char}}` correctly.
- Does not implement decorator *semantics* (what happens at match time) :
  only decorator *parsing/stripping/round-trip* at the JSON-text layer. See
  OPEN QUESTION 6.
- Does not implement Backyard/Faraday field mapping: `specs/formats/backyard.md`.
- Does not implement RoleCall-native `rcpersona` fields beyond the
  `extensions.rolecall` passthrough described above: full RC field map is
  `specs/formats/rolecall-character.md`.

## Open questions

- OPEN QUESTION 1: `specs/formats/chara-card-v2.md` does not exist yet in
  this suite at time of writing. This spec assumes it will define the base
  V2 field map this codec delegates to; if that spec's field names diverge
  from what's assumed here (canonical field paths like `identity.name`,
  `presentation.creatorNotes`), this spec's field-map table needs a
  reconciliation pass once that spec lands.
- OPEN QUESTION 2: canonical model has no field for a per-greeting "title"
  (VAUDEVILLE's `extensions.rolecall.alternate_greeting_titles[]`). Does
  canonical model grow `alternateGreetings: {text, title?}[]` (matching what
  VAUDEVILLE's own `ParsedCharacter.alternate_greetings` already normalizes
  to at `parse-v2.ts:38,231-245`), or stays `string[]` with titles escrowed?
- OPEN QUESTION 3: canonical model needs new fields for `nickname`,
  `creatorNotesMultilingual`, and `groupOnlyGreetings[]`: none exist today
  per `canonical-model.md`. Confirm naming/placement with whoever owns that
  spec before implementation tickets are cut.
- OPEN QUESTION 4: is `source[]` supposed to be `string[]` (per the public
  spec's prose) or `{name, url?}[]` (per VAUDEVILLE's actual serializer
  output)? Could not resolve from the fetched spec text alone; needs a check
  against real-world cards from Chub.ai/SillyTavern or a maintainer
  clarification on the character-card-spec-v3 repo.
- OPEN QUESTION 5: should this codec replicate the public spec's suggested
  V3->V2 downgrade warning banner text injected into `creator_notes`? Not
  implemented anywhere in VAUDEVILLE today. Needs a product decision (does
  Vaudeville Studios want this UX, or just an honest `SerializeReport`
  warning without mutating `creator_notes`?).
- OPEN QUESTION 6: decorator semantics ownership: this spec (format layer)
  vs. `specs/engine/lorebook-engine.md` (activation layer). Recommend the
  latter spec's author confirm the split proposed in "Decorators" above.
- OPEN QUESTION 7 (downgraded to a citation note, not a fact gap): the
  decorator catalog and grammar in this spec were confirmed against a second,
  targeted read of `SPEC_V3.md` requesting verbatim quotes (not a
  paraphrase), which confirmed the `@@`-prefix/newline-terminated grammar,
  the absence of any escape mechanism for a non-decorator `@@` line, the
  `@@@` triple-at fallback-chain rule, and the 20-item decorator list used
  above. Both reads came through a summarizing layer rather than raw source
  bytes, so a byte-exact
  quote from the source file was not verified byte-for-byte against the raw
  source. Residual risk is low, but anyone with direct
  `curl`/browser access to
  `https://raw.githubusercontent.com/kwaroran/character-card-spec-v3/main/SPEC_V3.md`
  should do one final byte-level diff against this spec's decorator list
  before writing the parser, specifically for argument syntax details (exact
  delimiter/quoting rules for `@@position`'s string value and
  `@@disable_ui_prompt`'s string value) that a summarizer could plausibly
  compress.

## Sources consulted

- VAUDEVILLE `apps/rc/src/lib/formats/character/serialize-v3.ts` (full file,
  lines 1-276): V3 type shape, asset assembly, character_book promotion,
  source/creation_date/modification_date serialization.
- VAUDEVILLE `apps/rc/src/lib/formats/character/parse-v2.ts` (full file,
  lines 1-483): V1/V2/V3/Backyard detection and parsing, flat-V2-PNG
  detection, `parseV3`'s delegation to `parseV2` and character_book
  de-duplication logic (lines 269-285).
- VAUDEVILLE `apps/rc/src/lib/library/png-parser.ts` (lines 1-127, 148-284):
  PNG tEXt chunk keyword precedence (`ccv3` > `chara` > `rcpersona` >
  `persona`), referenced but not restated (owned by png-embedding.md).
- VAUDEVILLE `apps/rc/src/lib/formats/character/character-book.ts` (full
  file, lines 1-599): `CharacterBook`/`CharacterBookEntry` shape,
  `toCharacterBook`/`fromCharacterBook` field mapping, `mergeCharacterBooks`.
- VAUDEVILLE `apps/rc/src/lib/sprites/types.ts` (lines 260-322):
  `spritesToV3Assets` / `v3AssetsToSprites` sprite-to-asset round-trip.
- Grep of `apps/rc/src/lib` for `multilingual|nickname|group_only_greetings|decorators`
  (21 files matched, none in the character/lorebook format code path) :
  used to confirm these V3 fields are not implemented in VAUDEVILLE today.
- Public spec: character-card-spec-v3 repository,
  `https://github.com/kwaroran/character-card-spec-v3`, specification file
  fetched from
  `https://raw.githubusercontent.com/kwaroran/character-card-spec-v3/main/SPEC_V3.md`
  (accessed 2026-07-02; content came through a summarizing layer: see OPEN
  QUESTION 7 for the verification caveat this creates).
  Covers root fields, V2-inherited/modified/added data fields, Lorebook and
  LoreEntry shape, decorator catalog, CBS macro tokens, V2 backward-
  compatibility guidance.
- `specs/formats/canonical-model.md` (this repo): shared `Entity<T>` envelope,
  Character canonical superset design rules, Lorebook baseline.
- `specs/formats/escrow-and-roundtrip.md` (this repo): Round-Trip Law,
  escrow envelope rules, capabilities matrix, fixture corpus rules.
- `docs/02-ARCHITECTURE.md` (this repo, lines 1-44): `packages/formats`
  package location and dependency rule.
