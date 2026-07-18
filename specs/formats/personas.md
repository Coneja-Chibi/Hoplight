# Spec: Persona Codec (User Personas)

**Package:** `packages/formats` (codec) + `packages/core` (canonical `Persona` type) ·
**Milestone:** M1 (canonical model + codec), persona-aware assembly lands M5 ·
**Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/png-embedding.md (not yet written - PNG tEXt chunk mechanics),
specs/formats/rolecall-character.md (not yet written - `extensions.rolecall`
side-channel convention shared with character cards)
**VAUDEVILLE reference:** `apps/rc/src/lib/library/png-parser.ts` (:100-124 keyword
detection, :184-247 rcpersona/RoleOut parse branches), `apps/rc/src/lib/imports/persona.ts`
(:22-31 keyword priority, :37-75 unwrap), `apps/rc/src/lib/imports/persona-json.ts`
(:18-69 envelope unwrap, :139-243 V2 card extraction), `apps/rc/src/lib/imports/persona-st.ts`,
`apps/rc/src/lib/exports/persona-export.ts` (:43-56 rcpersona JSON builder, :65-94 PNG embed),
`apps/rc/src/app/api/content/personas/[id]/export/route.ts` (:109-189 the live V2-card
export builder that is the actual on-the-wire format today), `apps/rc/src/lib/imports/__tests__/persona-roundtrip.test.ts`
(pins the full field map both directions).

## Purpose

A **persona** represents the *user*, not a character the AI plays. It is the
counterpart to a Character: same prompt-injection machinery (name, description,
depth injections), completely different semantics (first-person voice for `{{user}}`,
not `{{char}}`). This spec defines the canonical `Persona` entity and the codec(s) that
read/write persona data across the four real-world encodings Vaudeville must support:
RoleCall's native `rcpersona` JSON envelope (PNG-embedded or bare), RoleCall's
production export shape (a Character-Card-V2-lookalike with an `extensions.rolecall`
side-channel - this is what `vaud` will actually see most often from RC users),
SillyTavern's own persona system (settings-embedded, not a portable file format, so
Vaudeville treats ST personas as an *import source shape*, not a target it serializes
to), and the legacy "RoleOut" `persona`-keyword PNG format that predates `rcpersona`.

This is a v0.1/M1-relevant format because `vaud convert`/`inspect`/`validate` must
handle any file a user drags in, including ones exported from RC's live persona
export route, which today emits a V2 character card, not `rcpersona`.

## Behavior

### Source shapes this codec must detect and parse

1. **RoleCall native (`rcpersona`)** - the lossless, purpose-built shape.
   PNG: `tEXt` chunk, keyword `rcpersona` (case-insensitive), base64-encoded UTF-8
   JSON (`apps/rc/src/lib/library/png-parser.ts:100-111`, `apps/rc/src/lib/exports/persona-export.ts:78-79`).
   JSON: bare envelope `{ spec: "rolecall_persona", spec_version: "1.0", data: {...} }`
   (`apps/rc/src/lib/exports/persona-export.ts:43-56`).

   `data` shape (confirmed against
   `PersonaExportData` in `persona-export.ts:12-38`):
   ```
   data.name          string, required
   data.description   string, optional - brief user-facing summary (library card blurb)
   data.content       string, "required" per doc but treated as optional/derivable
                       in practice - full text injected into AI context, first-person
   data.sections      object, optional - structured alternative to content:
     .appearance      string
     .body            string
     .personality     string
     .quirks          string
     .history         string
   data.metadata      object, optional
     .creator         string
     .version         string
     .created_at      ISO 8601 string
     .tags            string[]
     .content_rating  "all_hours" | "after_dark"
     .source          string (e.g. "rolecall", "sillytavern", "custom")
   data.lorebook      object, optional (documented in PersonaExportData but not
                       wired into the PNG parser's rolecall_persona branch - see
                       Edge case 7)
   ```
   Content-vs-sections rule (confirmed in
   `png-parser.ts:188-202`): if `content` is a non-empty string, it wins outright;
   sections are NOT merged in. If `content` is empty/absent and `sections` exists,
   the importer compiles sections into a single text block in fixed order
   `appearance, body, personality, quirks, history`, each prefixed
   `"<Label>: <text>\n\n"` and joined - this compiled string becomes `content`.
   Missing sections are skipped, not blanked.

2. **RC production export shape (V2-card-with-side-channel)** - what
   `GET /api/content/personas/[id]/export` actually emits today (both `?format=json`
   and `?format=png`, PNG uses the `chara` keyword like a real character card, NOT
   `rcpersona` - see `export/route.ts:290-293`). This is the shape a Vaudeville user
   is most likely to hand `vaud` after clicking "Export" in RC.

   Field map (source: `export/route.ts:109-182`, confirmed by
   `persona-json.ts:159-243` reading it back and
   `persona-roundtrip.test.ts:106-144` pinning both sides):

   | Card field | Persona DB column | Notes |
   |---|---|---|
   | `data.name` | `name` | direct |
   | `data.description` | derived: `content` + `"Appearance: "+details.appearance` + `"Body: "+details.body`, joined `\n\n` | **folded field** - three persona fields packed into one V2 slot |
   | `data.personality` | `details.personality` | direct |
   | `data.scenario` | `details.history` | direct - persona's background text, not an RP scenario |
   | `data.creator_notes` | `description` (the brief) | **NOT** `first_mes`/greeting semantics - repurposed as the brief-summary carrier |
   | `data.tags` | `details.traits` | array of strings |
   | `data.first_mes`, `data.mes_example`, `data.system_prompt`, `data.post_history_instructions`, `data.alternate_greetings` | - | always emitted empty/`[]`; character-only fields, meaningless for a persona |
   | `data.extensions.rolecall.id` | `id` | persona UUID |
   | `data.extensions.rolecall.type` | - | literal `"persona"`, the discriminator that distinguishes an RC persona export from an RC character export at this same V2 shape |
   | `data.extensions.rolecall.tagline` | `details.tagline` | |
   | `data.extensions.rolecall.age` | `details.age` | |
   | `data.extensions.rolecall.height` | `details.height` | |
   | `data.extensions.rolecall.pronouns` | `details.pronouns` | |
   | `data.extensions.rolecall.quirks` | `details.quirks` | duplicate of `sections.quirks` - the V2 shape has no other home for it since `personality`/`scenario` are taken |
   | `data.extensions.rolecall.signature_color` | `details.signatureColor` | snake_case on the wire, camelCase in the DB/canonical model |
   | `data.extensions.rolecall.colors` | `details.colors` | array of `{hex, name, label}` |
   | `data.extensions.rolecall.lorebook_id` | `details.lorebook_id` | bound lorebook reference |
   | `data.extensions.rolecall.section_order` | `section_order` | display-order array, e.g. `["personality","appearance","history","body","quirks"]` |
   | `data.extensions.rolecall.image_url` | `image_url` | JSON export only - PNG export carries the image as the file body instead |
   | `data.extensions.rolecall.is_after_dark` | `is_after_dark` | boolean, omitted (not `false`) when false |
   | `data.extensions.rolecall.source` | - | literal `"rolecall"` |

   Every field the export route writes into `extensions.rolecall` MUST be read back
   on import, or the round trip silently loses data - this was a live production bug
   (see `persona-roundtrip.test.ts:1-31` for the incident writeup) that is now fixed
   in `persona-json.ts` and pinned by tests. Vaudeville's codec must replicate the
   fixed behavior, not the buggy one.

3. **SillyTavern's own persona system** - NOT a portable file, an entry in ST's
   `settings.json`/`personas.json` local state. Fields per persona (confirmed via
   SillyTavern-Docs `Usage/personas.md`, July 2026):
   - `name` - display name
   - avatar filename - reference into ST's `User Avatars/` directory
   - `description` - free text injected into the prompt; supports `{{char}}`/`{{user}}` macros
   - `title` - optional note, editor-only, never injected
   - `position` - where the description injects: in-prompt/story-string (default),
     top-of-author's-note, bottom-of-author's-note, in-chat-at-depth, or disabled
   - `depth` and `role` - only meaningful when `position` is in-chat-at-depth
     (role is one of system/user/assistant, matching chat-completion roles)
   - chat-lock / character-lock - persona auto-switches when bound to a specific
     chat or character
   - default-persona flag
   ST does not export personas as standalone files through its UI; a user gets an
   ST persona into `vaud` in one of two ways: (a) manually copying the description
   text, or (b) exporting the persona's avatar-as-character-card via ST's own
   "export persona as character" feature, which produces a real V2/V3 character
   card (handled by shape 4 below, same as any V2 card). OPEN QUESTION: does ST have
   a documented JSON export of a single persona entry (not the whole settings file)
   in a version this codec should target directly? Not confirmed in the docs consulted;
   treat description text and the V2-card path as the two supported ST entry points
   until confirmed otherwise.

4. **Foreign V2/V3 character card fed in as a persona** - a user importing any
   `chara`/`ccv3`-keyword PNG or bare V2/V3 JSON and asking Vaudeville to treat it
   as a persona (common because SillyTavern personas are commonly authored as
   character cards). Field map (source: `persona-json.ts:159-243`,
   confirmed by `persona-roundtrip.test.ts:389-436`):

   | Card field | Persona field | Notes |
   |---|---|---|
   | `data.name` | `name` | |
   | `data.creator_notes` (if non-empty) | `description` (brief) | takes priority over `data.description` for the brief slot |
   | `data.description` (unfolded - see below) | `content` | |
   | `data.personality` | `details.personality` | |
   | `data.scenario` | `details.history` | |
   | `data.tags` | `details.traits` | |
   | `data.extensions.rolecall.*` | same as shape 2 | if present (i.e. this is actually an RC export being read through the generic V2 path) |

   Unfolding: because RC's own export route (shape 2) folds `content`,
   `"Appearance: "`, and `"Body: "` blocks into `data.description` joined by
   blank lines, the generic V2 importer must reverse that fold on *any* V2 card
   (not just ones it recognizes as RC's) by splitting on `\n\n+`, pulling out
   `Appearance:`/`Body:`-prefixed paragraphs into `details.appearance`/`details.body`,
   and treating everything else as `content` (`persona-json.ts:101-131`). A plain ST
   persona-as-character-card has no such prefixed paragraphs, so this is a no-op for
   genuinely foreign cards and only activates for RC-shaped ones.
   Detection of "is this V2 data shaped like a character card" is structural, not
   spec-tag-based: any of `first_mes`, `mes_example`, `creator_notes`, `system_prompt`,
   `post_history_instructions`, `alternate_greetings`, or `extensions` being present
   routes through this branch (`persona-json.ts:139-149`).

5. **Legacy RoleOut** - flat PNG JSON, keyword `persona`, shape
   `{ name, title, content, exportedBy?, source? }` (`png-parser.ts:225-247`).
   Map: `name`→`name`, `title`→`description`
   (the brief), `content`→`content`, `exportedBy`→escrowed (no canonical home),
   `source`→escrowed.

### PNG keyword detection order

Multiple keywords may coexist in one PNG's `tEXt` chunks (an RC export re-saved
by another tool, for instance). Detection priority, most-specific/most-trustworthy
first (`apps/rc/src/lib/imports/persona.ts:22-31,59-61`):

1. `rcpersona` - RoleCall native, lossless
2. `persona` - legacy RoleOut
3. `ccv3` - V3 character card (foreign-in, shape 4)
4. `chara` - V2 character card (foreign-in or RC's own export, shape 2/4)

This differs from the *character-card* PNG detector's priority (`ccv3` before
`chara`, no persona keywords at all - see rolecall-character.md /
png-embedding.md), so the persona codec's `detect()` must NOT delegate wholesale
to the character codec's `detect()`; it needs its own keyword scan that also
recognizes `rcpersona`/`persona`.

A malformed chunk for one keyword does not abort detection - the scanner keeps
trying lower-priority keywords rather than failing the whole parse
(`persona.ts:63-71`).

### JSON envelope unwrapping (bare JSON import, not PNG)

Before any of shapes 1/2/4/5 above are matched, the raw JSON is peeled of two
legacy wrapper layers, in order (`persona-json.ts:18-69`, Discord ticket
1502802736545009724 fixed this):

1. Library export wrapper: `{ exportedAt, type, version, data: {...} }` → unwrap
   to `.data`.
2. Inner envelope: `{ persona: {...} }` → unwrap to `.persona`.

After unwrapping, the result is matched against, in order: `spec === "rolecall_persona"`
(shape 1) → `spec === "chara_card_v2" | "chara_card_v3"` (shape 2/4, structural) →
plain object with a string `name` (loose/flat shape, treated as already-canonical-ish:
`description`, `content`, `details`, `section_order`, `is_after_dark`, `image_url`
read directly off the root) → `null` (unrecognized).

### Canonical `Persona` shape (this spec's contribution to `packages/core`)

Per canonical-model.md's content-type list, `Persona` is a first-class entity type
alongside `Character`. Proposed canonical payload (data-only; wrapped in the shared
`Entity<T>` envelope from canonical-model.md:17-29):

```
Persona {
  name: string
  brief?: string            // canonical name for RC's persona.description /
                             // ST's creator_notes-as-brief / RoleOut's title -
                             // the short user-facing summary, NEVER the injected text
  content: string           // the full first-person text injected as {{user}}'s voice
  sections?: {               // structured alternative source for `content`; codecs
    appearance?: string      // that support structured editing read/write these,
    body?: string             // codecs that only support flat text derive `content`
    personality?: string      // from them per the compile rule in shape 1 above
    quirks?: string
    history?: string
  }
  sectionOrder?: string[]    // display order; canonical default is
                              // ["appearance","body","personality","quirks","history"]
  traits?: string[]          // RC details.traits / V2 tags
  identity?: {                // grouped per canonical-model.md design rule 2
    tagline?: string
    age?: string
    height?: string
    pronouns?: string
  }
  presentation?: {
    signatureColor?: { hex: string; name: string }
    colors?: Array<{ hex: string; name: string; label: string }>
    imageRef?: AssetRef        // typed reference per canonical-model.md:76
  }
  lorebookId?: string          // reference to a canonical Lorebook entity, same
                                // reference-not-inline rule as Character (canonical-model.md:49)
  contentRating?: "all_hours" | "after_dark"
  chatInjection?: {             // ST-only positioning fields; escrowed on every
    position: "prompt" | "author_note_top" | "author_note_bottom" | "in_chat" | "none"
    depth?: number
    role?: "system" | "user" | "assistant"
  }
  metadata?: {
    creator?: string
    version?: string
    createdAt?: string
    source?: string
  }
}
```

Design notes:
- `brief` vs `content` is the single most important distinction in this whole
  format family. Every source shape has *some* short/long split (RC:
  `description`/`content`; ST-as-card: `creator_notes`/`description`; RoleOut:
  `title`/`content`) and every codec's job is landing the short text in `brief`
  and the long injectable text in `content`, never swapped. Getting this backwards
  is the exact class of bug `persona-roundtrip.test.ts` was written to pin.
  The field table is explicit that `content` is what gets "injected into AI
  context" and `description` is the "brief user-facing summary shown on
  library cards."
- `chatInjection` has no home in the RC `rcpersona` shape or the V2-card shape
  today (RC's assembly engine has its own, different persona-injection point -
  see prompt-assembly.md); it exists in canonical only to hold ST's positioning
  fields for round-trip when a persona genuinely originates from ST. Codecs that
  don't understand it escrow it.
- `sections` and `content` are BOTH kept in canonical (unlike the source formats'
  "content wins, sections ignored" rule) so an editor can offer structured editing
  even when the source was flat text, and so re-serializing to `rcpersona` can
  choose either representation. The compile-sections-into-content behavior lives
  in the `rcpersona` and RoleOut *codecs* (at serialize time, if `content` is
  empty and `sections` isn't), not in the canonical model itself.

### Capabilities matrix (native / escrow / dropped)

| Canonical field | `rcpersona` | RC V2-export shape | ST-as-V2-card (foreign) | RoleOut |
|---|---|---|---|---|
| `name` | native | native | native | native |
| `brief` | native (`description`) | native (`creator_notes`) | native (`creator_notes` only; left unset when `creator_notes` is empty/absent - NO fallback to `description`, per Edge case 3 and `persona-json.ts:173-175`) | native (`title`) |
| `content` | native | native (unfolded from `description`) | native (unfolded from `description`) | native |
| `sections.*` | native | escrow (folded into `description`/`personality`/`scenario` on write, unfolded on read - see shape 2 map) | escrow (same unfold heuristic, best-effort) | dropped (RoleOut has no sections) |
| `sectionOrder` | escrow (not in the JSON schema, but RC's DB tracks it - treat as escrow at the JSON-envelope level until a dedicated `rcpersona` field exists) | native (`extensions.rolecall.section_order`) | escrow (if `extensions.rolecall` present) / dropped (genuinely foreign) | dropped |
| `traits` | escrow (`metadata.tags` is the closest analog, but is documented as free-form content tags, e.g. "fantasy, adventurer" - not confirmed equivalent to `details.traits`' personality-descriptor semantics; see OPEN QUESTION in Non-goals-adjacent note below) | native (`tags`) | native (`tags`) | dropped |
| `identity.*` | escrow (no home in the `rcpersona` schema) | native (`extensions.rolecall.{tagline,age,height,pronouns}`) | escrow if present, else dropped | dropped |
| `presentation.signatureColor`/`colors` | escrow | native (`extensions.rolecall.{signature_color,colors}`) | escrow if present, else dropped | dropped |
| `presentation.imageRef` | escrow (PNG file body when embedded; no JSON field) | native (`extensions.rolecall.image_url` for JSON; PNG file body for PNG) | dropped (generic V2 has no persona-image side-channel) | dropped |
| `lorebookId` | native (`data.lorebook`, see Edge case 7) | native (`extensions.rolecall.lorebook_id`) | escrow if present, else dropped | dropped |
| `contentRating` | native (`metadata.content_rating`) | escrow (`extensions.rolecall.is_after_dark`, boolean not enum - codec maps `true`→`after_dark`, `false`/absent→`all_hours`) | dropped | dropped |
| `chatInjection.*` | dropped (no field) | dropped | dropped (ST doesn't export these onto V2 cards either) | dropped |
| `metadata.creator/version/createdAt/source` | native | escrow (`creator` field is display name text, not structured metadata; escrowed as-is) | escrow if present | escrow (`exportedBy`, `source`) |

OPEN QUESTION: is `rcpersona`'s `metadata.tags` field meant to be the same
concept as the V2-export shape's `tags`/`details.traits` (personality
descriptors like "adventurous, scholarly, stubborn" per the roundtrip
fixture), or a distinct content-classification tag set (the doc's own example
uses "fantasy, adventurer, optimistic," which reads more like the latter)?
This is not documented, and no code path maps between
`rcpersona`'s `metadata.tags` and the DB's `details.traits`, so there is no
observed behavior to confirm against. Until resolved, the codec treats them
as related-but-separate: `metadata.tags` escrows opaquely; `traits` is only
populated natively from shapes that expose `details.traits`/V2 `tags`
directly.

### Byte-identity level

`semantic` for all four shapes. None of the source implementations guarantee key
order or whitespace stability (JSON.stringify with `null, 2` indent in the exporter
is the only formatting rule observed, and PNG chunk order is not guaranteed stable
across a decode/re-encode per escrow-and-roundtrip.md's general PNG caveat).

## Public API sketch

```ts
import type { Entity, Escrow, ParseReport, SerializeReport } from "@vaudeville/core";

export interface PersonaSections {
  appearance?: string;
  body?: string;
  personality?: string;
  quirks?: string;
  history?: string;
}

export interface Persona {
  name: string;
  brief?: string;
  content: string;
  sections?: PersonaSections;
  sectionOrder?: string[];
  traits?: string[];
  identity?: {
    tagline?: string;
    age?: string;
    height?: string;
    pronouns?: string;
  };
  presentation?: {
    signatureColor?: { hex: string; name: string };
    colors?: Array<{ hex: string; name: string; label: string }>;
    imageRef?: { kind: "external" | "embedded"; url?: string; assetId?: string };
  };
  lorebookId?: string;
  contentRating?: "all_hours" | "after_dark";
  chatInjection?: {
    position: "prompt" | "author_note_top" | "author_note_bottom" | "in_chat" | "none";
    depth?: number;
    role?: "system" | "user" | "assistant";
  };
  metadata?: {
    creator?: string;
    version?: string;
    createdAt?: string;
    source?: string;
  };
}

export type PersonaSourceShape =
  | "rcpersona"          // RoleCall native envelope (PNG rcpersona chunk or bare JSON)
  | "rc-v2-export"       // RC's production V2-card-with-extensions.rolecall shape
  | "foreign-v2-card"    // any other V2/V3 character card read as a persona
  | "roleout";           // legacy flat { name, title, content } PNG

export interface PersonaCodec {
  id: "persona";
  /** Sniffs PNG tEXt keywords (rcpersona > persona > ccv3 > chara) or JSON
   *  envelope/spec markers. Returns the matched shape or null. */
  detect(input: Buffer | Uint8Array | unknown): PersonaSourceShape | null;
  parse(
    input: Buffer | Uint8Array | unknown,
    opts?: { shape?: PersonaSourceShape }
  ): { entity: Entity<Persona>; report: ParseReport };
  serialize(
    entity: Entity<Persona>,
    target: PersonaSourceShape,
    opts?: { image?: Buffer /* required for PNG targets */ }
  ): { output: Buffer | string; report: SerializeReport };
  capabilities: Record<string, "native" | "escrow" | "dropped">;
}
```

## Edge cases & failure modes

1. **`content` non-empty AND `sections` non-empty in an `rcpersona` source.**
   Per `png-parser.ts:189-190`, `content` wins
   outright; `sections` is preserved in the canonical model's `sections` field
   (never dropped - canonical keeps both, see design notes) but is NOT merged
   into `content` a second time.

2. **RC V2-export `description` field does not parse as the expected
   `content [+ "Appearance: ..." ] [+ "Body: ..." ]` fold** (e.g. a user
   hand-edited the exported JSON and inserted their own paragraph breaks).
   `unfoldV2Description` (`persona-json.ts:101-131`) treats any paragraph that
   doesn't match `/^Appearance:\s*/` or `/^Body:\s*/` as part of `content`,
   preserving order. The codec must replicate this exact heuristic - it is lossy
   by construction (a legitimate content paragraph that happens to start with
   the literal word "Appearance:" would be misdetected) and that lossiness is
   inherited from the live RC implementation, not something to "fix" in the
   codec without a spec change.

3. **`brief` conflict: both `creator_notes` and `description`-derived-`content`
   look brief-shaped** (e.g. a very short `description` on a foreign V2 card
   with no `creator_notes` at all). Per shape 4's map, `creator_notes` wins for
   `brief` when non-empty; when `creator_notes` is empty/absent, `brief` is left
   unset (not backfilled from a truncated `content`) - confirmed by
   `persona-json.ts:173-175` (`description` variable is `null` unless
   `creator_notes` is a non-empty trimmed string).

4. **Name missing.** Every parse path treats `name` as required and fails the
   parse (not just a warning) if absent/empty - `persona.ts` returns an error
   result rather than an entity (`persona-json.ts:274-280`,
   `persona-st.ts:71-76`). The codec's `parse()` must throw or return an error
   result, never synthesize a placeholder name.

5. **PNG has multiple persona-shaped `tEXt` chunks simultaneously** (e.g.
   `rcpersona` AND `chara` both present, from a tool that re-embeds without
   stripping prior chunks). `rcpersona` wins per the detection-priority list;
   the other chunk(s) are NOT merged and NOT necessarily escrowed today (the
   live parser simply never reads them) - codec should escrow the losing
   chunk's raw bytes under its own keyword so the Round-Trip Law can still hold
   for a strict re-serialize, per escrow-and-roundtrip.md rule 1 ("nothing is
   dropped, ever, at parse time"). This is a place Vaudeville's codec is
   intentionally MORE conservative than the live RC importer.

6. **`is_after_dark` boolean vs `contentRating` enum mismatch.** The V2-export
   shape only has a boolean; `rcpersona`'s own schema has a three-way-ish string
   enum (`all_hours` | `after_dark` - no
   documented third value despite the field being freeform `string` in the
   table). Serializing canonical `contentRating` to the V2-export shape drops
   any value other than the two known enum members down to a boolean via
   `=== "after_dark"`; there is no round-trip-safe way to carry an unknown third
   rating value through the V2-export shape. Codec should log a `warnings` entry
   in `SerializeReport` when this narrowing occurs on a nonstandard value.

7. **`data.lorebook` field documented in `PersonaExportData`
   (`persona-export.ts:31-37`, inline `{ name, entries: [{keys, content}] }`) but
   never read by any parser** (not in `png-parser.ts`'s `rolecall_persona` branch,
   not in `persona-json.ts`'s extraction). OPEN QUESTION: is this a dead/aspirational
   field in the live codebase, or does some other import path (not found in this
   pass) consume it? Until confirmed, the codec treats `data.lorebook` as
   write-capable-but-currently-unread by RC itself: escrow it on parse (never
   silently drop), and when serializing to `rcpersona`, populate it only if the
   canonical entity has an actual inline lorebook to embed (which conflicts with
   canonical-model.md's rule that lorebooks are references, not inline blobs -
   see Edge case 8).

8. **`lorebookId` reference vs. `rcpersona`'s inline `data.lorebook` shape.**
   canonical-model.md design rule 3 says embedded lorebooks are references, not
   inline blobs, for Character; this spec extends that rule to Persona for
   consistency, meaning `rcpersona`'s inline-lorebook field (Edge case 7) cannot
   be losslessly round-tripped through the reference-based canonical model
   without a productions-level resolution step (looking up the Lorebook entity
   by `lorebookId` and inlining it at serialize time). OPEN QUESTION: is that
   resolution step in scope for this codec, or does it belong to a higher-level
   `vaud export --format rcpersona` command that has production/library context
   the codec itself doesn't have? Leaning toward the latter (codec stays pure per
   02-ARCHITECTURE.md's `packages/formats` description), but not locked.

9. **ST persona has no portable single-entry export format** (per Behavior
   shape 3). `detect()` cannot recognize "this is an ST persona" from a bare
   text blob with any confidence - a user pasting persona description text has
   to explicitly tell `vaud` "this is persona content," it can't be
   auto-detected the way a PNG chunk or JSON envelope can. OPEN QUESTION: does
   `vaud import --as-persona <file> --format st-text` need to exist as an
   explicit escape hatch, or is plain-text-as-`content` handled by a generic
   "paste text, fill in `content`" codec-agnostic path in the CLI rather than
   this codec at all?

10. **Legacy library-export wrapper unwrapping (Discord 1502802736545009724)
    fixed shape.** The two-layer unwrap in Behavior's "JSON envelope
    unwrapping" section must be applied BEFORE spec-based shape matching, in
    the documented order - reversing the order (unwrap `{persona:...}` before
    the outer `{exportedAt,type,data}` wrapper) fails on the full wrapped shape
    because `.data` at the outer layer does not itself have a `persona` key
    (`persona-json.ts:28-47`).

11. **RoleOut's `content` field renamed/repurposed by the JSON importer's
    generic "loose flat shape" path** vs. the PNG importer's dedicated RoleOut
    branch. `persona-st.ts`'s `importPersonaFromST` maps ST/RoleOut `personality`
    (not `content`) to `content` (`persona-st.ts:60-62`), while
    `png-parser.ts`'s RoleOut branch maps `parsed.content` to the intermediate
    `personality` field which the ST importer then reads. These two RoleOut
    paths are not the same code path and must both be modeled; a fixture from
    each is required (see Test plan).

## Test plan

- `fixtures/persona/rcpersona/minimal.png` - PNG, `rcpersona` keyword, only
  `name` + `content` (a minimal example).
- `fixtures/persona/rcpersona/full-sections.png` - PNG, `rcpersona` keyword, full
  `sections` + `metadata`, empty `content` (exercises section-compile-to-content;
  a full example).
- `fixtures/persona/rcpersona/content-and-sections.json` - bare JSON, both
  `content` and `sections` populated (Edge case 1).
- `fixtures/persona/rc-v2-export/full.json` - bare JSON, mirrors
  `persona-roundtrip.test.ts`'s `fullRcPersona()`/`buildExportV2Card()` fixture
  exactly (every `extensions.rolecall` field populated, `section_order` shuffled
  from the canonical default to prove ordering round-trips).
  `expected.json` field values must match the test's assertions field-for-field
  (`persona-roundtrip.test.ts:207-250`).
- `fixtures/persona/rc-v2-export/full.png` - same data, PNG-embedded via
  `embedCharacterData(..., "chara")`, proving the PNG path reaches the same
  canonical entity as the JSON path.
- `fixtures/persona/foreign-v2/st-as-character-card.json` - mirrors
  `persona-roundtrip.test.ts:397-436`'s Mira-the-Bard fixture: `creator_notes`
  present and distinct from `description`, proving brief/content don't swap.
- `fixtures/persona/foreign-v2/no-creator-notes.json` - foreign V2 card with NO
  `creator_notes`, proving `brief` stays unset rather than being backfilled
  (Edge case 3).
- `fixtures/persona/legacy-wrapper/full-library-export.json` - mirrors
  `persona-roundtrip.test.ts:462-486`'s Lottie fixture (the Discord
  1502802736545009724 regression case), both wrapped and post-unwrap variants.
- `fixtures/persona/roleout/legacy.png` - PNG, `persona` keyword, RoleOut flat
  shape (Edge case 11).
- `fixtures/persona/roleout/legacy-via-st-importer.json` - same data, run
  through the `persona-st.ts` field map instead of the PNG-parser RoleOut
  branch, to pin the two-different-code-paths discrepancy in Edge case 11.
- `fixtures/persona/malformed/invalid-json-in-chunk.png` - `rcpersona` chunk
  with corrupt base64/JSON, a valid `persona` (RoleOut) chunk underneath;
  proves detection falls through per Behavior's "malformed chunk" rule.
- `fixtures/persona/malformed/missing-name.json` - proves Edge case 4 fails
  the parse rather than synthesizing a name.

Round-Trip Law applicability: applies at `semantic` level to the `rcpersona`
shape (parse → serialize → parse must yield deep-equal canonical + escrow) and
to the `rc-v2-export` shape (this is the one real users will most often round-trip,
per the roundtrip test suite's own framing). The `foreign-v2-card` and `roleout`
shapes are import-only in practice today (no live RC code serializes TO RoleOut,
and serializing a Vaudeville-native persona back out AS a bare foreign V2 card
is a capabilities-matrix "escrow into extensions.vaudeville.escrow" case, not a
faithful RoleOut/ST round-trip) - Round-Trip Law is scoped to fixtures where a
real serializer target exists; `foreign-v2-card`/`roleout` fixtures test parse
correctness only, not round-trip, until/unless a serializer target is added.

Property/unit tests beyond fixtures:
- Section-compile order is always `appearance, body, personality, quirks, history`
  regardless of input object key order (JS object key order is not a spec
  guarantee to rely on).
- `unfoldV2Description`-equivalent logic is idempotent: unfolding a string that
  contains no `Appearance:`/`Body:` prefixes returns it unchanged as `content`.
- PNG keyword detection priority (`rcpersona > persona > ccv3 > chara`) holds
  under all 2-of-4 and 3-of-4 combinations, not just all-4-present.

## Non-goals

- This spec does not define SillyTavern's live `settings.json`/persona-position
  injection *behavior* at chat-assembly time - that belongs to
  `specs/formats/prompt-assembly.md`. This spec only defines the data fields
  Vaudeville's canonical model carries so that behavior CAN be reimplemented
  later without data loss.
- This spec does not define the "six house personas" (Understudy, Prompter,
  Props Master, Director, Stage Mother, BYO) that ship with Vaudeville's own
  agent - those are `*.persona.md` voice/behavior files for the AGENT, covered
  by `specs/formats/personas-system.md` (a different concept entirely:
  user-identity persona vs. agent-voice persona happen to share the English
  word "persona" and nothing else).
- This spec does not resolve Edge case 8's inline-lorebook-vs-reference tension;
  that is left as an OPEN QUESTION for the ticket that implements the codec.
- Backyard.ai's persona equivalent (if any) is out of scope for this pass - this
  file covers only ST, RC, legacy RoleOut, and PNG keyword/canonical model as
  required coverage; Backyard-specific persona handling was not researched here
  and should get its own OPEN QUESTION if a future codec spec needs it.

## Sources consulted

- `docs/02-ARCHITECTURE.md`
- `specs/formats/canonical-model.md`
- `specs/formats/escrow-and-roundtrip.md`
- `templates/SPEC-TEMPLATE.md`
- VAUDEVILLE `apps/rc/src/lib/library/png-parser.ts` (:1-280, keyword detection
  and all four parse branches)
- VAUDEVILLE `apps/rc/src/lib/imports/persona.ts` (:1-125, unified PNG importer,
  keyword priority list, envelope routing)
- VAUDEVILLE `apps/rc/src/lib/imports/persona-json.ts` (:1-382, envelope
  unwrapping, V2-card extraction/unfold, loose-shape handling)
- VAUDEVILLE `apps/rc/src/lib/imports/persona-st.ts` (:1-153, ST/RoleOut PNG
  import path, DB insert shape)
- VAUDEVILLE `apps/rc/src/lib/exports/persona-export.ts` (:1-159, `rcpersona`
  JSON builder, PNG embedding, blank-PNG fallback)
- VAUDEVILLE `apps/rc/src/app/api/content/personas/[id]/export/route.ts`
  (:1-311, the live production export route - the actual on-the-wire V2-export
  shape)
- VAUDEVILLE `apps/rc/src/lib/imports/__tests__/persona-roundtrip.test.ts`
  (:1-583, full field-map pinning both directions, incident writeup at :1-31)
- VAUDEVILLE `apps/rc/src/lib/ai/prompt-assembly.ts` (:118-121, `PersonaData`
  interface as used by chat assembly - confirms persona injection is a distinct,
  narrower surface than the full canonical model; out of scope per Non-goals)
- SillyTavern-Docs, `Usage/personas.md`,
  https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/personas.md
  (fetched July 2026; persona field list - name, avatar, description, title,
  position, depth, role, chat-lock, character-lock, default flag; injection
  position options)
- https://docs.sillytavern.app/usage/core-concepts/personas/ (search-result
  corroboration of the same field set)
