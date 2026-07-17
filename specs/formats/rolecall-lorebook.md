# Spec: RoleCall Lorebook Export (RoleCallExportV1)

**Package:** `packages/formats` (codec), reads/writes canonical `packages/core` `Lorebook`/`LorebookEntry` · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md, specs/formats/st-worldinfo.md (sibling codec, shares canonical target)
**VAUDEVILLE reference:** `packages/lorebook/src/schemas.ts` (:27), `packages/lorebook/src/types.ts` (:216 `LorebookEntry`, :342 `Lorebook`), `packages/lorebook/src/serializer.ts` (:464-628), `packages/lorebook/src/parser.ts` (:676-866), `packages/lorebook/src/format-detection.ts` (:44), `packages/lorebook/src/diff-engine.ts` (:1-90)

## Purpose

RoleCall's native lorebook export format ("RoleCallExportV1", schema marker
`schemaVersion: "1.0.0"`) is the lossless, versioned JSON shape RoleCall uses
to move lorebooks in and out of its own database. Unlike SillyTavern world
info (see `st-worldinfo.md`), it was designed *as* an export contract, not
reverse-engineered from a UI's save format, so it already carries RoleCall's
superset fields (per-trigger probability, internal comments, granular
injection positions, category folders, side effects, compendium metadata)
without lossy compression into ST's numeric enums.

This spec defines the codec that reads a RoleCallExportV1 JSON document into
the canonical `Lorebook`/`LorebookEntry` model and writes it back out. Because
RoleCall's own `LorebookEntry` type is already close to a practical
superset (canonical-model.md adopts it as the baseline), this codec is
expected to have the highest "native" coverage of any lorebook codec: most
fields round-trip with zero escrow. It is also the format the studio's own
"RoleCall-native" lorebook export target produces, and the format ST-import
warnings point users toward when RoleCall-only features would otherwise be
lost on ST export.

## Behavior

### Top-level shape

```json
{
  "schemaVersion": "1.0.0",
  "exportDate": "2026-01-01T00:00:00.000Z",
  "lorebook": {
    "name": "...",
    "description": "..." ,
    "settings": { "...": "global matching + budget config" },
    "metadata": { "genre": null, "fandom": null, "tags": [] },
    "entries": [ "...RoleCallEntryV1..." ],
    "categories": [ "...optional RoleCallCategoryV1..." ],
    "tree": "...optional LorebookTreeV1..."
  }
}
```

Source: `packages/lorebook/src/schemas.ts:28-97` (`RoleCallExportV1`,
`RoleCallLorebookV1`).

### Detection

`detectLorebookFormat` (`format-detection.ts:44-148`) treats any object with
a top-level string `schemaVersion` field as RoleCall format (`format:
'rolecall'`), with `confidence: 1.0` when `lorebook` (object) and
`exportDate` (string) are both also present, else `confidence: 0.6` with
`validated: false`. Detection does NOT require `schemaVersion === "1.0.0"`;
any string value takes the `rolecall` branch first (`format-detection.ts:54`).
The compendium export variant (`schemaVersion` starting with the literal
string `"compendium-"`, e.g. `"compendium-v1.0.0"`, from
`apps/rc/src/lib/lorebook/compendium-parser.ts:83-84`) is a sibling flat file
also carrying `{ schemaVersion, lorebook, entries }`, produced by a different
app-level parser than the one this spec covers; see Non-goals.

There is also a legacy, unversioned "RoleCall internal" shape detected as a
fallback: any object with an `entries` array whose first element has a
`comment` field or a `scanUserPersona`/`scanCharacterDescription` field, with
no `schemaVersion` (`format-detection.ts:88-113`, confidence `0.8`). This
maps to a distinct parse function (`parseRoleCallInternal`,
`parser.ts:894+`) with snake_case-tolerant field reads. The Vaudeville codec
covers the versioned `RoleCallExportV1` shape as primary; the unversioned
legacy shape is a detection fallback the codec should still accept for read
(see Edge case 8) but never writes.

### Version handling

`isRoleCallVersionSupported(version)` only returns true for the exact string
`"1.0.0"` (`format-detection.ts:214-217`). The parser does NOT hard-fail on
an unsupported version: it downgrades to an advisory warning and continues
parsing structurally (`parser.ts:680-693`, deliberately changed from a hard
rejection — the comment there explains this also unblocked compendium
exports that share the underlying entry shape under a different marker).
`getRoleCallMigration(fromVersion)` is a stub that always returns `null`
today (`format-detection.ts:226-231`) — there is no migration function for
any prior version because `1.0.0` is the only version that has ever existed.
Vaudeville's codec should mirror this: parse leniently on any `schemaVersion`
string, warn (not error) when it isn't exactly `"1.0.0"`, and always write
`"1.0.0"` on serialize.

### Field map — `RoleCallLorebookV1` -> canonical `Lorebook`

| Source field | Canonical field | Native/Escrow/Dropped | Notes |
|---|---|---|---|
| `lorebook.name` | `Lorebook.name` | native | |
| `lorebook.description` | `Lorebook.description` | native | `string \| null` both sides |
| `lorebook.settings.lorebookType` | `Lorebook.lorebookType` | native | free string in schema; canonical narrows to `LorebookType` union (`types.ts:337`); unrecognized values pass through as string (codec does not validate against the union at parse time, only at DB save time in VAUD — Vaudeville codec should preserve the raw string rather than coerce) |
| `lorebook.settings.globalCaseSensitive` | `Lorebook.globalCaseSensitive` | native | |
| `lorebook.settings.globalMatchWholeWords` | `Lorebook.globalMatchWholeWords` | native | |
| `lorebook.settings.globalScanDepth` | `Lorebook.globalScanDepth` | native | |
| `lorebook.settings.globalRecursion` | `Lorebook.globalRecursion` | native | |
| `lorebook.settings.tokenBudget` | `Lorebook.tokenBudget` | native | |
| `lorebook.settings.budgetMode` | `Lorebook.budgetMode` | native | optional in schema; parser defaults to `'token'` on read when absent (`parser.ts:824`) |
| `lorebook.settings.entryBudget` | `Lorebook.entryBudget` | native | optional; parser defaults to `20` on read when absent (`parser.ts:825`) |
| `lorebook.metadata.genre` | `Lorebook.genre` | native | |
| `lorebook.metadata.fandom` | `Lorebook.fandom` | native | |
| `lorebook.metadata.tags` | `Lorebook.tags` | native | defaults to `[]` |
| `lorebook.entries[]` | `LorebookEntry[]` | native | see entry table below |
| `lorebook.categories[]` | `LorebookCategory[]` (attached to `LorebookWithEntries.categories`) | native | optional; only present if the source lorebook had DB-backed categories |
| `lorebook.tree` | OPEN QUESTION | escrow | `LorebookTreeV1` (`tree_data`, `build_mode`, `granularity`, `version`, `built_at`) is a precomputed navigation/summary structure over entries (`lorebook_trees` table). Canonical model has no defined home for it yet (not listed in canonical-model.md's Lorebook section). Vaudeville codec should escrow it verbatim under `escrow['rolecall'].fields.tree` until a canonical field is designed — do not drop it, the RC round-trip law requires re-embedding it on RoleCall-format serialize. |
| `exportDate` | `Entity.meta.importedAt`? | escrow | `exportDate` is when the *source* system exported, not when Vaudeville imported. Store as `escrow['rolecall'].fields.exportDate`; `meta.importedAt` is set fresh by Vaudeville's own parse per canonical-model.md. |
| `schemaVersion` | `Entity.meta.origin.version` | native (via meta) | also duplicated into `escrow['rolecall'].version` per the Escrow envelope shape (escrow-and-roundtrip.md) |

### Field map — `RoleCallEntryV1` -> canonical `LorebookEntry`

| Source field | Canonical field | Native/Escrow/Dropped | Notes |
|---|---|---|---|
| `id` | `LorebookEntry.id` | native | preserved verbatim, not regenerated (unlike ST import, which has no source id) |
| `title` | `LorebookEntry.title` | native | |
| `content` | `LorebookEntry.content` | native | |
| `comment` | `LorebookEntry.comment` | native | RC-only field; ST has no equivalent (see `serializer.ts:283`); this is the reason RoleCall format exists as a distinct export target |
| `enabled` | `LorebookEntry.enabled` | native | |
| `constant` | `LorebookEntry.constant` | native | |
| `triggers.mode` | `LorebookEntry.triggerMode` | native | `"simple" \| "advanced"` |
| `triggers.primary` | `LorebookEntry.triggers` | native | `Trigger[]` = `SimpleTrigger \| AdvancedTrigger` union, discriminated by presence of `probability` (`types.ts:84-89`) |
| `triggers.secondary` | `LorebookEntry.secondaryTriggers` | native | |
| `triggers.selectiveLogic` | `LorebookEntry.selectiveLogic` | native | `'and_any' \| 'and_all' \| 'not_any' \| 'not_all'` (`types.ts:108`) |
| `matching.caseSensitive` | `LorebookEntry.caseSensitive` | native | `boolean \| null`; null = inherit lorebook global |
| `matching.matchWholeWords` | `LorebookEntry.matchWholeWords` | native | same null-inherit semantics |
| `matching.scanDepth` | `LorebookEntry.scanDepth` | native | same null-inherit semantics |
| `injection.position` | `LorebookEntry.position` | native | `InjectionPosition` union includes RC extensions `append`, `append_bottom`, `prepend_top` not present in ST at all (`types.ts:182-191`) — see canonical-model note below |
| `injection.depth` | `LorebookEntry.depth` | native | only meaningful when `position` is `'depth'` or `'append'` |
| `injection.role` | `LorebookEntry.role` | native | `'system' \| 'user' \| 'assistant'` |
| `priority.sortOrder` | `LorebookEntry.sortOrder` | native | display/edit order |
| `priority.priority` | `LorebookEntry.priority` | native | activation priority, higher fires first |
| `timing.sticky` | `LorebookEntry.sticky` | native | |
| `timing.cooldown` | `LorebookEntry.cooldown` | native | |
| `timing.delay` | `LorebookEntry.delay` | native | |
| `grouping.groupName` | `LorebookEntry.groupName` | native | |
| `grouping.categoryId` | `LorebookEntry.categoryId` | native | references `lorebook.categories[].id`; optional field added after the base schema (marked `categoryId?:` at `schemas.ts:227`) |
| `grouping.groupWeight` | `LorebookEntry.groupWeight` | native | |
| `probability` | `LorebookEntry.probability` | native | entry-level fallback (0-100) |
| `advanced.useMemo` | `LorebookEntry.useMemo` | native | |
| `advanced.excludeRecursion` | `LorebookEntry.excludeRecursion` | native | |
| `advanced.preventRecursion` | `LorebookEntry.preventRecursion` | native | |
| `advanced.delayUntilRecursion` | `LorebookEntry.delayUntilRecursion` | native | numeric depth, not boolean, in RC native (contrast ST's boolean flag — see st-worldinfo.md) |
| `advanced.ignoreBudget` | `LorebookEntry.ignoreBudget` | native | |
| `characterFilter` | `LorebookEntry.characterFilter` | native | `{ isExclude, names[], tags[] } \| null` |
| `scanSources.characterDescription` | `LorebookEntry.scanCharacterDescription` | native | |
| `scanSources.characterPersonality` | `LorebookEntry.scanCharacterPersonality` | native | |
| `scanSources.userPersona` | `LorebookEntry.scanUserPersona` | native | |
| `scanSources.scenario` | `LorebookEntry.scanScenario` | native | |
| (none — no `scanSources.preset` in schema) | `LorebookEntry.scanPreset` | dropped on read, defaulted `false` | canonical `LorebookEntry.scanPreset` exists (`types.ts:302`) but `RoleCallEntryV1.scanSources` has no `preset` key (`schemas.ts:270-282`); parser hardcodes `false` on import (`parser.ts:769`, comment: "Default - RC schema doesn't have this yet"). Serializer likewise never emits it. Vaudeville codec: escrow the live canonical value under `escrow['rolecall'].fields['entries.<id>.scanPreset']` so a value set inside Vaudeville isn't silently lost if round-tripped through this codec, since the wire schema has no slot for it. |
| `sideEffects` | `LorebookEntry.sideEffects` | native | `EntrySideEffects \| null`; optional field for backward compat with pre-side-effects exports (`schemas.ts:289`) — absent means `null`, not omit-and-inherit |
| `metadata` | `LorebookEntry.metadata` | native | the compendium signal (`entry_type` + `structured_data`); optional, added after the base schema (`schemas.ts:291-297`); absent maps to `undefined` on the canonical side (`parser.ts:776`), not `null` |
| `unsupportedFields` | `LorebookEntry.unsupportedFields` | escrow (RC's own escrow precedent) | this is itself RC's pre-Vaudeville escrow mechanism for ST-only fields RC doesn't model yet (`groupOverride`, `useGroupScoring`, `automationId`, `vectorized`, `matchCharacterDepthPrompt`, `matchCreatorNotes`, `generationTriggers`, `outletName`, plus an open index signature). Vaudeville's codec should fold this into the standard `Escrow` envelope under `escrow['st'].fields` (not `escrow['rolecall']`) since these are ST-origin fields carried through RC, not RC-origin fields — see Edge case 5. |
| (not on entry; derived from `LorebookEntry.boostIds`/`boostAmount` in canonical) | n/a | dropped on both read and write | `RoleCallEntryV1` has no `boostIds`/`boostAmount` fields at all. Canonical `LorebookEntry` has them (`types.ts:291-292`, "Cross-entry boosting"). Parser hardcodes `boostIds: []`, `boostAmount: 0` on import (`parser.ts:758-759`); serializer never emits them. If a Vaudeville-created entry has non-default boost values and round-trips through RoleCallExportV1, they are lost on write and reset to defaults on the next read. Flag as `dropped` in the capabilities matrix and surface a `SerializeReport` warning when non-default values would be discarded. |
| (not on entry; canonical `allowRecursion`) | n/a | dropped on both read and write | Same pattern as boosting: canonical has `allowRecursion: boolean` (`types.ts:285`); RC's own export schema has no field for it. Parser hardcodes `false` (`parser.ts:751`). Flag `dropped`. |

### Categories and tree

`RoleCallCategoryV1` (`schemas.ts:102-114`): `{ id, name, sortOrder, enabled }`.
Maps 1:1 to canonical `LorebookCategory` minus `lorebookId`/`createdAt`/`updatedAt`
(the parser reattaches `lorebookId` from the freshly generated lorebook id at
parse time, `parser.ts:841`; timestamps are not part of the export). Category
`enabled` is optional on the wire and defaults to `true` on both parse
(`parser.ts:845`) and serialize (`serializer.ts:600`).

`LorebookTreeV1` is a snapshot of a separate `lorebook_trees` DB table
(precomputed compendium/navigation summary), embedded only when the exporter
explicitly passes a `tree` argument to `serializeToRoleCallV1` (it is not
derived from `entries` by the codec itself — VAUD's caller fetches it
separately). See the escrow note in the field-map table above.

### Serialization order and defaults

`serializeToRoleCallV1` (`serializer.ts:560-614`) always writes
`schemaVersion: "1.0.0"` and a fresh `exportDate` (`new Date().toISOString()`
at serialize time — NOT the original import's `exportDate`, which is why that
field is escrow-only, not a canonical round-trip target). `categories` and
`tree` keys are omitted entirely from the JSON when empty/absent (conditional
spread, `serializer.ts:594-606`), not written as empty array / null.

### Relationship to the ST codec

Both this codec and `st-worldinfo.md` target the same canonical
`Lorebook`/`LorebookEntry` shape. This format is the "no data loss" target:
`serializeToRoleCallV1`'s own doc comment states "NO DATA LOSS - preserves
all RoleCall features" (`serializer.ts:554-556`). Concretely, per VAUD's own
`validateForRoleCallExport`, this holds because it literally reuses the same
base structural validation as ST export (`validation.ts:240-242`) with no
additional RC-specific rejection — the format itself is what avoids loss, not
extra validation. When Vaudeville's canonical model round-trips a lorebook
`ST -> canonical -> RoleCallExportV1 -> canonical -> ST`, the middle
RoleCallExportV1 hop should be lossless relative to the canonical model
(everything the canonical model can express, this format can express),
whereas an `ST -> canonical -> ST` round trip loses RC-only fields captured
in escrow (comment, per-trigger probability if the ST target doesn't support
mixed probabilities, append/append_bottom/prepend_top positions collapse per
`positionToNumber`, `serializer.ts:116-129`).

### Capabilities matrix (canonical field -> capability)

Per escrow-and-roundtrip.md, each codec exports a
`Record<CanonicalFieldPath, "native"|"escrow"|"dropped">`. For this codec:

```ts
export const rolecallLorebookCapabilities: Record<string, "native" | "escrow" | "dropped"> = {
  "lorebook.name": "native",
  "lorebook.description": "native",
  "lorebook.lorebookType": "native",
  "lorebook.globalCaseSensitive": "native",
  "lorebook.globalMatchWholeWords": "native",
  "lorebook.globalScanDepth": "native",
  "lorebook.globalRecursion": "native",
  "lorebook.tokenBudget": "native",
  "lorebook.budgetMode": "native",
  "lorebook.entryBudget": "native",
  "lorebook.genre": "native",
  "lorebook.fandom": "native",
  "lorebook.tags": "native",
  "lorebook.categories": "native",
  "lorebook.tree": "escrow", // OPEN QUESTION: no canonical home yet
  "entry.id": "native",
  "entry.title": "native",
  "entry.content": "native",
  "entry.comment": "native",
  "entry.enabled": "native",
  "entry.constant": "native",
  "entry.triggerMode": "native",
  "entry.triggers": "native",
  "entry.secondaryTriggers": "native",
  "entry.selectiveLogic": "native",
  "entry.caseSensitive": "native",
  "entry.matchWholeWords": "native",
  "entry.scanDepth": "native",
  "entry.position": "native",
  "entry.depth": "native",
  "entry.role": "native",
  "entry.sortOrder": "native",
  "entry.priority": "native",
  "entry.sticky": "native",
  "entry.cooldown": "native",
  "entry.delay": "native",
  "entry.groupName": "native",
  "entry.categoryId": "native",
  "entry.groupWeight": "native",
  "entry.probability": "native",
  "entry.useMemo": "native",
  "entry.excludeRecursion": "native",
  "entry.preventRecursion": "native",
  "entry.delayUntilRecursion": "native",
  "entry.ignoreBudget": "native",
  "entry.characterFilter": "native",
  "entry.scanCharacterDescription": "native",
  "entry.scanCharacterPersonality": "native",
  "entry.scanUserPersona": "native",
  "entry.scanScenario": "native",
  "entry.scanPreset": "dropped", // no wire slot in RoleCallEntryV1
  "entry.sideEffects": "native",
  "entry.metadata": "native",
  "entry.unsupportedFields": "escrow", // folded into escrow['st']
  "entry.boostIds": "dropped", // no wire slot
  "entry.boostAmount": "dropped", // no wire slot
  "entry.allowRecursion": "dropped", // no wire slot
};
```

Byte-identity level: **canonical-json**. RoleCall's own serializer emits
fresh `exportDate`/pretty-printed JSON on every call and does not attempt
byte-stable key ordering guarantees beyond object literal order, but a
`serialize(parse(F))` compared via stable-stringify (ignoring `exportDate`)
should match `F` for any fixture, because the field map above has no lossy
coercions on the native path.

## Public API sketch

```ts
// packages/formats/src/rolecall-lorebook/index.ts

import type { Codec, ParseResult, SerializeResult, Escrow } from "@vaud/core";
import type { Lorebook, LorebookEntry } from "@vaud/core";

export interface RoleCallLorebookCodecOptions {
  /** Embed a tree snapshot on serialize; omitted entirely if not provided. */
  tree?: unknown;
}

export const rolecallLorebookCodec: Codec<Lorebook, RoleCallLorebookCodecOptions> = {
  id: "rolecall-lorebook",
  formatFamily: "lorebook",

  /** Confidence-scored detection; mirrors detectLorebookFormat's precedence. */
  detect(input: unknown): { format: "rolecall-lorebook"; confidence: number } | null;

  parse(input: unknown): ParseResult<Lorebook>;

  serialize(
    entity: { data: Lorebook; escrow: Escrow },
    options?: RoleCallLorebookCodecOptions,
  ): SerializeResult<unknown>; // JSON-serializable RoleCallExportV1 object

  capabilities: Record<string, "native" | "escrow" | "dropped">;
};

/** Standalone helpers, exported for the CLI and for st-worldinfo.md's
 *  cross-codec conversion path (ST -> canonical -> RoleCall and back). */
export function parseRoleCallLorebookV1(json: unknown): ParseResult<Lorebook>;
export function serializeRoleCallLorebookV1(
  entity: { data: Lorebook; escrow: Escrow },
  tree?: unknown,
): unknown;
```

## Edge cases & failure modes

1. **`schemaVersion` present but not `"1.0.0"`.** Parse proceeds (mirrors
   VAUD's downgrade from hard-fail to warning, `parser.ts:680-693`); emit a
   `ParseReport` warning naming the unfamiliar version. Do not reject.
2. **`schemaVersion` starts with `"compendium-"`.** This is a related but
   distinct wire shape (`apps/rc/src/lib/lorebook/compendium-parser.ts`) not
   covered by this codec's field map (its entries are described as "raw
   compendium entries," structurally different from `RoleCallEntryV1`). The
   `detect()` function should NOT claim ownership of `compendium-*` markers;
   OPEN QUESTION: whether Vaudeville needs a separate `rolecall-compendium`
   codec in a later milestone, or whether compendium export folds into this
   one once its entry shape is confirmed against source. Not building it now
   per the M1 scope; note it as a non-goal.
3. **Missing `budgetMode` / `entryBudget` on `settings`.** Both are optional
   in the wire schema (`schemas.ts:70,73`). Default on parse: `budgetMode:
   'token'`, `entryBudget: 20` (`parser.ts:824-825`). Codec must replicate
   these exact defaults, not empty/zero, to match VAUD behavior.
4. **`categoryId` present on an entry but `categories` array absent or
   missing that id.** The wire format allows this (categories are optional,
   `schemas.ts:90`). Canonical `LorebookEntry.categoryId` is preserved as-is
   (a dangling reference); no resolution/repair happens in the codec itself
   (VAUD's ST *serializer* resolves `categoryId` -> `groupName` via a lookup
   map only when serializing to ST, `serializer.ts:372-386,384-387` — that
   resolution is ST-codec behavior, not something this codec does on parse).
5. **`unsupportedFields` on an entry.** These are ST-origin fields RC
   couldn't model, riding through RC export as an escape hatch
   (`schemas.ts:299-313`). On parse, fold them into `escrow['st'].fields`
   keyed by field name, not `escrow['rolecall']` — they did not originate in
   RoleCall's own format, RoleCall is just the carrier. On serialize back to
   RoleCallExportV1, re-emit the object verbatim under `unsupportedFields`
   only if it has at least one key (mirrors the conditional spread at
   `serializer.ts:547-549`); an empty object must be omitted, not written as
   `{}`.
6. **`sideEffects` field entirely absent (pre-side-effects export).** Map to
   canonical `null`, not `undefined` and not an empty side-effects object
   (`parser.ts:772`: `rcEntry.sideEffects ?? null`).
7. **`metadata` field entirely absent (pre-compendium export).** Map to
   canonical `undefined` (not `null`) per `parser.ts:776`, so a
   subsequent DB/store layer applies its own column default rather than
   writing an explicit null. Vaudeville's canonical model should preserve
   this undefined-vs-null distinction if the field is declared `metadata?:
   Record<string, unknown>` (optional, no `| null`) per `types.ts:320`.
8. **Legacy unversioned RoleCall shape (no `schemaVersion`, `entries` array
   with `comment` or scan-source fields).** Detected as RoleCall format with
   confidence `0.8` by VAUD's `detectLorebookFormat`
   (`format-detection.ts:88-113`) and routed to a separate parser
   (`parseRoleCallInternal`, snake_case tolerant). Vaudeville's codec for
   THIS spec (versioned `RoleCallExportV1`) should decline this shape in
   `detect()` (return null / low confidence) and let a future
   `rolecall-lorebook-legacy` codec (OPEN QUESTION: is one planned, or does
   detection just fall through to failure) own it. Do not silently
   misparse a legacy file as v1 — the shapes are structurally incompatible
   (flat entry fields vs the nested `triggers`/`matching`/`injection`/etc.
   groups).
9. **Trigger discriminated union ambiguity.** `triggers.mode: "advanced"` is
   derived by the serializer from `entry.triggers.some(t => 'probability' in
   t)` (`serializer.ts:481`), not stored independently from the per-trigger
   shape — an entry can theoretically have `mode: "simple"` in the wire JSON
   while one of its `primary` triggers still carries a `probability` field
   (hand-edited file, or a bug in an upstream exporter). On parse, canonical
   `triggerMode` should be taken from the wire `triggers.mode` field
   verbatim (matches `parser.ts:715`) even if it disagrees with the actual
   trigger shapes; do not re-derive it. Round-trip through this codec is
   then still lossless (whatever was on the wire comes back out), but this
   is a case worth a fixture.
10. **`isRegex` trigger with `flags` on read producing a JS regex that fails
    to compile.** Out of scope for this codec's parse step (the codec is not
    responsible for validating that `keyword`+`flags` form a syntactically
    valid regex) — that is the lorebook engine's concern at match time
    (see `specs/engine/lorebook-engine.md`). The codec's job is to preserve
    `{ keyword, isRegex, flags }` verbatim.
11. **`lorebook.name` empty string.** Wire schema requires `name: string`
    (not optional, not nullable) — an empty string is syntactically valid
    JSON but semantically odd. VAUD source has no explicit guard against
    this in the RC parser; treat as a parse warning (empty name), not a
    parse error, consistent with the "advisory over rejection" pattern seen
    elsewhere in this parser.
12. **Round-tripping RC-origin `entry.boostIds`/`boostAmount`/`allowRecursion`
    when the canonical entity carries non-default values (e.g. imported from
    a hypothetical future codec, or set directly via the Vaudeville CLI).**
    These have zero representation in `RoleCallEntryV1`. Serialize must
    silently DROP them and the `SerializeReport` must list them under
    `dropped`, per escrow-and-roundtrip.md's reporting contract — do not
    invent wire fields for them (that would break real RoleCall's own
    importer on a foreign field it doesn't expect... actually RoleCall's own
    parser reads `RoleCallEntryV1` with a fixed shape and would ignore
    unknown keys, but Vaudeville must not claim `"native"` for fields the
    real format has never carried).

## Test plan

- Fixtures required (`fixtures/rolecall-lorebook/`):
  - `minimal.json` — smallest valid `RoleCallExportV1`: one entry, no
    categories, no tree, no sideEffects/metadata (exercises optional-field
    defaults, edge cases 3, 6, 7).
  - `full-featured.json` — every field populated: categories present with
    entries referencing them, tree embedded, sideEffects with multiple
    effect types, metadata with `entry_type`/`structured_data`, mixed
    simple/advanced triggers, all nine `InjectionPosition` values across
    different entries, `unsupportedFields` populated with several ST-origin
    keys (exercises the full field map + edge cases 4, 5).
  - `unfamiliar-version.json` — `schemaVersion: "1.0.1"` (or similar), valid
    structure otherwise (edge case 1).
  - `legacy-unversioned.json` — no `schemaVersion`, flat `entries` array with
    `comment` fields, structurally the pre-schema shape (edge case 8, must
    be REJECTED or routed away by `detect()`, not misparsed).
  - `dangling-category-ref.json` — entry with `categoryId` pointing to a
    category id absent from `categories[]` (edge case 4).
  - `mode-mismatch.json` — `triggers.mode: "simple"` with a `primary`
    trigger that has a `probability` field anyway (edge case 9).
  - `nonstandard-boosting.json` — canonical-side-only fixture (built via
    `packages/core` directly, not a wire JSON file) with non-default
    `boostIds`/`boostAmount`/`allowRecursion`, serialized through this codec
    to confirm the `SerializeReport.dropped` list names them (edge case 12).
- Round-Trip Law applicability: full law applies to every fixture in the
  `full-featured.json` / `minimal.json` family:
  `serialize(parse(F))` must be semantically identical to `F` at the
  **canonical-json** byte-identity level (ignoring the `exportDate` field,
  which is intentionally regenerated, and ignoring absent-vs-omitted key
  differences already covered by edge cases 3/6/7's explicit default rules).
  `legacy-unversioned.json` is explicitly EXCLUDED from this codec's
  Round-Trip Law run (it is not this codec's input format).
- Property/unit tests beyond fixtures:
  - `detect()` returns null (or a low enough confidence to lose to a more
    specific codec) for both ST world-info shape and the legacy-unversioned
    shape, so `bundle-import.md`'s classify-then-import never misroutes a
    file to this codec.
  - Capability matrix export snapshot-tests cleanly (per
    escrow-and-roundtrip.md's "matrix is itself snapshot-tested" rule).
  - `scanPreset`, `boostIds`, `boostAmount`, `allowRecursion` are each
    independently verified to appear in the `dropped` list of a
    `SerializeReport` when non-default, and to NOT appear when default
    (avoids false-positive noise in `vaud convert` output).

## Non-goals

- The `compendium-*` schema variant (`apps/rc/src/lib/lorebook/
  compendium-parser.ts`) is a distinct wire shape and is NOT covered by this
  spec. See Edge case 2.
- The legacy unversioned RoleCall shape is a DETECTION concern (must not be
  misparsed as v1) but this spec does not define its own parser/serializer
  for it; that is a separate future codec if ever needed (OPEN QUESTION
  below).
- Resolving dangling `categoryId` references, deriving `groupName` from
  categories, or any other cross-field repair is ST-serializer behavior in
  VAUD (`serializer.ts:384-387`) and is out of scope for THIS codec's
  parse/serialize; canonical model just carries the reference as-is.
- The `lorebook_trees` precomputation itself (how `tree_data` is built) is a
  RoleCall app-level feature (compendium/navigation UI), not a format
  concern; this spec only defines how the already-built tree snapshot is
  carried through export/import.
- Lorebook engine semantics (how triggers actually match, recursion,
  budgets) belong to `specs/engine/lorebook-engine.md`, not here.

## Sources consulted

- `<RoleCall>\packages\lorebook\src\schemas.ts` (whole file, 352 lines) — `RoleCallExportV1` :28, `RoleCallLorebookV1` :42, `RoleCallCategoryV1` :102, `LorebookTreeV1` :119, `RoleCallEntryV1` :139-314, `ExportOptions`/`ExportResult` :323-352.
- `<RoleCall>\packages\lorebook\src\types.ts` — `LorebookCategory` :10, `Trigger`/`SimpleTrigger`/`AdvancedTrigger` :27-89, `SelectiveLogic` :108, `CharacterFilter` :120, `EntrySideEffect(s)` :138-153, `InjectionPosition` :182-191, `MessageRole` :193, `EntryOrigin` :210, `LorebookEntry` :216-331, `Lorebook` :342-393, `LorebookWithEntries` :399-402.
- `<RoleCall>\packages\lorebook\src\format-detection.ts` (whole file, 232 lines) — `detectLorebookFormat` :44-148, `detectRoleCallFeatures` :154-184, `isRoleCallVersionSupported` :214-217, `getRoleCallMigration` :226-231.
- `<RoleCall>\packages\lorebook\src\serializer.ts` (whole file, 628 lines) — ST position/role/selectiveLogic mappers :112-156, `serializeEntry` (ST) :217-348, `serializeToST` :362-407, `serializeEntryToRoleCallV1` :471-551, `serializeToRoleCallV1` :560-614, `serializeToRoleCallJSON` :624-627.
- `<RoleCall>\packages\lorebook\src\parser.ts` — `parseRoleCallV1` :676-866, `normalizeTriggers` :875-891, `parseRoleCallInternal` header :893-899, `parseLorebook` dispatcher :1223+.
- `<RoleCall>\packages\lorebook\src\validation.ts` — `validateForRoleCallExport` :240-242 (delegates to base `validateLorebook`).
- `<RoleCall>\packages\lorebook\src\diff-engine.ts` — `EntryState`/`LorebookState`/`ChangeType` :18-90 (versioning hooks context; this codec's field set is the same one the diff engine tracks per-entry for changelog generation, confirming which fields are considered "the entry" for versioning purposes).
- `<RoleCall>\apps\rc\src\lib\lorebook\compendium-parser.ts` — `compendium-` schema marker detection :83-84, version check :169-171 (cited only to scope the Non-goal / Edge case 2 boundary, not analyzed in full).
- `docs\the extraction map (private planning notes)` :16-25 (extraction inventory for `packages/lore`, confirms `schemas.ts`/`parser.ts`/`serializer.ts`/`diff-engine.ts` are the intended source set).
- `specs\formats\canonical-model.md` — Lorebook/LorebookEntry canonical baseline decision (:52-58), Escrow envelope shape.
- `specs\formats\escrow-and-roundtrip.md` — Round-Trip Law, Escrow envelope, capabilities matrix, reporting contract.
- `docs\the production bible (private planning notes)` :47 — this file's brief.
