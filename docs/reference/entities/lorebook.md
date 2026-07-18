---
id: reference/entities/lorebook
title: Lorebook entity
audience: dev
summary: The canonical superset entity for a lorebook (world info): every LorebookBody and LorebookEntry field, its type, the formats that produce it, and its meaning.
tags: [entity, lorebook, canonical, fields]
related: [reference/architecture, reference/entities/character, reference/formats/rolecall, reference/formats/novelai, reference/concepts/character-book]
---

# Lorebook entity

A `CanonicalLorebook` is `CanonicalEntity<"lorebook", LorebookBody>`: the stable canonical wrapper
(see [architecture.md](../architecture.md)) around a `LorebookBody`, the superset shape that unions
what every real world-info/lorebook format expresses. `src/entities/lorebook/schema.ts` is the source
of truth for the types; this page is the source of truth for what each field MEANS and which formats
produce it.

A lorebook is a set of entries, each a chunk of text that gets injected into the prompt when its
triggers match the recent conversation. Different apps call this world info, lorebook, character book,
or memory; the mechanics are the same. The canonical shape adopts RoleCall's in-memory entry type as its
baseline, a practical superset of SillyTavern World Info, Risu, Agnai, Chub, Lumiverse, and NovelAI's
portable surface, verified against real wire producers (see the escrow section at the end of this page
for what that verification ruled out).

## How to read the field tables

The field tables on this page are generated from the schema by `scripts/docs-fields.ts` and embedded
verbatim. Do not hand-edit a cell: improve the schema doc comment and regenerate, and the docs follow.

- **Field** is the canonical name. A trailing `?` marks an optional field.
- **Type** is the TypeScript type in the schema.
- **Producers** are the source formats named in the field's schema doc comment. A `-` means the doc
  comment names no specific producer. Many such fields are the universal core every format carries
  (`content`, `enabled`, `triggers`, `position`, `depth`); others simply have their provenance
  described in prose rather than tagged inline.
- **Meaning** is what the field is for. A blank Meaning cell is a self-evident primitive named by its
  own field, and marks a field the schema doc comment did not annotate. Non-obvious fields carry their
  meaning from the schema doc comment. Any richer explanation lives in the prose around a table, never
  inside a cell.

## Composition

`LorebookBody` is book-level settings (identity, categorization, matching defaults, budget) plus two
lists: `entries: LorebookEntry[]`, the triggerable content, and an optional `categories?:
LorebookCategory[]` for folder grouping. Unlike `CharacterBody`, the schema does not split
`LorebookEntry`'s roughly 48 fields into named sub-interfaces: it is one flat interface, matching
RoleCall's own flat in-memory entry type. This page groups those fields by concern in the sections
below for readability; the schema itself, and the generated table, keep them flat.

@fig composition

The sections below walk each group. Every field table on this page is pasted verbatim from
[docs/generated/fields.lorebook.md](../../generated/fields.lorebook.md).

## Book settings

Identity, categorization, the matching defaults every entry inherits unless it overrides them, and the
injection budget for the whole book.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | - |  |
| `description?` | `string \| null` | - |  |
| `lorebookType?` | `LorebookType \| null` | - |  |
| `genre?` | `string \| null` | - |  |
| `fandom?` | `string \| null` | - |  |
| `tags` | `string[]` | - |  |
| `enabled?` | `boolean` | RC | Book-level on/off for the shelf + Press export filter. Default true when absent (older books). RC can round-trip it; other formats ignore (deny by absence). |
| `globalCaseSensitive` | `boolean` | - | global matching defaults; entries with null matching options inherit these |
| `globalMatchWholeWords` | `boolean` | - |  |
| `globalScanDepth` | `number` | - |  |
| `globalRecursion` | `boolean` | - |  |
| `tokenBudget` | `number` | - |  |
| `budgetMode` | `"token" \| "entry"` | - |  |
| `entryBudget` | `number` | - |  |
| `entries` | `LorebookEntry[]` | - |  |
| `categories?` | `LorebookCategory[]` | - |  |

`lorebookType` is an open-ish role tag: `"world" | "character" | "scenario" | "rules" | "utility" |
"other"`. `globalMatchWholeWords`, `globalScanDepth`, and `globalRecursion` share the same intent as
`globalCaseSensitive` (book-wide matching defaults) even though only the first field's row carries the
schema doc comment; a blank Meaning cell here is the "self-evident primitive" convention from above,
not a different rule. `budgetMode` decides whether `tokenBudget` or `entryBudget` is the active cap.

### LorebookCategory

A folder grouping entries within a lorebook. An entry joins one via `categoryId`.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `id` | `string` | - |  |
| `name` | `string` | - |  |
| `sortOrder` | `number` | - |  |
| `enabled?` | `boolean` | - |  |

## Entries

A `LorebookEntry` is one triggerable chunk: content, plus the conditions under which it fires and where
it lands in the assembled prompt. `id` is stable across round-trips; it is what `categoryId` and the
escrow twin-matching logic reference. The full generated table is below; the concern groups that follow
it are this page's own organization, not separate TypeScript shapes.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `id` | `string` | - | stable entry id, preserved across round-trips (categories reference it) |
| `title` | `string` | ST | entry label (maps to ST `comment`) |
| `content` | `string` | - |  |
| `comment?` | `string \| null` | RC, ST | internal creator note; distinct from title, has no ST home (RC-only) |
| `enabled` | `boolean` | - |  |
| `constant` | `boolean` | - | always inject regardless of keyword match |
| `triggerMode` | `"simple" \| "advanced"` | - |  |
| `triggers` | `Trigger[]` | - |  |
| `secondaryTriggers` | `Trigger[]` | - |  |
| `selectiveLogic` | `SelectiveLogic` | - |  |
| `caseSensitive` | `boolean \| null` | - | null = inherit the lorebook global |
| `matchWholeWords` | `boolean \| null` | - |  |
| `scanDepth` | `number \| null` | - |  |
| `position` | `InjectionPosition` | - |  |
| `depth` | `number` | - | used when position is "depth" or "append" |
| `role` | `MessageRole` | - |  |
| `sortOrder` | `number` | CCv3, RC, ST, Risu, Agnai | Placement / insertion order: where the entry lands relative to its siblings in the assembled prompt. The universal ordering axis - ST `order`, Risu `insertorder`, CCv3 `insertion_order`, Agnai `weight`, RC `sortOrder`. (ST's cosmetic `displayIndex` is a distinct display axis with only one source format, so it rides original, not a canonical slot.) |
| `priority` | `number` | CCv3, RC, ST, Risu, Agnai | Eviction / budget priority: which entries survive when the token budget is exceeded (higher survives). A separate axis from placement - CCv3 `priority`, Agnai `priority`, RC `priority`. Formats with no eviction field (ST, Risu) default this to 100. |
| `sticky` | `number` | - |  |
| `cooldown` | `number` | - |  |
| `delay` | `number` | - |  |
| `groupName` | `string \| null` | - |  |
| `categoryId` | `string \| null` | - | references a LorebookCategory.id |
| `groupWeight` | `number` | - |  |
| `probability` | `number` | - | entry-level activation chance 0-100 (fallback for simple triggers) |
| `useMemo` | `boolean` | - |  |
| `excludeRecursion` | `boolean` | - | will NOT be found during recursion (direct matches only) |
| `preventRecursion` | `boolean` | - | this entry's content will NOT trigger other entries |
| `delayUntilRecursion` | `number` | - | only activate at recursion level N (0 = first pass) |
| `characterFilter` | `CharacterFilter \| null` | - |  |
| `scanCharacterDescription` | `boolean` | - |  |
| `scanCharacterPersonality` | `boolean` | - |  |
| `scanUserPersona` | `boolean` | - |  |
| `scanScenario` | `boolean` | - |  |
| `scanCharacterDepthPrompt?` | `boolean` | ST | extra ST worldinfo scan sources (undefined = not produced by this format / off) |
| `scanCreatorNotes?` | `boolean` | - |  |
| `ignoreBudget` | `boolean` | - | bypass token budget - always inject |
| `vectorized?` | `boolean` | ST | Authored ST-lineage entry toggles that only some formats carry (optional: undefined = the format has no such field, distinct from an explicit false a producer set). First-classed per the schema-is-editor doctrine, not original. `vectorized` is the RAG toggle (the SETTING, not the vectors, which stay original); `groupOverride`/`useGroupScoring` extend the groupName/groupWeight mutual-exclusion axis; `automationId` binds an entry to a Quick-Reply automation by id (the id only, the automation set stays original). |
| `groupOverride?` | `boolean` | - |  |
| `useGroupScoring?` | `boolean` | - |  |
| `automationId?` | `string \| null` | - |  |
| `keyRelative?` | `boolean` | NovelAI | NovelAI: keys match relative to the entry's own insertion point, not the story tail |
| `nonStoryActivatable?` | `boolean` | NovelAI | NovelAI: entry can activate outside story text (e.g. from a UI action) |
| `contextConfig?` | `EntryContextConfig` | NovelAI | NovelAI authored per-entry assembly config (prefix/suffix/trim/budget dials) |
| `loreBiasGroups?` | `LoreBiasGroup[]` | NovelAI | NovelAI phrase bias groups (loreBiasGroups on wire) |
| `displayIndex?` | `number \| null` | ST | Creator's manual display order in the editor list - a DISTINCT authored axis from `sortOrder` (placement in the assembled prompt). Real ST cards prove they diverge (Seraphina: sortOrder all 100, displayIndex 0-3), so it is NOT regenerable from sortOrder. null/undefined = follow sortOrder. |
| `sideEffects` | `EntrySideEffects \| null` | - |  |
| `metadata?` | `Record<string, unknown>` | - | extensible bag for format-specific data with no first-class home |

### Identity and content

`title` is the display name (ST's `comment` field). `comment` is a separate internal authoring note
RoleCall carries; ST has no field for it distinct from the title, so it always canonicalizes to `null`
on an ST import. `content` is the injected text itself.

### Triggers and matching

`triggers` and `secondaryTriggers` are keyword/regex lists that gate activation; `selectiveLogic` picks
how the secondary set combines with the primary (`and_any`, `and_all`, `not_any`, `not_all`).
`triggerMode` is `"advanced"` when triggers carry their own per-trigger `probability`, overriding the
entry-level fallback, and `"simple"` otherwise. `caseSensitive`, `matchWholeWords`, and `scanDepth` are
per-entry overrides of the book's global defaults; `null` inherits.

### Trigger

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `keyword` | `string` | - |  |
| `isRegex` | `boolean` | - |  |
| `flags?` | `string` | - | regex flags: g, i, m, s, u, y |
| `frequency?` | `number` | - | min messages that must pass before this trigger can re-activate its entry |
| `probability?` | `number` | - | advanced mode only: per-trigger activation chance 0-100, overrides the entry fallback |

A regex trigger is encoded on the wire as `/pattern/flags`; `isRegex` and `flags` carry that
structurally in canonical instead of a delimited string.

### Injection and placement

`position` picks where the content lands in the assembled prompt: `"world"` / `"character"` are the
portable floor every format has (SillyTavern's before/after the character definition); the rest are
richer positions that degrade to the floor on downcast to a CCv2 `character_book` (see
[concepts/character-book.md](../concepts/character-book.md)). `depth` applies when `position` is
`"depth"` or `"append"`. `role` is which chat role (`"system"` / `"user"` / `"assistant"`) the injected
text speaks as.

### Ordering, timing, and grouping

`sortOrder` and `priority` are two distinct axes: `sortOrder` is placement in the assembled prompt (the
universal ordering axis every format carries under some name), `priority` is eviction priority when the
token budget is exceeded (higher survives). A third, separate axis, `displayIndex`, is covered under
"ST-lineage toggles" below. `sticky`, `cooldown`, and `delay` are turn-counted timing. `groupName` puts
entries into an inclusion group where only some of them fire, weighted by `groupWeight`; `categoryId`
links to a `LorebookCategory` instead, a purely organizational axis unrelated to activation. `probability`
is the entry-level activation chance, the fallback used by simple-mode triggers.

### Recursion and budget

`excludeRecursion` keeps the entry from being found by another entry's recursive scan; `preventRecursion`
keeps the entry's own content from triggering others. `delayUntilRecursion` gates the entry to a specific
recursion pass. `ignoreBudget` always injects the entry regardless of the book's token budget. `useMemo`
marks the entry as a client-specific memo.

### Scan sources

`scanCharacterDescription`, `scanCharacterPersonality`, `scanUserPersona`, and `scanScenario` extend
keyword matching to that extra text, beyond the chat itself. `scanCharacterDepthPrompt` and
`scanCreatorNotes` do the same for two SillyTavern-only extra sources; undefined means the producing
format has no such field, not that scanning is off. `scanCreatorNotes` carries no producer tag of its
own in the generated table (its schema doc comment sits above `scanCharacterDepthPrompt`, covering both
together), but the SillyTavern codec (`src/formats/sillytavern/lorebook.ts`) confirms it round-trips
`matchCreatorNotes` directly, same as its sibling.

### Filters and side effects

`characterFilter` whitelists or blacklists the entry to specific characters or character tags.
`sideEffects` is a list of variable mutations to run when the entry activates: declarative data vaud
never executes.

### CharacterFilter

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `names` | `string[]` | - |  |
| `tags` | `string[]` | - |  |
| `isExclude` | `boolean` | - |  |

### EntrySideEffect

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `type` | `SideEffectType` | - |  |
| `variable` | `string` | - |  |
| `value?` | `string` | - | for setvar |
| `amount?` | `number` | - | for addvar/incvar/decvar |
| `scope` | `"local" \| "global"` | - |  |

`type` is one of `"setvar" | "addvar" | "incvar" | "decvar" | "delvar"`, declarative data only, never
executed by the converter or editor.

### EntrySideEffects

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `effects` | `EntrySideEffect[]` | - |  |
| `onlyOnFirstTrigger` | `boolean` | - |  |
| `clearOnDeactivate` | `boolean` | - |  |

### ST-lineage toggles

`vectorized`, `groupOverride`, `useGroupScoring`, `automationId`, and `displayIndex` are authored
SillyTavern-lineage fields, first-classed under the schema-is-editor doctrine even though only ST
currently serializes them (see the schema.ts doc comment: single-platform is not a reason to leave an
authored field in escrow). `vectorized` is the RAG toggle, the setting rather than the vectors
themselves, which stay in escrow. `groupOverride` / `useGroupScoring` extend the `groupName` /
`groupWeight` mutual-exclusion axis. `automationId` binds the entry to a Quick-Reply automation by id
only; the automation itself stays in escrow. `displayIndex` is the creator's manual list order in the ST
editor, a distinct authored axis from `sortOrder`: real cards prove they diverge (one card sorts every
entry `100` on `sortOrder` but `0` through `3` on `displayIndex`), so it is never regenerated from
`sortOrder`.

### NovelAI extensions

`keyRelative` and `nonStoryActivatable` are NovelAI-only trigger behavior toggles. `contextConfig` is
NovelAI's authored per-entry assembly config: prefix/suffix text, trim strategy, and a token budget local
to the entry. `loreBiasGroups` carries NovelAI's phrase-bias groups, a signed logit bias applied while
the entry is (or, with `whenInactive`, is not) active.

### EntryContextConfig

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `prefix?` | `string` | - | text prepended to the entry when inserted |
| `suffix?` | `string` | - | text appended to the entry when inserted |
| `tokenBudget?` | `number` | - | per-entry token budget cap |
| `reservedTokens?` | `number` | - | tokens reserved so the entry is not trimmed away |
| `trimDirection?` | `string` | - | trim strategy: "doNotTrim" \| "trimBottom" \| "trimTop" (open: NAI may add values) |
| `insertionType?` | `string` | - | join strategy: "newline" \| "space" \| "token" |
| `maximumTrimType?` | `string` | - | trim granularity: "sentence" \| "newline" \| "token" |
| `insertionPosition?` | `number` | - | signed offset within the target context section (NOT canonical depth - a different axis) |

NAI's `budgetPriority` is deliberately not modeled here: it is the placement axis and lives in
`sortOrder`, one home per axis, same as the `sortOrder` / `priority` split above.

### LoreBiasPhrase

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `sequence?` | `string` | - |  |
| `sequences?` | `string[]` | - |  |
| `type?` | `number` | - | NAI phrase type (int on wire; open enum) |

### LoreBiasGroup

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `enabled` | `boolean` | - |  |
| `bias` | `number` | - | signed strength (e.g. -0.5, 0.2) |
| `phrases` | `LoreBiasPhrase[]` | - |  |
| `whenInactive?` | `boolean` | - |  |
| `generateOnce?` | `boolean` | - |  |
| `ensureSequenceFinish?` | `boolean` | - |  |

### Metadata

`metadata` is an open bag for format-specific data with no first-class canonical home.

## What rides escrow, not a field

Per the superset rule (see [architecture.md](../architecture.md)), a field earns a canonical slot only
if some real wire format serializes it. Rides escrow, because no serializer emits it: five RoleCall
in-memory-only fields, `allowRecursion`, `boostIds`, `boostAmount`, `scanPreset`, and `probabilityMode`,
fail that gate. The schema.ts doc comment records them as verified absent from `packages/lorebook`'s
`serializeEntryToRoleCallV1` and parser, and that its parser hardcodes them as defaults with its own
comment that the RC schema does not have them yet; `packages/lorebook` is an external VAUDEVILLE-platform
source, not in this repository, so that claim rides on the schema comment rather than an independent
read here. This repo's own `src/formats/rolecall/lorebook.ts` corroborates it as far as it can: none of
the five field names appear anywhere in that codec.

Separately, format-specific wire bytes ride via the escrow raw-twin mechanism so a same-format
round-trip stays lossless, without becoming canonical fields themselves: SillyTavern's entry `uid` (used
to derive the canonical `id` on import, then re-emitted untouched from the raw twin on export) and
RoleCall's export envelope extras (`tree`, `exportDate`, per-entry `unsupportedFields`, trigger runtime
state) all round-trip this way.

Does NOT ride escrow, because it is modeled: SillyTavern's two extra scan sources
(`matchCharacterDepthPrompt` / `matchCreatorNotes`) are first-classed as `scanCharacterDepthPrompt` and
`scanCreatorNotes` above, along with `vectorized`, `groupOverride`, `useGroupScoring`, `automationId`,
and `displayIndex`. These are authored ST wire fields a creator sets, not in-memory residue, so the
schema-is-editor doctrine puts them on the canonical entry even though only one format produces them
today.

## See also

- [architecture.md](../architecture.md): the canonical model, escrow, hub-and-spoke, the adapter contract.
- [entities/character.md](character.md): the character superset, linking here via `knowledgeRefs`.
- [concepts/character-book.md](../concepts/character-book.md): how an embedded `character_book` is extracted into a standalone lorebook on import and re-embedded on export.
- [formats/rolecall.md](../formats/rolecall.md): the format the canonical entry shape is baselined on.
- [formats/novelai.md](../formats/novelai.md): the source of the NovelAI-only extension fields (`contextConfig`, `loreBiasGroups`, `keyRelative`, `nonStoryActivatable`).
- [formats/README.md](../formats/README.md): the coverage matrix of every format and the fields it produces.
