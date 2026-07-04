# Format: NovelAI

NovelAI is a text-generation service whose portable roleplay artifact is the **lorebook**, exported as a
`.lorebook` (or `.json`) file. NovelAI has **no character-card concept**; its "card" is a lorebook. So the
NovelAI family ships a single codec, a native lorebook, and no character adapter.

- `id: "novelai-lorebook"`, kind `lorebook`, container `.lorebook` / `.json`, writes `.lorebook`.
- Source: `src/formats/novelai/lorebook.ts`. Folder default export: `src/formats/novelai/index.ts`
  (exports the one codec). Provenance: `design/NOVELAI-FORMAT.md` + `design/LOREBOOK-FORMATS.md`, plus
  real v3/v4/v6 exports read byte-for-byte (interop facts only, no NovelAI source read).

## File shape

A NovelAI lorebook is `{ lorebookVersion, entries[], settings, categories[] }`:

- `lorebookVersion`: an integer (`3`, `4`, `5`, `6` seen in the wild). Additive across versions.
- `entries[]`: the lore entries (field map below).
- `settings`: book-level flags, e.g. `orderByKeyLocations`.
- `categories[]`: NovelAI **subcontexts** (grouped entries with their own assembly config). Rich and
  NovelAI-specific; no canonical home, rides escrow.

The file carries **no book-level name** (the name lives on the file / UI), so the canonical book name is
empty and global scan/budget default to `0`.

### Enums are strings in the file, always

`trimDirection` (`doNotTrim` / `trimTop` / `trimBottom`), `insertionType` (`newline` / `token` /
`sentence`), and `maximumTrimType` are **string** enums in the serialized file across every version tested
(v3, v4, v6). The integer lineage that appears in NovelAI's internal API (and third-party wrappers) never
reaches the exported file, so this codec needs **no** int-to-string enum table. (`design/NOVELAI-FORMAT.md`
previously claimed old exports used integer enums; that was disproven against real v3 bytes and corrected.)

## Detection

`detect()` returns `1.0` when the parsed JSON has a numeric `lorebookVersion` **and** an array `entries`,
`0` otherwise. That pair is unique to NovelAI: a SillyTavern worldbook keys `entries` as an **object**
(`{ "0": {...} }`), a Risu export is wrapped in `{ type: "risu", ... }`, and a CCv3 `character_book` is
nested inside a card. No version sniffing beyond the presence of `lorebookVersion`.

## Entry field map

NovelAI entry field names differ from CCv3. `keys[]` carry their own inline `/regex/` delimiters, so the
shared `keywordToTrigger` decoder is reused with `forceRegex: false` (a plain string stays literal).

| Canonical (`LorebookEntry`) | NovelAI native | Notes |
| --- | --- | --- |
| `id` | `id` (v6+ uuid) | falls back to the array index; v3/v4 have no id |
| `title` | `displayName` | the entry label |
| `content` | `text` | the entry body |
| `triggers` | `keys[]` | inline `/pattern/flags` decoded; plain strings stay literal |
| `constant` | `forceActivation` | always-inject flag |
| `enabled` | `enabled` | defaults on |
| `scanDepth` | `searchRange` | **unit is characters, not messages** (see caveat) |
| `sortOrder` | `contextConfig.budgetPriority` | placement / insertion order (see below) |
| `contextConfig` | `contextConfig` minus `budgetPriority` | authored assembly dials, first-class (see below) |
| `keyRelative` | `keyRelative` | authored activation toggle |
| `nonStoryActivatable` | `nonStoryActivatable` | authored activation toggle |
| `categoryId` | `category` | subcontext/folder ref; `""` -> `null` |
| `categories` (body) | `categories[]` | flat authored surface: id, name, enabled; `sortOrder` = list index |

`budgetPriority` is NovelAI's **single ordering axis** (higher inserts first). Despite the name, it is
**placement**, not eviction, so it maps to canonical `sortOrder`, exactly like SillyTavern `order` and
Risu `insertorder`. The real v3 samples confirm it: an ordered set of one character's entries carries
`400, 399, 398, 397`, a descending insertion sequence, not a budget-survival rank. Canonical `priority`
(the separate eviction axis) has no NovelAI field and defaults to `100`.

NovelAI has **no secondary-key / selective mode** (it combines keys with `&` AND-logic and regex within
`keys`), so `secondaryTriggers` is always empty and `triggerMode` is always `simple`. Positions, per-entry
depth, groups, timing, recursion, and scan sources are absent from the native format and take canonical
defaults (`position: "character"`, and so on).

### The `searchRange` unit caveat

NovelAI's `searchRange` is measured in **characters** of story text, whereas SillyTavern's `scanDepth` is
measured in **messages**. Both map to canonical `scanDepth` because it is the closest home (the "how far
back to scan" axis) and the exact value round-trips losslessly via escrow. But a **cross-format** import
into a messages-based format carries the number verbatim without unit conversion, so a NovelAI `1000`
(characters) becomes `1000` (messages) downstream. This is documented drift, not a bug; a same-format
NovelAI round-trip is unaffected.

## Escrow and round-trip

The authored NAI surface is **first-class** (schema-is-editor): the full per-entry `contextConfig`
assembly block maps to canonical `EntryContextConfig` (its `prefix`/`suffix` are authored TEXT, e.g.
`"[ Mal: "` / `" ]\n"`), `keyRelative`/`nonStoryActivatable` map to canonical toggles, the entry
`category` ref maps to `categoryId`, and `categories[]` maps its flat authored surface (id, name,
enabled) to `LorebookBody.categories`. `insertionPosition` is a signed section offset, a DIFFERENT axis
than canonical `position`/`depth`, so it lives inside `contextConfig` and the coarse `position` stays the
`"character"` portable floor.

The whole raw file still rides `escrow["novelai-lorebook"].raw` as the lossless twin. What legitimately
stays escrow-only (doctrine buckets):

- `lorebookVersion` (format bookkeeping), v6 `id`/`lastUpdatedAt` (platform bookkeeping), category `open`
  (UI state), `settings`.
- The rich subcontext machinery on each category twin (`createSubcontext`, `subcontextSettings`,
  `categoryDefaults`, `categoryBiasGroups`, the `order` ARRAY - an entry-id list, not a rank).
- `loreBiasGroups[]` - authored phrase bias, PENDING its own reconciled canonical shape (the real wire is
  richer than a naive `{phrase,weight}`; modeled in a dedicated pass, tracked in design/DE-ESCROW-SWEEP.md).
- `advancedConditions[]` - present but `[]` in every real sample; ungrounded, not modeled blind.

`fromCanonical` overlays the canonical body onto that twin, matched by entry id (v6 uuid) or array index
(v3/v4), and rewrites **only** the fields whose canonical value changed. An unedited entry re-emits
verbatim, so a same-format round-trip is **data-lossless**. Serialized whitespace is normalized to 4-space
JSON (matching NovelAI's own v3 export style): a v3 export round-trips **byte-identical**; a source saved
with a different indent (a real v6 sample uses 2-space) re-indents with **zero data change**. Both were
verified live via the CLI against full real exports.

### Cross-format into NovelAI (no twin)

A canonical lorebook arriving from another format (SillyTavern, Risu, CCv3) has no NovelAI twin, so each
entry is built fresh onto a valid v3 shell. The `contextConfig` defaults are lifted **verbatim** from a
real NovelAI blank-entry export, not invented:

```
{ prefix: "", suffix: "\n", tokenBudget: 2048, reservedTokens: 0,
  budgetPriority: <sortOrder>, trimDirection: "doNotTrim",
  insertionType: "newline", maximumTrimType: "sentence", insertionPosition: -1 }
```

`budgetPriority` takes the canonical `sortOrder` (so SillyTavern `order` -> `sortOrder` ->
`budgetPriority` places correctly), `searchRange` defaults to `1000`, and the file is written as
`lorebookVersion: 3` (the proven-importable shape). NovelAI v3/v4 entries have no `id`, so a cross-format
entry gets none (identity is by array position); v6 uuids only survive on a same-format twin.

## Executable / opaque content

If a NovelAI export ever carries script-like payloads, they ride escrow as opaque data and are **never
executed**, consistent with the converter posture across the project.

## Scope: no character adapter, no eviction axis

- **No character.** NovelAI has no character card, so there is no `novelai` character codec and nothing to
  embed a lorebook into. The lorebook is the whole artifact.
- **No eviction priority.** NovelAI is single-axis (`budgetPriority` is placement). Canonical `priority`
  never serializes to a NovelAI file; a regression test asserts the string `"priority"` never appears in
  entry output.
- **Direction normalization is out of scope.** `budgetPriority` maps verbatim; the sign/direction
  convention (higher-first) is carried, not normalized against other formats. Same deferred follow-up as
  the placement-order reconciliation (#15); same-format round-trips do not expose it.

## Source of truth

| Concern | File |
| --- | --- |
| Native lorebook codec (detect, field map, escrow, twin overlay) | `src/formats/novelai/lorebook.ts` |
| Folder default export | `src/formats/novelai/index.ts` |
| Committed real v3 slice (test fixture) | `src/formats/novelai/fixtures/nai-v3-mal.slice.lorebook.json` |
| Shared keyword `/pattern/flags` decode | `src/formats/_shared/character-book.ts` |
| Format research + field-map provenance | `design/NOVELAI-FORMAT.md`, `design/LOREBOOK-FORMATS.md` |
