---
id: reference/formats/novelai
title: NovelAI format
audience: dev
summary: How the NovelAI lorebook adapter detects, maps, and round-trips native lorebook exports through the canonical model.
tags: [format, novelai, lorebook]
related: [reference/architecture, reference/entities/lorebook]
---

# NovelAI format

NovelAI is a text-generation service whose portable roleplay artifact is a lorebook, exported as a
`.lorebook` (or plain `.json`) file. NovelAI has no character-card concept, so this family ships exactly
one codec: a native lorebook reader/writer. `src/formats/novelai/index.ts` default-exports it directly,
no array of codecs to pick from (`index.ts:8`).

- `id: "novelai-lorebook"`, kind `lorebook`, container JSON, writes `.lorebook`.
- Source: `src/formats/novelai/lorebook.ts`.

For the canonical field meanings this format maps onto, see
[entities/lorebook.md](../entities/lorebook.md). For the hub-and-spoke, escrow, and detection model, see
[architecture.md](../architecture.md). For the whole matrix of formats, see
[FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md). No `specs/formats/*.md` or `design/*.md` provenance doc
exists for NovelAI in this repo; everything below is read directly from the adapter, its tests, and the
committed samples.

## Detection

`detect()` returns `1.0` when the parsed JSON has a numeric `lorebookVersion` **and** an array `entries`,
`0` otherwise (`lorebook.ts:399-403,412-414`). Unlike SillyTavern's generic `0.9` (which yields the ceiling
score to a more specific reader on the same wire shape), nothing else in the registry claims this exact
pair, so `1.0` is not being defended against a collision, it is just the plain top score.

Three shapes are confirmed to score `0` (`lorebook.test.ts:16-21`):

- A SillyTavern worldbook keys `entries` as an **object** (`{ "0": {...} }`), not an array.
- A Risu export is wrapped in `{ type: "risu", ... }`, with no top-level `lorebookVersion`.
- `{ lorebookVersion: 3 }` alone, with no `entries` array, is not enough.

Detection does not sniff the specific `lorebookVersion` value; `3`, `4`, and `6` all pass the same
`typeof === "number"` check (`lorebook.ts:401`), because only entry-level richness differs across
versions, not the top-level shape.

## Field map

NovelAI entry field names differ from CCv3 throughout. `keys[]` carry their own inline `/pattern/flags`
delimiters, so the codec reuses the shared `character_book` keyword decoder
(`keywordToTrigger` / `triggerToKeyword`, `_shared/character-book.ts:131-139,324`) with `forceRegex: false`,
since a plain NAI key with no delimiters is never forced into a regex (`lorebook.ts:37,200-202,337`).

| NAI wire | Canonical (`LorebookEntry`) | Notes |
| --- | --- | --- |
| `text` | `content` | `lorebook.ts:209` |
| `displayName` | `title` | Falls back to `Entry N` when blank. `lorebook.ts:203` |
| `id` (v6 uuid only) | `id` | Falls back to the array index when absent (v3/v4). `lorebook.ts:207` |
| `keys[]` | `triggers` | Inline `/pattern/flags` decoded; a bare string stays literal. `lorebook.ts:200-202` |
| (none) | `comment` | Always `null`; NAI has no separate note field. `lorebook.ts:210` |
| `enabled` | `enabled` | Defaults on. `lorebook.ts:212` |
| `forceActivation` | `constant` | `lorebook.ts:213` |
| (none) | `triggerMode` | Always `"simple"`; NAI has no secondary-key / selective mode. `lorebook.ts:215` |
| (none) | `secondaryTriggers`, `selectiveLogic` | Always `[]` and `"and_any"`. `lorebook.ts:217-218` |
| `searchRange` | `scanDepth` | Unit is characters, not messages; see the caveat below. `lorebook.ts:224` |
| (none) | `position`, `depth`, `role` | Always `"character"`, `4`, `"system"`. NAI has no before/after-char slot; the real authored offset lives in `contextConfig.insertionPosition`, not here. `lorebook.ts:228-230` |
| `contextConfig.budgetPriority` | `sortOrder` | NAI's single placement axis (higher inserts first); excluded from the `contextConfig` block below so it has exactly one canonical home. `lorebook.ts:204,232` |
| (none) | `priority` | Always `100`; NAI has no eviction axis. `lorebook.ts:233` |
| (none) | `sticky`, `cooldown`, `delay` | Always `0`. `lorebook.ts:235-237` |
| (none) | `groupName` | Always `null`. `lorebook.ts:239` |
| `category` | `categoryId` | `""` maps to `null`. `lorebook.ts:242` |
| (none) | `groupWeight` | Always `1`. `lorebook.ts:243` |
| (none) | `probability` | Always `100`; NAI has no per-entry activation chance. `lorebook.ts:245` |
| (none) | `useMemo`, `excludeRecursion`, `preventRecursion`, `delayUntilRecursion`, `ignoreBudget` | Always `false` / `0`. `lorebook.ts:247-259` |
| (none) | `characterFilter` | Always `null`. `lorebook.ts:252` |
| (none) | `scanCharacterDescription` etc. | Always `false`; NAI has no extra scan-source toggles. `lorebook.ts:254-257` |
| `keyRelative` | `keyRelative` | Present-or-absent read; authored activation toggle. `lorebook.ts:262` |
| `nonStoryActivatable` | `nonStoryActivatable` | `lorebook.ts:263` |
| `contextConfig` (minus `budgetPriority`) | `contextConfig` | The authored assembly dials; see below. `lorebook.ts:162-177,264` |
| `loreBiasGroups` | `loreBiasGroups` | Authored phrase bias; see below. `lorebook.ts:99-141,265` |
| `categories[]` | `body.categories` | Flat authored surface (`id`, `name`, `enabled`); `sortOrder` is the list index, not a wire field. `lorebook.ts:277-285,304` |
| (file has none) | `body.name` | Always `""`; the export carries no book-level name (it lives on the file / UI). `lorebook.ts:290` |
| (file has none) | `body.globalScanDepth`, `tokenBudget`, `entryBudget` | Always `0`. `lorebook.ts:298-302` |

`budgetPriority` is placement, not eviction, despite the name: the real v3 fixture's two Mal entries carry
`400` then `399`, a descending insertion sequence, matched by the reader (`lorebook.test.ts:29,44`) and
guarded on write by a regression test asserting the string `"priority"` never appears in a serialized
entry (`lorebook.test.ts:165-174`).

### Enums are strings on the wire

`trimDirection`, `insertionType`, and `maximumTrimType` are plain strings in both real samples on hand (a
v3 slice and a v6 export), and the schema comment records them as an open string union rather than a
closed enum, on the assumption NAI may add values (`entities/lorebook/schema.ts:103-108`). The codec does no int-to-string
decoding for these three fields; whatever string the export carries is read and written as-is.

### The `searchRange` unit caveat

NAI's `searchRange` is measured in characters of story text; SillyTavern's `scanDepth` is measured in
messages. Both map to canonical `scanDepth` because it is the closest home for "how far back to scan," and
the exact number round-trips losslessly through escrow on a same-format NAI round-trip. But a cross-format
import into a messages-based format carries the number verbatim with no unit conversion, so a NAI `1000`
(characters) becomes `1000` (messages) downstream. That is documented drift, not a bug, and it does not
affect a same-format NAI round-trip.

### The `contextConfig` assembly block

`EntryContextConfig` (`entities/lorebook/schema.ts:94-111`) is read field-by-field, skipping any wire key
that is absent so a deep-equality diff against the twin's re-decode stays stable (`lorebook.ts:162-177`):

| NAI `contextConfig` field | Canonical field | Notes |
| --- | --- | --- |
| `prefix` | `prefix` | Authored text prepended on insertion, e.g. `"[ Mal: "`. |
| `suffix` | `suffix` | Authored text appended, e.g. `" ]\n"`. |
| `tokenBudget` | `tokenBudget` | Per-entry token cap. |
| `reservedTokens` | `reservedTokens` | Tokens reserved so the entry is not trimmed away. |
| `trimDirection` | `trimDirection` | `"doNotTrim"` / `"trimBottom"` / `"trimTop"` seen in samples. |
| `insertionType` | `insertionType` | `"newline"` seen in every sample. |
| `maximumTrimType` | `maximumTrimType` | `"sentence"` seen in every sample. |
| `insertionPosition` | `insertionPosition` | Signed offset within the target context section; a different axis than canonical `position`/`depth`. |
| `budgetPriority` | (excluded) | Lives in `sortOrder` alone; deliberately not duplicated into this block (`entities/lorebook/schema.ts:91-92`). |

### Phrase bias (`loreBiasGroups`)

`LoreBiasGroup[]` (`entities/lorebook/schema.ts:117-136`) is first-class canonical, not escrow. The reader
tolerates two casings for three boolean fields (`lorebook.ts:123-137`). The real v6 sample confirms the
dual-casing habit for two of them, `generateOnce`/`generate_once` and `ensureSequenceFinish`/
`ensure_sequence_finish`; its `whenInactive` values appear only in camelCase, never doubled with
`when_inactive` (`samples/novelai/nai-v6-crystal-dragon.lorebook.json`). The v3 fixture carries no
`loreBiasGroups` at all, so it is not a second data point here:

| NAI wire (either casing accepted) | Canonical `LoreBiasGroup` |
| --- | --- |
| `enabled` | `enabled` |
| `bias` | `bias` (signed strength, e.g. `-0.5`, `0.2`; defaults to `0` if missing/non-numeric) |
| `phrases[].sequence`, `.sequences[]`, `.type` | `phrases[].sequence`, `.sequences`, `.type` (`type` is NAI's numeric phrase-type enum, carried open) |
| `whenInactive` / `when_inactive` | `whenInactive` |
| `generateOnce` / `generate_once` | `generateOnce` |
| `ensureSequenceFinish` / `ensure_sequence_finish` | `ensureSequenceFinish` |

## Escrow and round-trip

On import, `toCanonical` stores only the whole raw lorebook, verbatim, at `original["novelai-lorebook"].raw`
(`lorebook.ts:425`; the escrow envelope itself is `canonical.ts:39-51,80`). No `unmapped` block and no
`sourceMedia` twin: this is a text format with nothing binary to carry.

`fromCanonical` overlays the canonical body onto that twin, matching each entry by `id` when the source is
v6 (a real uuid) or by array index when it is v3/v4 (no `id` field on the wire at all, confirmed by the v3
fixture) (`lorebook.ts:366-375`). Per changed top-level scalar or array field the wire is set outright to
the canonical value (`triggers`, `title`, `content`, `enabled`, `constant`, `scanDepth`, `categoryId`); an
untouched field comes straight from the twin clone. Three nested blocks do not follow that same clean
per-field replace, and the differences are real, not cosmetic:

- **`contextConfig` is merged onto the twin, not replaced.** A changed `contextConfig` is spread over
  `base.contextConfig ?? <default shell>` (`lorebook.ts:345-347`). A canonical edit that drops a key the
  twin used to carry does **not** clear that key on the wire; only keys actually present in the new
  canonical value overwrite. This is deliberate ("unknown twin keys survive the spread", per the code
  comment at `lorebook.ts:343-344`) so a real export's undocumented dials are never silently dropped, but
  it means you cannot un-set a single `contextConfig` dial by omitting it, only by setting a new value.
- **`loreBiasGroups` is a clean replace-or-delete.** A changed value either writes the fully re-encoded
  array or, if empty, deletes the wire key outright (`lorebook.ts:356-360`). Editing a bias group also
  drops the redundant snake_case duplicate keys a real export carries (`when_inactive`, `generate_once`,
  `ensure_sequence_finish`): `writeBiasGroups` emits camelCase only (`lorebook.ts:144-160`). An **untouched**
  entry's bias group rides the twin clone verbatim and keeps both casings.
- **`categories` can be added, renamed, or toggled, but not bulk-cleared.** The write path only rebuilds
  `base.categories` when the canonical list is non-empty (`lorebook.ts:379`); setting `body.categories` to
  `[]` on a book that had categories leaves the wire's `categories[]` untouched. A category present in the
  canonical list is matched to its twin by `id` and overlaid; a brand-new id gets a minimal `{ id, order: [] }`
  row (`lorebook.ts:384-391`).

What legitimately rides the twin untouched, with no canonical slot at all:

- `lorebookVersion` (format bookkeeping; always re-read from the twin or defaulted to `3`, never settable
  from canonical) and a top-level `order` array some exports carry alongside `entries`/`categories`
  (`lorebook.ts:78-84,374`).
- Entry `lastUpdatedAt` (v6 only): never read by `entryToCanonical` (`lorebook.ts:199-269`), distinct from
  the entry `id`, which **is** the canonical `id`.
- Category `open` (UI expand/collapse state) and the rich subcontext machinery on each category
  (`createSubcontext`, `subcontextSettings`, `categoryDefaults`, `categoryBiasGroups`, the category's own
  `order` array, which is an entry-id list, not a rank). `categoriesToCanonical` reads only `id`, `name`,
  and `enabled` off each category (`lorebook.ts:277-285`); everything else survives solely because the
  write path clones the twin category before overlaying edits (`lorebook.ts:384-391`). Field names
  confirmed present in `samples/novelai/nai-v6-crystal-dragon.lorebook.json`.
- Book-level `settings` (e.g. `orderByKeyLocations`).
- `advancedConditions[]` on each entry: present but `[]` in every sample seen, so its element shape is
  ungrounded and deliberately not modeled (`lorebook.ts:19`).

Verified round-trip behavior (`lorebook.test.ts`): a same-format re-emit of the committed v3 fixture is
byte-identical (`:47-51`); editing one field on that fixture rewrites only that field while a sibling entry
and the `categories[]` block stay byte-identical (`:53-64`); reading and re-emitting the real v6 sample
correctly preserves an untouched entry's bias group and lands edits to `contextConfig` and a category name
(`:148-163`). Output is serialized as 4-space JSON (`lorebook.ts:432`). The committed v3 fixture was
reformatted to that same 4-space style before being committed, so its byte-identical round-trip is not
independent proof of matching a genuine untouched export's whitespace (`lorebook.test.ts:6-8`); the v6
sample, which is untouched and 2-space, is the one real data point on indentation, and it reindents to
4-space with the field-level checks above passing, not a full-text comparison. The test file's own
provenance comment states that the full v3/v4/v6 exports (not just the committed slice) were separately
live-verified via the CLI, kept out of the repo for size and third-party AGPL licensing (`lorebook.test.ts:9-10`);
that claim is not independently checkable here and is reported as the code's own statement, not confirmed
firsthand.

### Cross-format into NovelAI (no twin)

A canonical lorebook arriving from another format (SillyTavern, Risu, CCv3) has no NAI twin, so each entry
is built onto a valid shell instead of overlaid (`lorebook.ts:319-333`). The `contextConfig` defaults are
lifted verbatim from a real NAI blank-entry export, not invented:

```
{ prefix: "", suffix: "\n", tokenBudget: 2048, reservedTokens: 0,
  budgetPriority: <sortOrder>, trimDirection: "doNotTrim",
  insertionType: "newline", maximumTrimType: "sentence", insertionPosition: -1 }
```

`budgetPriority` takes the canonical `sortOrder` directly, so an ST `order` of `55` lands as
`contextConfig.budgetPriority: 55` (`lorebook.test.ts:66-89`). `searchRange` defaults to `1000`
(`DEFAULT_SEARCH_RANGE`, `lorebook.ts:182`) and the book is written with `lorebookVersion: 3`
(`DEFAULT_LOREBOOK_VERSION`, `lorebook.ts:181`). NAI v3/v4 entries carry no `id` on the wire, so a
cross-format entry gets none either; a v6 uuid only survives on a same-format twin (`lorebook.ts:361-363`).

@fig cross-format

## Quirks

- **Book has no name.** The file carries no book-level name field; `body.name` is always `""` and
  `canonicalId("")` falls back to `"character"` for the entity id (`lorebook.ts:290,423`, `canonical.ts:33`).
- **`contextConfig` writes are a merge, `loreBiasGroups` writes are a replace.** See Escrow above; the two
  nested blocks do not follow the same overlay rule, and neither follows the flat per-field rule the
  top-level scalars use.
- **Bias-group dual casing only survives untouched.** A real export writes `generateOnce`/`generate_once`
  and `ensureSequenceFinish`/`ensure_sequence_finish` side by side; an edit collapses to camelCase only.
  See Escrow above.
- **Categories cannot be bulk-cleared** through this codec: emptying `body.categories` leaves the wire's
  `categories[]` as-is. See Escrow above.
- **Priority never serializes.** NAI is single-axis (`budgetPriority` is placement only); canonical
  `priority` has no NAI home and is guarded by a regression test that greps the serialized entry for the
  literal string `"priority"` (`lorebook.test.ts:165-174`).
- **No character adapter.** NAI has no character card, so there is no `novelai` character codec and no
  bundle path that embeds a lorebook into one.
- **Nothing here is ever executed.** The whole codec is a JSON parse/stringify transform; no field is
  eval'd or run. A script-like payload, if one ever shows up in the wild (`advancedConditions` is the one
  candidate seen, always empty so far), rides the twin untouched like everything else in the escrow-only
  list above.

## Source of truth

| Concern | File |
| --- | --- |
| Native lorebook codec (detect, field map, escrow, twin overlay) | `src/formats/novelai/lorebook.ts` |
| Folder default export | `src/formats/novelai/index.ts` |
| Canonical lorebook schema (`EntryContextConfig`, `LoreBiasGroup`, `LorebookEntry`) | `src/entities/lorebook/schema.ts` |
| Field meanings + which formats produce them | [../entities/lorebook.md](../entities/lorebook.md) |
| Shared keyword `/pattern/flags` decode | `src/formats/_shared/character-book.ts` |
| Committed v3 fixture (test-only, reformatted to 4-space) | `src/formats/novelai/fixtures/nai-v3-mal.slice.lorebook.json` |
| Real, untouched v6 sample (first-party scenario export) | `samples/novelai/nai-v6-crystal-dragon.lorebook.json`, provenance in `samples/novelai/SOURCES.md` |
| Adapter test suite | `src/formats/novelai/lorebook.test.ts` |
| Canonical wrapper, escrow (`original`), id policy | `src/core/canonical.ts` |
