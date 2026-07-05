# Format: RoleCall

RoleCall (RC) is Vaudeville's own roleplay client. Its card is a Character Card V3 with an
`extensions.rolecall` block, a casting-card presentation layer, and a sprite/asset model. Its lorebook is
a dedicated v1 export envelope. Two codecs in one folder:

- Character: `id: "rolecall"`, kind `character`, container PNG or JSON, writes `.json`.
- Lorebook: `id: "rolecall-lorebook"`, kind `lorebook`, container JSON, writes `.json`.
- Source: `src/formats/rolecall/index.ts` (character) and `src/formats/rolecall/lorebook.ts` (lorebook).

Because RC is Vaudeville's own product, its source can be reused freely (unlike the GPL formats, which
are interop-facts-only). The canonical lorebook model is seeded from RC's own richer in-memory type.

## Character card

### Detection

`detect()` returns `1.0` when the card is a CCv2/V3 card **and** carries an `extensions.rolecall` block,
`0` otherwise. The `1.0` outranks the generic SillyTavern reader's `0.9` on the same card, so RC gets to
map its own layer (presentation, graded rating, sprites) instead of being read as a plain Tavern card.

### What RC adds over plain Tavern

On top of the shared CCv2/V3 `data` mapping (`_shared/tavern-fields.ts`), the RC adapter maps:

| Canonical | RC source |
| --- | --- |
| `discovery.rating` | graded content rating (all_hours / late_night / after_dark) |
| `greetings.alternateGreetings[].title` | `alternate_greeting_titles` |
| `presentation.*` | RC casting-card: accent color, gradient, palette, curated background, field order, spoilers |
| `prompts.depthInjections` | details injections (origin `rolecall_details`) CONCAT with the shared `extensions.depth_prompt` entry (origin `depth_prompt`); each re-emits to its own home |
| `attribution.sourceUrl` | `source_url` |
| `media.assets` | sprite / expression pack (real RC emits `type:"expression"` -> canonical role `emotion`) |

Two quirks worth knowing: RC's V3 `source` is a nonstandard OBJECT array (`[{name}]`, not the spec's
string[]); the provenance is first-class on `attribution.creator` and the object form rides the twin
untouched (the shared mapper never writes an empty decoded `source` over a twin). And both depth-injection
sources coexist: an earlier codec version REPLACED the array with the details injections, clobbering the
`depth_prompt` entry - fixed with regression tests on the real sample.

### Escrow

The whole card rides in `escrow.rolecall.raw`, so an RC -> canonical -> RC round-trip reproduces every
field, including any with no canonical home. The interop map is recorded in `design/RC-CARD-FORMAT.md`.

## Lorebook (v1 export)

### Detection

`detect()` returns `1.0` for a RoleCall v1 export: a `{ schemaVersion, exportDate, lorebook }` envelope
where `lorebook.entries` is an array and `schemaVersion` is `1.0.0`-family. Returns `0` otherwise. This
envelope is unambiguous, so there is no collision with the ST worldbook (which has a top-level `entries`
object and no `lorebook` wrapper).

### Field map: nested wire, flat canonical

The canonical lorebook entry is flat, but the RC v1 wire nests each entry into named groups. The codec
re-nests on export and flattens on import:

| Canonical | RC v1 wire group |
| --- | --- |
| `triggers`, `secondaryTriggers`, `selectiveLogic`, `triggerMode` | `triggers.{primary,secondary,selectiveLogic,mode}` |
| `caseSensitive`, `matchWholeWords`, `scanDepth` | `matching.*` |
| `position`, `depth`, `role` | `injection.*` |
| `sortOrder`, `priority` | `priority.*` |
| `sticky`, `cooldown`, `delay` | `timing.*` |
| `groupName`, `categoryId`, `groupWeight` | `grouping.*` |
| `useMemo`, `excludeRecursion`, `preventRecursion`, `delayUntilRecursion`, `ignoreBudget` | `advanced.*` |
| `scanCharacterDescription` etc. | `scanSources.*` |
| `probability`, `sideEffects`, `metadata` | top-level on the entry |

Book-level settings map to `lorebook.settings.*` and `lorebook.metadata.*`; categories to
`lorebook.categories`.

RC v1 emits exactly four scan sources (characterDescription, characterPersonality, userPersona,
scenario). It uses a per-trigger probability (advanced trigger mode), which the canonical `Trigger`
carries and which ST cannot represent.

### Escrow

The whole parsed export rides in `escrow["rolecall-lorebook"].raw`, so raw-only carriers the canonical
body does not model (the category `tree`, `exportDate`, per-entry `unsupportedFields`, trigger runtime
state) survive a round-trip verbatim. Export overlays the canonical body onto a clone of the raw wire and
matches entries by id; a from-scratch canonical (no escrow) serializes fresh defaults.

## Persona codec (`rolecall-persona`, kind `persona`)

The USER-identity entity - {{user}}'s voice, first person. Two shapes, both claimed at `1.0`:

- **`rcpersona`** - the native envelope `{ spec: "rolecall_persona", spec_version, data }`. `data.description`
  is the BRIEF (library blurb), `data.content` the injected text; when `content` is empty, `sections`
  compile in fixed order (appearance, body, personality, quirks, history) as `"Label: text"` blocks.
  Canonical keeps BOTH content and sections so the editor can offer structured editing either way.
- **RC's production persona export** - a `chara_card_v2` lookalike whose `extensions.rolecall.type` is
  the literal `"persona"`. The V2 `description` slot is a FOLD of content + `Appearance:`/`Body:`
  paragraphs (unfolded on read, re-folded on write); `creator_notes` carries the brief; `personality`/
  `scenario` carry the personality/history sections; the side-channel carries identity attrs, theming,
  section_order, lorebook linkage, and `is_after_dark` (omitted-not-false).

The load-bearing rule of the family: `brief` and `content` never swap (that exact swap was a live RC
production bug, pinned by RC's persona-roundtrip suite; vaud replicates the FIXED behavior). Legacy
library-export wrappers (`{exportedAt,type,data}` then `{persona}`) unwrap outer-first before shape
matching. A missing name fails the parse - never synthesized.

**Cross-kind firewall:** RC's persona export is byte-shaped like a character card, so the RC CHARACTER
adapter explicitly returns 0 on `type === "persona"` (else the two tie at 1.0) and its `toCanonical`
refuses with a pointer to this codec. Cross-format emit target is the native `rcpersona` envelope.
Pending, per spec: the PNG keyword scan (`rcpersona` > `persona` > `ccv3` > `chara`), legacy RoleOut,
and the explicit foreign-V2-as-persona import path.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter | `src/formats/rolecall/index.ts` |
| Lorebook codec | `src/formats/rolecall/lorebook.ts` |
| Card interop map | `design/RC-CARD-FORMAT.md` |
| Lorebook interop reference | VAUDEVILLE `packages/lorebook` (schemas + serializer + parser) |
