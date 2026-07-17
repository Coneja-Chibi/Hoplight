# Spec: RoleCall Character (rcpersona-adjacent native profile of chara_card_v2/v3)

**Package:** `packages/formats` · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/chara-card-v2.md, specs/formats/chara-card-v3.md,
specs/formats/png-embedding.md, specs/formats/personas.md,
specs/formats/rolecall-lorebook.md ·
**VAUDEVILLE reference:** `packages/types/src/character.ts` (:79 `CharacterCardDetails`,
:110 `Character`), `apps/rc/src/lib/content/types.ts` (:108 `CharacterContent`, :155
`CharacterDetails`, :179 `CharacterSprite`), `apps/rc/src/lib/formats/character/serialize-v2.ts`,
`apps/rc/src/lib/formats/character/serialize-v3.ts`, `apps/rc/src/lib/formats/character/parse-v2.ts`,
`apps/rc/src/lib/formats/png/writer.ts`, `apps/rc/src/lib/library/png-parser.ts`,
`apps/rc/src/lib/sprites/types.ts`, `packages/types/src/character-display.ts`

## Purpose

RoleCall does not have a wire-distinct "RC character" file format. It is a *profile*
of chara_card_v2 / chara_card_v3: RoleCall characters serialize as ordinary V2/V3
cards (PNG `chara`/`ccv3` tEXt chunks or bare JSON), and every RC-native field that
has no home in the base V2/V3 shape rides inside `data.extensions.rolecall`. This
spec is the codec's RC-native overlay: what goes into `extensions.rolecall`, how the
`details` casting-card JSONB and sprite array map to canonical fields, how content
rating and legacy import fallbacks (RoleOut) are handled, and a type/runtime
mismatch in VAUDEVILLE's V3 serializer that a conforming implementation must not
carry forward as an actual data-loss bug (see edge case 1).

This spec assumes the reader already has chara-card-v2.md / chara-card-v3.md /
png-embedding.md loaded - it does not re-derive the base spec_version handling, tEXt
chunk mechanics, or embedded-`character_book` promotion rules; it only adds the
RoleCall layer on top.

## Behavior

### 1. Wire shape: RC characters ARE V2/V3 cards

- On disk / in PNG, an RC character is `{ spec: "chara_card_v2" | "chara_card_v3",
  spec_version, data: {...} }` exactly as chara-card-v2.md/v3.md describe. There is
  no separate `rc_character` spec marker and no dedicated PNG keyword for characters.
  (VAUD: `serialize-v2.ts:232-234`, `serialize-v3.ts:159-161`.)
- V3 serialization is implemented as a wrapper over V2: `serializeToV3` calls
  `serializeToV2` first, then promotes `character_book` to the data level and adds
  `assets`/`group_only_greetings`/`creation_date`/`modification_date`/`source`.
  (VAUD: `serialize-v3.ts:130,147-181`.) A conforming implementation MUST NOT
  duplicate V2 field logic in the V3 path; derive V3 from V2 the same way.
- Parsing mirrors this: `parseV3` calls `parseV2` on the same `data` object, then
  additionally checks for a data-level `character_book`. (VAUD: `parse-v2.ts:269-285`.)
- PNG embedding uses the standard `chara` (V2) / `ccv3` (V3) tEXt keywords, written
  via `embedCharacterData` / `embedDualCharacterData`, which strip any prior
  `chara`/`ccv3` chunks before writing new ones. (VAUD: `formats/png/writer.ts:53-91,
  103-142`.) RC's own PNG exporter writes the flat V2 `data` payload directly into
  the `chara` chunk with no `{spec,data}` wrapper, for SillyTavern compatibility -
  the importer has a dedicated `isFlatV2Data` detector for this shape so RC's own
  exports round-trip instead of silently downgrading to V1. (VAUD: `parse-v2.ts:290-356`.)

### 2. Why "rcpersona" is NOT the character keyword

The PNG tEXt keyword `rcpersona` belongs to RoleCall's separate **Persona** content
type, not Character. `persona-export.ts` writes a chunk keyworded `rcpersona` whose
JSON payload is `{ spec: "rolecall_persona", data: {...} }` (VAUD:
`apps/rc/src/lib/exports/persona-export.ts:78-79`). Character export never writes
this keyword; it writes `chara`/`ccv3` only (VAUD: `formats/png/writer.ts:56`,
`serialize-v2.ts:233`, `serialize-v3.ts:160`). See specs/formats/personas.md for the
Persona codec proper.

However, `library/png-parser.ts` - a general-purpose, still-actively-used PNG text
extractor (imported by `imports/content-detector.ts`, `imports/persona-st.ts`, and
`app/api/import/bundle/route.ts`) - reads tEXt chunks with **keyword precedence
`ccv3` > `chara` > `rcpersona` > `persona`** (VAUD: `png-parser.ts:73-126`). This
precedence exists so that ONE reader can classify an arbitrary PNG regardless of
which content type produced it. When neither `ccv3` nor `chara` is present, the
reader falls through to `rcpersona` (a genuine RoleCall persona chunk) or `persona`
(a RoleOut-legacy chunk, see section 4) and - critically - **munges the persona
payload into character-shaped fields** (`name`, `description`, `personality`,
`scenario: ""`, `first_mes: ""`, ...) so downstream code that expects a
`ParsedCharacter` shape can consume it as a fallback (VAUD: `png-parser.ts:184-247`).
This is an import-side compatibility fallback, not a character export path. A
conforming `vaud` PNG character reader:

1. MUST look for `ccv3` first, then `chara`, exactly as chara-card-v3.md/v2.md specify.
2. MAY, as a fallback ONLY when no `ccv3`/`chara` chunk is present, also recognize
   `rcpersona` and `persona` chunks and offer to import them as a Persona entity
   (routing to the Persona codec) rather than silently reinterpreting persona
   content as a Character. Silently munging persona fields into character fields
   (as VAUDEVILLE's `png-parser.ts` does) is legacy behavior kept for compatibility
   with old RC import flows and MUST NOT be treated as the canonical mapping for new
   codec code - the canonical mapping for RoleCall personas lives in personas.md.

### 3. `CharacterContent` -> canonical `Character` field map

Base V2/V3 prompt-bearing fields (`name`, `description`, `personality`, `scenario`,
`first_mes`, `mes_example`, `system_prompt`, `post_history_instructions`,
`alternate_greetings`, `tags`, `creator`, `character_version`, `extensions`
pass-through, `character_book`) are covered by chara-card-v2.md / chara-card-v3.md
and are NOT repeated here except where RC changes their shape. RC-specific additions:

| VAUDEVILLE source field | Canonical field | V2 native/escrow/dropped | V3 native/escrow/dropped | Notes |
|---|---|---|---|---|
| `CharacterContent.tagline` | `identity.tagline` | native (`extensions.rolecall.tagline`) | native (`extensions.rolecall.tagline`) | Short one-line hook, distinct from `description`. Falls back to `character.tagline` when V2 `creator_notes` is empty on export (VAUD: `serialize-v2.ts:246-248`). |
| `CharacterContent.personality`/`scenario`/`first_mes`/`mes_example`/`system_prompt`/`post_history_instructions` | prompt-bearing fields (see canonical-model.md rule 1) | native (base V2 fields) | native (base V2 fields) | Unchanged from base card spec. |
| `CharacterContent.alternate_greetings` (`string \| {text, title?}`) | `alternateGreetings[]` (`{text, title?}`) | native: text -> `data.alternate_greetings[]` (string[]); title -> `extensions.rolecall.alternate_greeting_titles[]` (parallel array, `null` = no title) | native, same mechanism (RC ext block only; V3 base spec has no title concept) | VAUD: `serialize-v2.ts:188-199,220-221`; read side merges titles back in at `parse-v2.ts:230-245`. |
| `CharacterContent.genre` | `identity.genre` | native (`extensions.rolecall.genre`) | native (`extensions.rolecall.genre`) | |
| `CharacterContent.fandom` | `identity.fandom` | native (`extensions.rolecall.fandom`) | native (`extensions.rolecall.fandom`) | |
| `CharacterContent.nsfw` (boolean) | `contentRating.nsfw` | native (`extensions.rolecall.nsfw`) | native (`extensions.rolecall.nsfw`) | Legacy binary flag, superseded by `content_rating` three-tier. Both are kept for back-compat. |
| `CharacterContent.content_rating` (`'all_hours'\|'late_night'\|'after_dark'`) | `contentRating.tier` | native (`extensions.rolecall.content_rating`) | native (`extensions.rolecall.content_rating`) | Three-tier system; VAUD: `content/types.ts:131`. |
| `Character.manual_rating_override` (packages/types) | `contentRating.manualOverride` | escrow | escrow | Not present in `apps/rc` `CharacterContent`/serializers at all - only in the shared `packages/types` `Character` row shape (`character.ts:167`). Not emitted by `serialize-v2.ts`/`serialize-v3.ts`. Treat as platform-only DB state; escrow it under `rolecall.escrow` if ever exposed to the codec, never invent an extensions field for it. |
| `CharacterContent.token_count` | `stats.tokenCount` (computed field, see canonical-model.md "Token counting") | native (`extensions.rolecall.token_count`) V2 only | **dropped in VAUDEVILLE's V3 serializer** (absent from `serialize-v3.ts:78-93`) - spec REQUIRES native for both; see edge case 1 | Canonical model computes token counts via `TokenCounter`, never stores them, but the source card value is still round-trip data the codec must preserve if present on import. |
| `CharacterContent.image_url` / `thumbnail_url` | `presentation.imageUrl` / `presentation.thumbnailUrl` | native (`extensions.rolecall.image_url`, `.thumbnail_url`) | **dropped in VAUDEVILLE's V3 serializer** - spec REQUIRES native; see edge case 1 | V3 has a base-spec `assets[]` array (icon/background/etc.) that is a separate, richer asset mechanism (see sprites row below); `image_url`/`thumbnail_url` are RC's flat DB columns and are additionally round-tripped via the RC extension. |
| `CharacterContent.creator_notes` | prompt-bearing `creatorNotes` (maps to base V2 `data.creator_notes`, see chara-card-v2.md) | N/A - base field | N/A - base field | Not RC-specific; listed only to disambiguate from the next row. |
| `CharacterContent.creators_note` (distinct DB column: "note from creator to other users, not injected into prompts") | `presentation.creatorsNote` | native (`extensions.rolecall.creators_note`) | **dropped in VAUDEVILLE's V3 serializer** - spec REQUIRES native; see edge case 1 | Do not confuse with `creator_notes` (prompt-bearing, base V2 field) or with `character.ts`'s doc comment "Note from creator to other users (not injected into prompts)" at `character.ts:125`. |
| `CharacterContent.accent_color` | `presentation.accentColor` | native (`extensions.rolecall.accent_color`) | **dropped in VAUDEVILLE's V3 serializer** - spec REQUIRES native; see edge case 1 | Single hex/token color for card theming. |
| `CharacterContent.card_layout` | `presentation.cardLayout` | escrow | escrow | Present on the shared `packages/types` `Character` row (`character.ts:153`) but never read/written by `serialize-v2.ts`/`serialize-v3.ts`/`parse-v2.ts`. OPEN QUESTION: intended target field/location not found in any codec path - escrow under `rolecall.escrow.card_layout` until clarified. |
| `CharacterContent.source_url` | `provenance.sourceUrl` | native (`extensions.rolecall.source_url`) | native (`extensions.rolecall.source_url`) | |
| `CharacterContent.details` (`CharacterDetails`, JSONB) | `presentation.castingCard` (see details sub-map below) | native (`extensions.rolecall.details`), whole object passed through as-is (VAUD: `serialize-v2.ts:218`) | **dropped in VAUDEVILLE's V3 serializer** - spec REQUIRES native; see edge case 1 | See detailed sub-map in section 4. |
| `CharacterContent.sprites` (`CharacterSprite[]`, compact `{t,u,l?}`) | `presentation.sprites[]` (`{type,url,label?}`) | escrow (V2 has no `assets` mechanism; RC does not put sprites in V2 extensions) | native - expanded and merged into base-spec `data.assets[]` via `spritesToV3Assets` (VAUD: `serialize-v3.ts:135-145`, `sprites/types.ts:289-306`) | `t:'main'` maps to V3 asset `type:'icon'`; all other sprite types (`expression`,`outfit`,`pose`,`background`) pass through as their own asset `type` string. `name` = sprite `label` or `` `${type}_${index+1}` ``. `ext` derived from the URL's file extension. Round-trip: `v3AssetsToSprites` reverses `icon`->`main`, filters to the 5 known sprite types, drops anything else (VAUD: `sprites/types.ts:311-323`). |
| `CharacterContent.triggerWarnings` / `Character.triggerWarnings` (packages/types only) | `contentRating.triggerWarnings[]` | OPEN QUESTION - see edge case 6 | OPEN QUESTION - see edge case 6 | canonical-model.md lists "trigger warnings" as part of the RC-native character superset, but no VAUDEVILLE serializer/parser in `formats/character/*` reads or writes them; only `tags: string[]` is exported. Not resolvable from source; flagged, not guessed. |
| `CharacterContent.chat_count`, `favorite_count`, `download_count`, `rating_average`, `rating_count`, `fork_count`, `forked_from_id`, `original_creator_id`, `forked_at`, `current_version_number`, `version_count`, `status`, `creator_id`, `creatorName`, `isOwner` | (none - platform/social metadata) | dropped | dropped | Never emitted by any `formats/character/*` serializer. These are RoleCall-the-platform bookkeeping (ownership, social counts, moderation status, version lineage inside RC's own DB), not portable card content. A codec that emitted these into a card would leak platform-internal IDs into a file meant to travel between tools. |
| loadout code (`options.loadoutCode`, RC:Creator/Preset/Config string) | `provenance.recommendedLoadout` | native (`extensions.rolecall.loadout`) | native (`extensions.rolecall.loadout`) | Not a `CharacterContent` column; supplied by the exporting caller (e.g. from a linked preset). |
| recommended content (`RoleCallRecommendations`: presets/lorebooks/regexes/personas) | `provenance.recommendations` | native (`extensions.rolecall.recommendations`) | native (`extensions.rolecall.recommendations`) | Each entry is `{id?, name, note?, priority?}` plus type-specific fields (`loadout_code` for presets; `auto_enable`/`include_in_export` for lorebooks; `auto_enable` for regexes). VAUD: `serialize-v2.ts:57-82`. |
| tracker preset (`CharacterTrackerPreset`) | `provenance.trackerPreset` | native (`extensions.rolecall.trackerPreset`) | native (`extensions.rolecall.trackerPreset`) | Creator-suggested tracker modules + optional starting state. Normalized on read via `normalizeCharacterTrackerPreset` (VAUD: `parse-v2.ts:259`). |
| bundled lorebook/regex data (`linkedLorebooks`, `linkedRegexScripts`) | (transport-only; not a canonical Character field) | native (`extensions.rolecall.linkedLorebooks`, `.linkedRegexScripts`) | native (`extensions.rolecall.linkedLorebooks`, `.linkedRegexScripts`) | Full entry payloads for recommended lorebooks/regex scripts bundled into the card so a single-file export is self-contained. On import these become separate canonical Lorebook/RegexScript entities that the Character REFERENCES (canonical-model.md rule 3), not inline blobs on the Character itself. |
| embedded lorebook (`character_book` / RC-only `character_books[]` array) | Character -> Lorebook reference | native. Single book: base-spec `data.extensions.character_book` (V2) or promoted to `data.character_book` (V3). Multiple books (RC extension, non-standard): `data.extensions.character_books[]`, merged into one book on V3 export via `mergeCharacterBooks` (VAUD: `serialize-v3.ts:147-157`) | native, see left | Full field map to canonical `LorebookEntry` lives in specs/formats/rolecall-lorebook.md and specs/formats/st-worldinfo.md; this spec only records that the reference exists and that RC uniquely supports multiple embedded books pre-V3-export. |
| foreign extensions (arbitrary third-party keys on `data.extensions`, e.g. `talkativeness`, `fav`, `world`, `depth_prompt`) | escrow (no canonical home) | escrow, re-emitted verbatim except `rolecall`/`character_book`/`character_books` which are reconstructed from first-class fields (VAUD: `serialize-v2.ts:164-175`) | same mechanism, inherited via the V2 base (`serialize-v3.ts:148,164`) | `ParsedCharacter._rawExtensions` on the read side carries the raw extensions blob so importers can round-trip foreign keys into `characters.extensions` (VAUD: `parse-v2.ts:63-67,265`). |
| `extensions.depth_prompt` (ST/base-spec convention: `{prompt, depth, role?}`) | `depthInjections[]` (single entry) | escrow today in VAUDEVILLE (passed through as foreign extension, not merged with RC's own `details.prompt_depth_injections`) | same | Two independent depth-injection mechanisms coexist in the source: ST's single `extensions.depth_prompt` and RC's `details.prompt_depth_injections[]` (plural, richer). The canonical model has ONE `depthInjections[]` array; both source shapes map onto it (`depth_prompt` becomes a single-element list). See edge case 3 for the merge/precedence rule this spec requires that VAUDEVILLE does not currently implement. |

### 4. `CharacterDetails` (casting-card `details` JSONB) sub-map

`details` travels as one opaque-to-V2/V3 object inside `extensions.rolecall.details`
(V2; V3 per edge case 1). Internally it decomposes to canonical fields as follows:

| `CharacterDetails` field | Canonical field | Notes |
|---|---|---|
| `signature_color` | `presentation.castingCard.signatureColor` | Primary palette color, hex string. |
| `gradient_colors` (`string[]`) | `presentation.castingCard.gradientColors[]` | |
| `colors` (`Array<{label,name,hex}>`) | `presentation.castingCard.palette[]` | Named palette swatches beyond the single signature/gradient colors. |
| `full_name` | `identity.fullName` | Distinct from the card's top-level `name` (display/short name vs. full in-fiction name). |
| `title` | `identity.title` | E.g. "The Wandering Blacksmith". |
| `age` | `identity.age` | Free-text (not a validated integer in source). |
| `pronouns` | `identity.pronouns` | Free-text. |
| `fieldOrder` (`string[]`) | `presentation.castingCard.fieldOrder[]` | User-defined display order for bento/casting-card field cards. UI-layout metadata, not prompt content - native but inert to prompt assembly. |
| `default_background` (untyped in `content/types.ts`; `CharacterDefaultBackground` in `packages/types/character.ts:31-36`: `{backgroundId, customUrl, overlayOpacity, videoPlaybackRate?}`) | `presentation.defaultBackground` | Creator-curated default chat background. |
| `prompt_depth_injections` (`Array<{id?, content, depth?, role?, enabled?}>`) | `depthInjections[]` | THE canonical depth-injection array named in the production bible brief. Each entry maps 1:1: `content`->`text`, `depth`->`depth`, `role`->`role` (default `"system"` when absent - OPEN QUESTION: no explicit default observed in source, see edge case 4), `enabled`->`enabled` (default `true` when absent), `id`->`id` (generate a ulid if absent on parse, per canonical-model.md `Entity.id` convention). |
| `publicDefinitionDisplay` (`PublicDefinitionDisplaySettings`: `{spoilerMode, order, spoilers}`) | `presentation.publicDefinitionDisplay` | Controls spoiler/reveal-order UI on RC's public character page for the 7 fields in `PUBLIC_CHARACTER_DEFINITION_FIELDS` (personality, first-message, scenario, example-dialogue, description, creators-note, system-prompt). RC-only; Plot (the sister app) has no editor for it but preserves it via JSONB merge. Platform-display metadata, not prompt content - native but inert to prompt assembly. VAUD: `packages/types/src/character-display.ts:1-20`. |

### 5. RoleOut legacy (read-only)

RoleOut is the predecessor product/format. Its PNG export shape is a flat JSON with
`{name, title, content, source?, exportedBy?}` embedded under the **`persona`** tEXt
keyword (not `chara`/`ccv3`/`rcpersona`). `library/png-parser.ts` detects it by
structural shape (`parsed.name && 'title' in parsed && 'content' in parsed`, checked
AFTER the V2/V3/rcpersona checks and BEFORE the flat-V1 check) and maps it into
character-shaped fields: `name`->`name`, `title`->`description`,
`content`->`personality`, `exportedBy`->`creator_notes`, `source`->`creator`, and
`tags: ["persona", "roleout"]` (VAUD: `png-parser.ts:225-247`). Nothing in
VAUDEVILLE writes this shape - `persona-export.ts` writes `rcpersona`/`rolecall_persona`
instead - so RoleOut is import-only. The Round-Trip Law does not apply to it (there
is no `serialize(..., "roleout")` to round-trip against); RoleOut fixtures are
parse-only conformance tests.

### 6. Capabilities matrix (this spec's additions to the base V2/V3 capabilities)

```
tagline                                -> native
alternateGreetings[].title             -> native
genre / fandom                         -> native
contentRating.nsfw / .tier             -> native
contentRating.manualOverride           -> escrow
stats.tokenCount (source value)        -> native (V2), native (V3, per this spec's fixed serializer)
presentation.imageUrl / .thumbnailUrl  -> native (V2), native (V3, per this spec's fixed serializer)
presentation.creatorsNote              -> native (V2), native (V3, per this spec's fixed serializer)
presentation.accentColor               -> native (V2), native (V3, per this spec's fixed serializer)
presentation.cardLayout                -> escrow
presentation.castingCard.*             -> native (V2), native (V3, per this spec's fixed serializer)
presentation.sprites[]                 -> escrow (V2), native (V3)
presentation.defaultBackground         -> native (V2), native (V3, per this spec's fixed serializer)
presentation.publicDefinitionDisplay   -> native (V2), native (V3, per this spec's fixed serializer)
depthInjections[]                      -> native (from details.prompt_depth_injections); escrow (from extensions.depth_prompt, see edge case 3)
contentRating.triggerWarnings[]        -> OPEN QUESTION (edge case 6)
provenance.sourceUrl / .recommendedLoadout / .recommendations / .trackerPreset -> native
platform/social metadata (counts, ids, status, ownership) -> dropped
```

## Public API sketch

```ts
// packages/formats/src/rolecall-character.ts
import type { Character, Entity } from "@vaud/core";
import type { CharaCardV2, CharaCardV3 } from "./chara-card-v2"; // and v3

/** RC-native extension block embedded at data.extensions.rolecall (V2 and V3). */
export interface RoleCallCharacterExtension {
  id?: string;
  tagline?: string;
  genre?: string;
  fandom?: string;
  nsfw?: boolean;
  content_rating?: "all_hours" | "late_night" | "after_dark";
  token_count?: number;
  image_url?: string;
  thumbnail_url?: string;
  source_url?: string;
  creator_notes?: string;   // RC's "creators_note" (not-injected-into-prompt) field
  creators_note?: string;
  accent_color?: string;
  details?: RoleCallCharacterDetails;
  loadout?: string;
  alternate_greeting_titles?: Array<string | null>;
  recommendations?: RoleCallRecommendations;
  trackerPreset?: unknown; // CharacterTrackerPreset, defined in a tracker-presets spec
  linkedLorebooks?: Array<Record<string, unknown>>;
  linkedRegexScripts?: Array<Record<string, unknown>>;
  // Opaque bag for fields observed on read with no resolved canonical/extension
  // target yet (e.g. card_layout). Never written by a conforming serializer
  // except to preserve what was present on parse.
  escrow?: Record<string, unknown>;
}

export interface RoleCallCharacterDetails {
  signature_color?: string;
  gradient_colors?: string[];
  colors?: Array<{ label: string; name: string; hex: string }>;
  full_name?: string;
  title?: string;
  age?: string;
  pronouns?: string;
  fieldOrder?: string[];
  default_background?: {
    backgroundId: string | null;
    customUrl: string | null;
    overlayOpacity: number;
    videoPlaybackRate?: number;
  };
  prompt_depth_injections?: Array<{
    id?: string;
    content: string;
    depth?: number;
    role?: "system" | "user" | "assistant";
    enabled?: boolean;
  }>;
  publicDefinitionDisplay?: {
    spoilerMode: boolean;
    order: string[];
    spoilers: Record<string, boolean>;
  };
}

export interface RoleCallCharacterCodec {
  /** True if data.extensions.rolecall is present and shaped like RoleCallCharacterExtension. */
  detectRoleCallProfile(card: CharaCardV2 | CharaCardV3): boolean;

  /** Layer the RC extension onto a base V2/V3 parse result to produce the full canonical Character. */
  parseRoleCallLayer(
    card: CharaCardV2 | CharaCardV3,
    base: Character // already parsed by the chara-card-v2/v3 codec
  ): { data: Character; escrow: Record<string, unknown> };

  /** Add extensions.rolecall (and, for V3, the sprite-to-asset merge) onto a base-serialized card. */
  serializeRoleCallLayer(
    character: Entity<Character>,
    baseCard: CharaCardV2 | CharaCardV3,
    options?: {
      creatorName?: string;
      loadoutCode?: string;
      recommendations?: RoleCallRecommendations;
      linkedLorebooks?: Array<Record<string, unknown>>;
      linkedRegexScripts?: Array<Record<string, unknown>>;
    }
  ): CharaCardV2 | CharaCardV3;

  /**
   * Fallback reader for PNGs with no ccv3/chara chunk but an rcpersona or
   * (legacy RoleOut) persona chunk. Returns a routing hint rather than a
   * Character - callers decide whether to import as Persona (preferred) or,
   * for RoleOut only, as a degraded Character (legacy compatibility).
   */
  readLegacyPngFallback(pngBuffer: ArrayBuffer): 
    | { route: "persona"; keyword: "rcpersona" | "persona" }
    | { route: "character-degraded"; source: "roleout"; character: Partial<Character> }
    | { route: "none" };

  capabilities: Record<string, "native" | "escrow" | "dropped">;
}

export interface RoleCallRecommendations {
  presets?: Array<{ id?: string; name: string; note?: string; priority?: number; loadout_code?: string }>;
  lorebooks?: Array<{ id?: string; name: string; note?: string; priority?: number; auto_enable?: boolean; include_in_export?: boolean }>;
  regexes?: Array<{ id?: string; name: string; note?: string; priority?: number; auto_enable?: boolean }>;
  personas?: Array<{ id?: string; name: string; note?: string; priority?: number }>;
}
```

## Edge cases & failure modes

1. **VAUDEVILLE's V3 serializer drops `token_count`, `image_url`, `thumbnail_url`,
   `creators_note`, `accent_color`, and `details` from `extensions.rolecall`**
   (present in `serialize-v2.ts:105-135`, absent from `serialize-v3.ts:78-93`). This
   is a live Round-Trip Law violation in the reference implementation: import a card
   with a signature color and casting-card palette, export to V3, reimport - the
   palette is gone. This spec REQUIRES the `vaud` V3 serializer to include the full
   `RoleCallCharacterExtension` (matching V2), not VAUDEVILLE's narrower V3 subset.
   Required permanent fixture: `fixtures/rolecall-character/v3-details-roundtrip/`
   (a card with `details.signature_color` + `details.colors[]` + `token_count`,
   round-tripped through V3, asserting all four survive).
2. **`character_book` vs `character_books` collision on V2 parse.** RC's own V2
   exporter can place a single book at `data.extensions.character_book` OR (rare,
   hand-edited files) at spec-compliant `data.character_book`. `parse-v2.ts:181-193`
   checks both locations and pushes both into `embeddedLorebooks[]` if they are
   different objects, meaning a hand-crafted card with both locations set to
   different books imports as TWO lorebooks. Preserve this behavior (it is
   intentional defensive parsing, not a bug) but flag it as a warning in the
   `ParseReport`.
3. **Two independent depth-injection mechanisms with no defined merge order.**
   `extensions.depth_prompt` (single, base-spec/ST convention) and
   `details.prompt_depth_injections[]` (RC-native, plural) can both be present on
   the same card. VAUDEVILLE's `serialize-v2.ts`/`parse-v2.ts` never merges them -
   `depth_prompt` rides as an opaque foreign extension (escrowed, never entering
   `depthInjections[]`) while `details.prompt_depth_injections` becomes the
   canonical `depthInjections[]`. This spec REQUIRES both to feed the same
   canonical `depthInjections[]` array on parse (append `depth_prompt` as one more
   entry, order: `details.prompt_depth_injections` first, then `depth_prompt`), and
   on serialize to write BOTH back out if both were present at parse time
   (round-trip fidelity - see rule 4, escrow-and-roundtrip.md: canonical wins on
   conflict, so if the canonical `depthInjections[]` was edited, the codec
   re-derives both locations from the edited array using the same append rule, and
   the single-entry `depth_prompt` reconstruction uses the FIRST canonical entry
   whose origin was `depth_prompt`, tracked via escrow provenance).
4. **No default role/enabled observed for `prompt_depth_injections` entries lacking
   `role`/`enabled`.** OPEN QUESTION: source code never assigns a default at read
   or write time (fields stay `undefined` and are passed through as-is); consuming
   code (prompt-assembly) may apply its own default. Until prompt-assembly.md
   specifies the default, this codec MUST preserve `role`/`enabled` as `undefined`
   rather than inventing `"system"`/`true`, and MUST NOT drop the key.
5. **RoleOut fallback is lossy and one-directional.** Importing a RoleOut-shaped
   `persona` PNG through the character path fabricates `scenario`, `first_mes`,
   `mes_example` as empty strings and stuffs the persona's actual content into
   `personality`. If a user then exports that "character," they get a normal V2/V3
   card with an empty scenario/greeting - this is expected legacy behavior, not a
   bug to fix, but the CLI report (`vaud import --strict`) MUST warn
   `"legacy-roleout-fallback: imported as degraded character; consider importing as
   a Persona instead"`.
6. **Trigger warnings: undecided canonical-vs-platform status.** canonical-model.md
   (this suite) lists trigger warnings as part of the RC-native Character superset,
   but no codec path in VAUDEVILLE reads or writes `triggerWarnings` on a card - only
   `tags: string[]` crosses the wire. OPEN QUESTION: is `triggerWarnings` meant to be
   card-portable (like tags) or platform-only moderation metadata attached at
   display time? Do not invent a card field for it; treat as dropped until answered.
7. **`manual_rating_override` and `card_layout` exist only on the shared
   `packages/types` `Character` row, not on `apps/rc`'s `CharacterContent` used by
   the actual serializers.** Neither is read/written by any `formats/character/*`
   file. OPEN QUESTION: are these intended to eventually flow through
   `extensions.rolecall`, or are they permanently platform-only? Escrowed, not dropped,
   pending an answer (escrow because they clearly belong to "this character" rather
   than to RC-the-platform bookkeeping list in the field-map's dropped row).
8. **Sprite host allowlist is a RoleCall product policy, not a format constraint.**
   `ALLOWED_SPRITE_HOSTS`/`BLOCKED_SPRITE_HOSTS` (VAUD: `sprites/types.ts:65-106`)
   reject sprite URLs from disallowed hosts at RC's UI/API layer. The `vaud` codec
   MUST NOT enforce this allowlist on parse (a foreign card may reference any host);
   it is a RoleCall-product-specific validation concern, out of scope for the codec.
   Round-trip must preserve whatever sprite URLs were present regardless of host.
9. **Unknown `SpriteType` / asset `type` on V3->sprite import.** `v3AssetsToSprites`
   silently drops any asset whose `type` is not one of the 5 known sprite types
   (after `icon`->`main` remapping) (VAUD: `sprites/types.ts:311-323`). This spec
   requires the drop to be recorded in `ParseReport.dropped`, not silent.
10. **Flat V2 PNG payload vs. wrapped V2 JSON file.** The same character can appear
    on disk as a wrapped `{spec,data}` JSON file and, when embedded in a PNG by RC's
    own exporter, as the bare `data` object with no wrapper (`isFlatV2Data`
    detection, `parse-v2.ts:296-311`). A codec MUST detect both without requiring
    the caller to specify which; detection order is V3 -> V2 wrapped -> flat V2 ->
    V1 -> Backyard (VAUD: `parse-v2.ts:316-391`).

## Test plan

- Fixtures required (`fixtures/rolecall-character/`):
  - `v2-full-rolecall-ext/` - V2 JSON with every `extensions.rolecall` field
    populated (tagline, genre, fandom, nsfw, content_rating, token_count, image_url,
    thumbnail_url, source_url, creator_notes/creators_note, accent_color, full
    `details` object with all sub-fields, loadout, alternate_greeting_titles,
    recommendations covering all 4 kinds, trackerPreset, linkedLorebooks,
    linkedRegexScripts). Exercises the whole field map.
  - `v3-details-roundtrip/` - see edge case 1: V3 card whose `extensions.rolecall`
    must preserve `details`/`token_count`/`image_url`/`thumbnail_url`/`creators_note`/
    `accent_color` through a full parse -> serialize -> parse cycle.
  - `v2-flat-png-selfexport/` - a PNG built the way RC's own exporter builds it
    (flat `data` in the `chara` chunk, no wrapper) to exercise `isFlatV2Data`.
  - `v2-dual-character-book-locations/` - a hand-crafted V2 JSON with DIFFERENT
    books at both `data.character_book` and `data.extensions.character_book`, to
    pin the "imports as two lorebooks + warning" behavior from edge case 2.
  - `v2-character-books-plural/` - RC's non-standard `character_books[]` array
    (3 books), exercising V3 export's `mergeCharacterBooks` merge-into-one.
  - `v3-sprites-to-assets/` - a character with all 5 sprite types populated,
    round-tripped through V3 `assets[]`, exercising the `main`<->`icon` remap.
  - `v3-unknown-asset-type/` - a V3 card with a foreign `assets[].type` (e.g.
    `"user_icon"`) to exercise edge case 9's drop-and-report behavior.
  - `depth-injections-both-mechanisms/` - a card with BOTH `extensions.depth_prompt`
    and `details.prompt_depth_injections[]` populated, to pin edge case 3's merge
    order and re-derivation rule.
  - `roleout-legacy-import/` - a PNG with a `persona` tEXt chunk holding
    `{name, title, content, source, exportedBy}`, exercising section 5 and the
    `legacy-roleout-fallback` warning. Parse-only (no round-trip assertion).
  - `foreign-extensions-passthrough/` - a card with `talkativeness`, `fav`, `world`,
    and an unrelated third-party namespace key on `extensions`, verifying they
    survive an RC-in -> RC-out round-trip (VAUD: `serialize-v2.ts:164-175`).
- Round-Trip Law applicability: full - every RC-native fixture above (except
  `roleout-legacy-import`, which is parse-only per edge case 5's asymmetry) must
  satisfy `serialize(parse(F), sameFormat)` semantic-identity per
  escrow-and-roundtrip.md. Byte-identity level: `semantic` (JSON key order and
  PNG chunk order are not guaranteed).
- Property/unit tests beyond fixtures:
  - `sprites/types.ts` conversion round-trip (`compactSprite(expandSprite(x)) === x`)
    as a property test over generated sprite objects, independent of the card codec.
  - Detection-order property test: for every fixture, confirm exactly one branch of
    `detectFormat`-equivalent logic claims it (no double-detection, no silent falls
    to `unknown`).
  - `capabilities` export snapshot test (per escrow-and-roundtrip.md "Capabilities
    matrix" rule) so any future narrowing of native support is visible in review.

## Non-goals

- Re-specifying base chara_card_v2/v3 field semantics, spec_version negotiation, or
  PNG tEXt chunk mechanics - owned by chara-card-v2.md, chara-card-v3.md, and
  png-embedding.md.
- Specifying the canonical `LorebookEntry` field map for embedded `character_book`
  content - owned by rolecall-lorebook.md / st-worldinfo.md.
- Specifying the RoleCall Persona codec (`rcpersona` keyword, `rolecall_persona`
  spec, personas table) - owned by personas.md. This spec only documents how the
  character-reading path interacts with persona PNGs as an import fallback.
- Deciding product policy (sprite host allowlists, content-rating enforcement,
  moderation status) - those are RoleCall-the-platform concerns, not codec concerns.
  The `vaud` codec preserves whatever values are present; it does not validate them
  against RC's product rules.
- Resolving the OPEN QUESTIONs in this spec (trigger warnings, `card_layout`,
  `manual_rating_override`, depth-injection default role/enabled). A reviewer or a
  follow-up ticket must resolve these before M1 codec code ships against this spec,
  or the ticket must explicitly scope them out.

## Sources consulted

- `<RoleCall>\packages\types\src\character.ts` (:31-36
  `CharacterDefaultBackground`, :42-48 `CharacterPromptDepthInjection`, :79-108
  `CharacterCardDetails`, :110-171 `Character`, :125 creators_note doc comment,
  :153 `card_layout`, :167 `manual_rating_override`)
- `<RoleCall>\packages\types\src\character-display.ts`
  (:1-20 `PUBLIC_CHARACTER_DEFINITION_FIELDS`, `PublicDefinitionDisplaySettings`)
- `<RoleCall>\apps\rc\src\lib\content\types.ts` (:12-25
  `ContentType`/`CONTENT_TABLES`, :108-149 `CharacterContent`, :155-173
  `CharacterDetails`, :179-183 `CharacterSprite`)
- `<RoleCall>\apps\rc\src\lib\formats\character\serialize-v2.ts`
  (:23-52 `CharacterCardV2`/`CharacterCardV2Data`, :57-139
  `RoleCallRecommendations`/`CharacterCardV2Extensions`, :148-260 `serializeToV2`,
  :164-175 foreign-extension passthrough, :188-199 greeting title handling,
  :202-230 `extensions.rolecall` assembly, :246-248 creator_notes/tagline fallback)
- `<RoleCall>\apps\rc\src\lib\formats\character\serialize-v3.ts`
  (:24-45 `CharacterAsset`/`CharacterSource`/`CharacterCardV3`, :51-94
  `CharacterCardV3Data` incl. narrower `extensions.rolecall` shape, :103-183
  `serializeToV3`, :130 V2-as-base call, :135-145 sprite-to-asset merge,
  :147-157 character_book promotion/merge)
- `<RoleCall>\apps\rc\src\lib\formats\character\parse-v2.ts`
  (:22-68 `ParsedCharacter`, :63-67 `_rawExtensions`, :112-121 `isV2Card`, :141-145
  `isV3Card`, :169-267 `parseV2`, :181-193 dual character_book handling, :200-215
  regex-script precedence, :230-245 greeting-title merge, :247-266 rolecall
  extension extraction, :269-285 `parseV3` delegating to `parseV2`, :296-311
  `isFlatV2Data`, :316-391 `parseCharacterJson` detection order)
- `<RoleCall>\apps\rc\src\lib\formats\png\writer.ts`
  (:34-43 tEXt chunk helpers, :53-91 `embedCharacterData`, :103-142
  `embedDualCharacterData` V3+V2 backfill, :151-175 `extractCharacterData`,
  :188-209 `getCharacterVersion`)
- `<RoleCall>\apps\rc\src\lib\library\png-parser.ts`
  (:10-11 header doc on ccv3/chara precedence, :62-127 `readCharacterData`
  ccv3>chara>rcpersona>persona precedence, :148-284 `parseCharacterCard` format
  branching incl. :184-223 rolecall_persona munge and :225-247 RoleOut munge)
- `<RoleCall>\apps\rc\src\lib\exports\persona-export.ts`
  (:4 header, :78-79 `rcpersona` tEXt keyword write) - confirms rcpersona is the
  Persona codec's keyword, not Character's.
- `<RoleCall>\apps\rc\src\lib\imports\persona-st.ts`
  (:20-49 `importPersonaFromST` using the shared `library/png-parser.ts` reader,
  RoleOut/ST persona import path)
- `<RoleCall>\apps\rc\src\lib\imports\content-detector.ts`
  (:15,:70 use of `library/png-parser.ts` `parseCharacterCard` for content-type
  classification) - cited to show the reader is live/used, not dead code.
- `<RoleCall>\apps\rc\src\lib\sprites\types.ts` (:16-45
  `SpriteType`/`SpriteCompact`/`Sprite`/`V3Asset`, :65-106 host allow/block lists,
  :250-284 compact/expand conversions, :289-306 `spritesToV3Assets`, :311-323
  `v3AssetsToSprites`)
- `docs\the master plan (private planning notes)`,
  `02-ARCHITECTURE.md`, the production bible (private planning notes) (brief row for this file, line 45)
- `specs\formats\canonical-model.md`
  (Character superset rules, escrow envelope shape, Lorebook-reference rule)
- `specs\formats\escrow-and-roundtrip.md`
  (Round-Trip Law, escrow rules, conflict rule, capabilities matrix, fixture rules)
- `templates\SPEC-TEMPLATE.md` (structure)
