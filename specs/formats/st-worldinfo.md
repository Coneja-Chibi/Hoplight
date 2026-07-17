# Spec: SillyTavern World Info (ST Worldbook / Lorebook JSON)

**Package:** `packages/formats` (codec), `packages/core` (canonical `Lorebook`/`LorebookEntry` types)
**Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md
**VAUDEVILLE reference:** packages/lorebook/src/types.ts (:216 `LorebookEntry`, :342 `Lorebook`),
packages/lorebook/src/format-detection.ts (:44 `detectLorebookFormat`),
packages/lorebook/src/parser.ts, packages/lorebook/src/serializer.ts,
apps/rc/src/lib/library/json-parsers.ts (:12)

## Purpose

This spec defines the codec for SillyTavern's World Info format (also called
"worldbook" or "lorebook" in ST's own UI, file extension usually `.json`): an
`entries` object keyed by stringified integer UIDs, where each entry carries
keyword triggers, injection placement, and matching/timing/recursion controls.
It also covers the closely related Agnai lorebook variant, which uses an
`entries` *array* with different field names. This codec is the bridge between
that on-disk shape and the canonical `Lorebook`/`LorebookEntry` model defined
in `specs/formats/canonical-model.md`. It is the highest-traffic lorebook
codec in the suite: nearly every other tool (Agnai, RC, Lumiverse-adjacent
tools) either emits ST-shaped worldbooks directly or offers ST export as a
lowest-common-denominator interchange path.

VAUDEVILLE already has a mature, hand-built implementation of this exact
mapping in production (`packages/lorebook`). This spec is a port target: the
canonical field names, detection heuristics, and position/role numeric
mappings below are taken directly from that source, not reinvented.

## Behavior

### Format identity and detection

An ST world info file is a JSON object. The two format-defining shapes to
distinguish, per `format-detection.ts` (:44-148):

1. **ST format**: `entries` is present and is an **object** (not an array)
   whose keys are all numeric strings (`/^\d+$/`), e.g. `{"0": {...}, "1":
   {...}}`. Detected with confidence 0.9 when all keys are numeric; falls
   back to ST with confidence 0.3 if `entries` exists but the shape is
   ambiguous (format-detection.ts:118-147).
2. **RoleCall format** (out of scope here, see rolecall-lorebook.md): has an
   explicit `schemaVersion` string field plus `lorebook`/`exportDate`
   (confidence 1.0), OR `entries` is an **array** whose first item has
   RoleCall-only fields (`comment`, `scanUserPersona` /
   `scanCharacterDescription`) present (format-detection.ts:88-113).
3. **Agnai format** (this spec, secondary shape): `entries` is an **array**
   and the first entry has `keywords` (array) and/or both `name` + `entry`
   fields, per `parser.ts` legacy `detectFormat()` (parser.ts:216-218). Agnai
   entries do NOT have `key`/`comment`/`keysecondary`, which is how ST-array
   and Agnai-array shapes are told apart (parser.ts:212-219).

Detection order in the reference implementation: try `detectLorebookFormat`
(schemaVersion / RoleCall-array checks) first; if it returns `st` with
confidence > 0.7, treat as ST. Otherwise fall back to legacy per-entry field
sniffing that also covers Agnai (parser.ts:175-226). This codec's `detect()`
MUST replicate that two-stage order: RoleCall markers first (to avoid
misclassifying a RoleCall array export as Agnai), then ST numeric-keyed
object, then Agnai array-with-`keywords`/`name`+`entry`, then default to ST
if nothing else matches and `entries` exists at all (parser.ts:222,
"Default to ST if has entries").

Top-level ST lorebook fields observed: `entries`, `name`, `description`,
`scan_depth`, `token_budget`, `recursive_scanning`, `case_sensitive`,
`match_whole_words`, plus an arbitrary `originalData` passthrough bucket some
tools attach (parser.ts:116-127). Any of these not explicitly mapped below is
escrowed.

### Field map: ST entry -> canonical LorebookEntry

Canonical `LorebookEntry` shape is `packages/lorebook/src/types.ts:216-331`.
Column 3 ("native/escrow/dropped") states this codec's declared capability
for `vaud convert`'s honesty report; "notes" cites the exact conversion rule.

| ST field | Type | Canonical field | Native/escrow/dropped | Notes |
|---|---|---|---|---|
| `uid` | number\|string | (not stored on entry; used only as the object key / index) | escrow (`st.fields.uid` when non-sequential) | Reference codec regenerates positional index 0..n on export (serializer.ts:279 `uid: index`) and discards the original UID unless it differs from position, in which case escrow it so re-export can restore exact numbering. |
| `key` | string[] | `triggers[]` (each `{keyword, isRegex, flags}`) | native | Each string is tested against `/^\/([\w\W]+?)\/([gimsuy]*)$/` (regex-utils.ts:13); a match with no unescaped internal `/` becomes `{keyword: pattern, isRegex: true, flags}`, otherwise `{keyword: trimmed, isRegex: false}` (parser.ts:385-408). Empty/whitespace-only strings are dropped from the array. |
| `keysecondary` | string[] | `secondaryTriggers[]` | native | Same regex-detection rule as `key`. |
| `comment` | string | `title` | native | Falls back to `"Entry ${index+1}"` when absent/empty (parser.ts:441). |
| `content` | string | `content` | native | Defaults to `""` when absent. |
| `constant` | boolean | `constant` | native | Defaults `false`. |
| `selective` | boolean | (not stored directly; derived on export from `secondaryTriggers.length > 0`) | escrow only if it disagrees with derived value | Import ignores `selective` and instead treats presence of non-empty `keysecondary` as the selective signal; export recomputes `selective` from `secondaryTriggers.length > 0` (serializer.ts:286). If the source `selective` boolean is inconsistent with that derivation (e.g. `true` with empty `keysecondary`), the raw value is escrowed as `st.fields.selective` so a byte-identical round trip is still possible. |
| `selectiveLogic` | number (0-3) | `selectiveLogic` | native | Mapping (parser.ts:300-309, serializer.ts:148-156): `0`->`and_any`, `1`->`not_all`, `2`->`not_any`, `3`->`and_all`. Unknown/missing defaults to `and_any`. |
| `order` | number | `priority` | native | Passed through `normalizeLorebookPriority()` (parser.ts:311-315): if `0 < value < 1` it is treated as a legacy fractional weight and rescaled `round(value*100)` (min 1); otherwise rounded to nearest integer. |
| `position` | number\|string | `position` | native (see position table below) | See "Position mapping" below. RC-native positions (`append`, `append_bottom`, `prepend_top`) that collapse when exported to ST are recoverable via the `rcPosition` sidecar (below), not from `position` itself. |
| `rcPosition` | string (RC extension) | `position` (overrides value derived from `position`) | native, RC round-trip sidecar | Not part of the public ST spec. RC's own ST exporter writes it so an RC->ST->RC round trip does not lose `append`/`append_bottom`/`prepend_top`. Only honored if its value is one of the 9 valid `InjectionPosition` strings (parser.ts:267-274); otherwise ignored and the numeric `position` wins. |
| `depth` | number | `depth` | native | Only meaningful when `position` is `depth`/`append`/`append_bottom`; defaults to `4` when absent. |
| `role` | number\|string\|null | `role` | native | `0`/`"system"`->`system`, `1`/`"user"`->`user`, `2`/`"assistant"`->`assistant`; `null`/undefined/unrecognized->`system` (parser.ts:279-295). Export: `system`->`0`, `user`->`1`, `assistant`->`2` (serializer.ts:135-142; note export never emits `null`). |
| `caseSensitive` | boolean\|null | `caseSensitive` | native | `null` means "use lorebook global." Passed through as-is (`?? null`). |
| `matchWholeWords` | boolean\|null | `matchWholeWords` | native | Same null-means-global semantics as `caseSensitive`. |
| `scanDepth` | number | `scanDepth` | native | `null` if not a number; means "use lorebook global." |
| `sticky` | number | `sticky` | native | Defaults `0`. |
| `cooldown` | number | `cooldown` | native | Defaults `0`. |
| `delay` | number | `delay` | native | Defaults `0`. |
| `probability` | number | `probability` | native | Clamped to `[0,100]` only when `useProbability !== false`; otherwise the field is present but the effective import probability is `100` (parser.ts:429-433). |
| `useProbability` | boolean | (not stored; gates whether `probability` is honored on import) | escrow if `false` while `probability` is a non-100 number | See row above. On export, `useProbability` is recomputed as `exportProbability < 100` (serializer.ts:301), so the original boolean is only escrowed when it disagrees with that derivation. |
| `group` | string | `groupName` | native | Empty string normalized to `null`. Also drives `categoryId`: parser groups entries by distinct `groupName` into synthesized `LorebookCategory` records (parser.ts:1061-1081); export resolves `categoryId` back to a `group` name via the lorebook's `categories` list if `group` on the entry itself is empty (serializer.ts:384-387). |
| `groupWeight` | number | `groupWeight` | native | Defaults `1`. |
| `groupOverride` | boolean | escrow (`unsupportedFields.groupOverride`) | escrow | RC has no matching entry-level concept; preserved verbatim for round-trip (parser.ts:541, serializer.ts:305). |
| `useGroupScoring` | boolean\|null | escrow (`unsupportedFields.useGroupScoring`) | escrow | Same treatment as `groupOverride` (parser.ts:542, serializer.ts:311). |
| `excludeRecursion` | boolean | `excludeRecursion` | native | Defaults `false`. |
| `preventRecursion` | boolean | `preventRecursion` | native | Defaults `false`. |
| `delayUntilRecursion` | boolean\|number | `delayUntilRecursion` | native | Import: numeric value passed through, else `0` (a `true` boolean maps to `0`, since the reference reads only `typeof === 'number'`, parser.ts:491). **Export MUST emit the numeric level, not a boolean.** The reference serializer re-encodes as a boolean (`entry.delayUntilRecursion > 0`, serializer.ts:299), but that is an import/export asymmetry bug: the reference's own ST *input* type declares `delayUntilRecursion?: number` (parser.ts:82), i.e. ST accepts a numeric recursion level. Replicating the boolean export would break the Round-Trip Law — a source value of `3` (or even `1`) exports to `true`, which reparses to `0` (`typeof true !== 'number'`), so canonical `3 -> 0`, a parse-parse mismatch. Escrow cannot rescue this: `delayUntilRecursion` is a genuine canonical field (`LorebookEntry.delayUntilRecursion`, types.ts:288), so under escrow rule 4 the recomputed canonical value shadows any escrowed original (`escrowShadowed`). The clean-room codec therefore serializes the number directly and does not port the boolean coercion. OPEN QUESTION 6: confirm against a real modern ST worldinfo export that a numeric `delayUntilRecursion` is accepted by ST itself (the reference input type asserts it; cross-check with a live fixture). |
| `automationId` | string | escrow (`unsupportedFields.automationId`) | escrow | Preserved only when truthy (parser.ts:543). |
| `vectorized` | boolean | escrow (`unsupportedFields.vectorized`) | escrow | Preserved only when truthy (parser.ts:544). |
| `matchCharacterDepthPrompt` | boolean | escrow (`unsupportedFields.matchCharacterDepthPrompt`) | escrow | (parser.ts:545) |
| `matchCreatorNotes` | boolean | escrow (`unsupportedFields.matchCreatorNotes`) | escrow | (parser.ts:546) |
| `matchPersonaDescription` | boolean | `scanUserPersona` | native | Preferred name; legacy fallback field is `scanUserPersona` itself on very old exports — none observed, so only `matchPersonaDescription` is read (parser.ts:509). |
| `matchCharacterDescription` | boolean | `scanCharacterDescription` | native | Falls back to legacy key `scanCharacterDescription` if `matchCharacterDescription` is absent (parser.ts:507). |
| `matchCharacterPersonality` | boolean | `scanCharacterPersonality` | native | (parser.ts:508) |
| `matchScenario` | boolean | `scanScenario` | native | (parser.ts:510) |
| `characterFilter` | `{names?, tags?, isExclude?}` | `characterFilter` | native | `null` if absent; otherwise `{names: names ?? [], tags: tags ?? [], isExclude: isExclude ?? false}` (parser.ts:498-502). |
| `enabled` | boolean | `enabled` | native | See enabled/disable precedence below. |
| `disable` | boolean | `enabled` (inverted) | native | See enabled/disable precedence below. |
| `displayIndex` | number | `sortOrder` | native | Falls back to the entry's array/object-iteration index if absent (parser.ts:468). |
| `addMemo` | boolean | `useMemo` | native | Defaults `false`. |
| `triggers` | string[] (generation-type hooks: `onMessage`/`onSwipe`/etc.) | escrow (`unsupportedFields.generationTriggers`) | escrow | NOTE: this is a *different* field from canonical `triggers[]` (keyword triggers) despite the name collision — ST overloads `triggers` for generation-event hooks RC does not implement. Read from `raw.triggers` first, `raw.generationTriggers` as fallback (parser.ts:552-559). Exported back under the ST key name `triggers` (serializer.ts:334), not `generationTriggers`. |
| `outletName` | string | escrow (`unsupportedFields.outletName`) | escrow | Preserved only when truthy (parser.ts:560). |
| `ignoreBudget` | boolean | `ignoreBudget` | native | Defaults `false` (parser.ts:515; a prior bug hardcoded this to always-false, now fixed). |
| `sideEffects` | `EntrySideEffects \| null` (RC extension, ST ignores unknown keys) | `sideEffects` | native, RC round-trip sidecar | Not part of the public ST spec; RC's own ST exporter embeds it so an RC->ST->RC round trip preserves variable-mutation side effects (parser.ts:526, serializer.ts:342-344). |

Fields with **no row above** that appear on a real-world ST entry (any
unrecognized key) are escrowed verbatim under `escrow.st.fields.entries[uid].<key>`
per the general escrow rule in `specs/formats/escrow-and-roundtrip.md` rule 1.
The reference implementation's `unsupportedFields` bucket (types.ts:322-330)
is the in-memory precedent for this: it is explicitly documented as
non-persisted, import/export-only preservation, which is exactly the escrow
envelope's job in this suite (the canonical model does not keep a parallel
`unsupportedFields` bag; escrow replaces it).

**Canonical fields ST cannot express at all** (native only in the RoleCall
schema, always escrow-free but simply blank/default on ST import, and dropped
with a warning on ST export if set): `comment` (RC internal notes — ST field
name collision with `title`'s source, see above; RC's `comment` has no ST
home and is silently omitted, generating `STExportWarnings.commentLost`,
serializer.ts:256-259), `allowRecursion` (ST has no such concept; import
always sets `false`, parser.ts:488), `boostIds`/`boostAmount` (RC cross-entry
boosting; import always `[]`/`0`, parser.ts:494-495; export drops silently,
generates `rcFeaturesLost` warning class if used), `probabilityMode` (import
always `highest`; per-trigger advanced probabilities are an RC extension —
see Advanced triggers below), `scanPreset` (ST has no such scan source; import
always `false`, parser.ts:511), `metadata` (RC/TunnelVision JSONB bag; no ST
representation, not written by this codec at all — see OPEN QUESTION 5).

### Position mapping

`InjectionPosition` values and their ST numeric encoding (types.ts:159-191,
parser.ts:236-261, serializer.ts:116-129):

| Canonical `position` | ST `position` number (export) | ST `position` number/string accepted (import) | Notes |
|---|---|---|---|
| `world` | `0` | `0`, or string containing `"world"`, or `"before_char"` | Before character card. |
| `character` | `1` | `1`, or string containing `"character"`, `"after_char"`, or **any unrecognized value** | Default fallback for unknown positions on both import and export. |
| `before_example` | `2` | `2`, or string `"before_example"` | Preserved distinctly from `after_example` — a prior version of the codec collapsed both to one value; this was fixed specifically to stop data loss (parser.ts:256 comment "PRESERVED - no longer lossy!"). |
| `after_example` | `3` | `3`, or string `"after_example"` | See above. |
| `depth` | `4` | `4`, or string containing `"depth"`, or `"at_depth"` | Uses the `depth` field for placement. |
| `append` (RC extension) | `4` + `rcPosition: "append"` sidecar | `rcPosition` sidecar only (numeric `position` alone cannot express it) | "Glue onto the end of the depth-th-from-last message of the entry's role"; collapses to plain `depth` (4) if the sidecar is stripped by an intermediate tool. |
| `append_bottom` (RC extension) | `4` + `rcPosition: "append_bottom"` sidecar | `rcPosition` sidecar only | Pinned to the very end of the assembled prompt. |
| `prepend_top` (RC extension) | `0` + `rcPosition: "prepend_top"` sidecar | `rcPosition` sidecar only | Pinned to the very top of the assembled prompt. |
| `scene` (legacy/generic) | `2` | string containing `"scene"`, or `"in_chat"` | Maps to `before_example` on export "for compatibility" (serializer.ts:126 comment); this is a lossy many-to-one collapse with `before_example` itself — round-tripping a `scene`-position entry through ST changes it to `before_example`. Flag as a known lossy edge case, not a bug to fix in this codec (matches reference behavior). |

Import precedence when both `rcPosition` and numeric `position` are present:
`rcPosition` wins if it parses to one of the 9 valid values; otherwise the
numeric/string `position` is used (parser.ts:463, "rcPosition sidecar wins").

### `enabled`/`disable` precedence

ST worldbook entries may carry either `enabled` (true = on) or `disable`
(true = off, i.e. inverted), or both, or neither. Reference precedence
(parser.ts:424-427): default `enabled = true`; if `raw.enabled !== undefined`
use it; **then**, if `raw.disable !== undefined`, `enabled = !raw.disable`
(this check runs second and therefore wins if both keys are present and
conflict). Export always emits `disable: !entry.enabled` only (serializer.ts:296);
`enabled` is never written on export, so an ST round trip through this codec
normalizes any source `enabled`+`disable` pair down to a single `disable` key.

### Agnai variant

Agnai lorebook entries are a distinct, simpler array-based shape (parser.ts:132-150):

| Agnai field | Canonical field | Notes |
|---|---|---|
| `name` | `title` | Falls back to `"Entry ${index+1}"`. |
| `entry` | `content` | Falls back to `""`. |
| `keywords` | `triggers[]` | Same regex-detection rule as ST `key` (shared `parseKeywords()` helper, parser.ts:607). |
| `secondaryKeys` | `secondaryTriggers[]` | Same rule. |
| `priority` | `priority` | Through `normalizeLorebookPriority()`. |
| `weight` | `groupWeight` | Defaults `1`. |
| `enabled` | `enabled` | Defaults `true`. |

Everything else on an Agnai entry defaults to the same baseline as a bare ST
entry with no matching fields: `selectiveLogic: 'and_any'`, `position:
'character'`, `depth: 4`, `role: 'system'`, `constant: false`,
`triggerMode: 'simple'`, all timing/recursion/scan fields at their zero
values (parser.ts:595-663). Agnai has no serializer in the reference codebase
— `serializer.ts` only emits ST and RoleCall formats. This suite's codec MUST
still implement Agnai *parse* (detection + field map above); Agnai
*serialize* is out of scope until a concrete need appears (OPEN QUESTION 1).

### Advanced triggers (per-trigger probability)

ST has no per-keyword probability — only the single entry-level
`probability`. RC's `AdvancedTrigger` (`{keyword, isRegex, flags?,
probability}`, types.ts:70-72) is an extension with no ST import path: ST
import always produces `SimpleTrigger`s and deliberately does NOT stamp a
`probability` onto them (parser.ts:376-384, "must NOT stamp a `probability`
field... otherwise the ST exporter... corrupts the value"). On export, if any
trigger in `triggers`+`secondaryTriggers` carries a `probability` that
differs from the entry-level `probability`, export uses `Math.max(...)`
across all of them and emits a `mixedProbabilities` warning
(serializer.ts:217-250); this is unavoidable, declared data loss and MUST be
reported as `escrowShadowed`/`dropped` per this file's capabilities matrix,
not silently accepted.

### Categories / grouping

ST has no explicit category object — only the free-text `group` string per
entry. On ST import, this codec must synthesize `LorebookCategory` records
(`{id, lorebookId, name, sortOrder, enabled: true}`) from the set of distinct
non-empty `group` values, in first-seen order, and set each entry's
`categoryId` to the matching category (parser.ts:1061-1081). On export, an
entry's `group` string is emitted directly if set; otherwise, if the entry
has a `categoryId` that resolves in the lorebook's `categories` list, that
category's `name` is used as `group` (serializer.ts:384-387).

### Lorebook-level (top-of-file) field map

| ST field | Canonical field | Notes |
|---|---|---|
| `name` | `name` | Falls back to `"Imported Lorebook"` if absent/blank (`normalizeNameCandidate`, resolved further by `resolveLorebookImportName` using filename/first-entry-named-"name" heuristics — see Edge case 6). |
| `description` | `description` | `null` if absent. |
| `scan_depth` | `globalScanDepth` | Defaults `100` on import if absent. |
| `token_budget` | `tokenBudget` | Defaults `0`. |
| `recursive_scanning` | `globalRecursion` | Defaults `false`. |
| `case_sensitive` | `globalCaseSensitive` | Defaults `false`. |
| `match_whole_words` | `globalMatchWholeWords` | Defaults `false`. |
| `budgetMode`, `entryBudget` | `budgetMode`, `entryBudget` | Not present in ST source at all; always defaulted (`'token'`, `20`) on ST import — these are RC/canonical-only concepts with no ST equivalent, dropped silently on ST export (ST has no budget-mode field to write). |
| `originalData` | escrow (`st.fields.originalData`) | Passthrough bucket some tools attach; not read or interpreted, preserved opaquely. |

## Public API sketch

```ts
// packages/formats/src/st-worldinfo.ts

import type { Lorebook, LorebookEntry } from '@vaudeville/core';
import type { Escrow, ParseReport, SerializeReport } from '@vaudeville/core';

export interface STWorldInfoCodec {
  readonly id: 'st-worldinfo';

  /** Cheap structural sniff; does not throw. Confidence in [0,1]. */
  detect(json: unknown): { matches: boolean; confidence: number; variant: 'st' | 'agnai' };

  /** Full parse. Never throws on malformed input; failures surface as
   *  ParseReport.errors and a null-safe partial result where possible. */
  parse(json: unknown, opts?: { filename?: string }): {
    data: Lorebook;
    entries: LorebookEntry[];
    escrow: Escrow;
    report: ParseReport;
  };

  /** Serialize back to ST worldbook JSON (numeric-keyed entries object). */
  serialize(data: Lorebook, entries: LorebookEntry[], escrow: Escrow): {
    json: unknown; // the ST-shaped object, ready for JSON.stringify
    report: SerializeReport;
  };

  /** Capabilities matrix for the format-support docs page. */
  readonly capabilities: Record<string, 'native' | 'escrow' | 'dropped'>;

  readonly byteIdentityLevel: 'semantic';
}

export const stWorldInfoCodec: STWorldInfoCodec;

/** Agnai is parse-only (see Non-goals). Exposed separately so `detect()`
 *  callers can route to the right variant without a serialize() that
 *  would silently no-op. */
export interface AgnaiLorebookCodec {
  readonly id: 'agnai-lorebook';
  detect(json: unknown): { matches: boolean; confidence: number };
  parse(json: unknown, opts?: { filename?: string }): {
    data: Lorebook;
    entries: LorebookEntry[];
    escrow: Escrow;
    report: ParseReport;
  };
}

export const agnaiLorebookCodec: AgnaiLorebookCodec;
```

## Edge cases & failure modes

1. **`entries` present but empty (`{}` or `[]`)** — valid, zero-entry
   lorebook. Not an error; `ParseReport.warnings` may note it but `errors`
   must stay empty.
2. **Mixed numeric and non-numeric keys in an object `entries`** — per
   `hasNumericKeys = keys.length > 0 && keys.every(...)` (format-detection.ts:124),
   ANY non-numeric key drops confidence to the 0.3 fallback tier. This codec's
   `detect()` must still attempt the ST parse at low confidence rather than
   refusing outright, matching reference behavior (parser.ts:222 default).
3. **`key`/`keysecondary` entries that look like partial regex** (e.g. start
   with `/` but have unescaped internal `/` or invalid regex syntax) — NOT
   treated as regex; `parseRegexFromString` returns `null` for anything that
   fails `new RegExp()` construction or has an unescaped delimiter
   (regex-utils.ts:21,29-33), so the whole string (including the leading
   slash) becomes a literal plain keyword. This must not throw.
4. **`selectiveLogic` given as a string instead of a number** (some
   community exports have been observed doing this) — OPEN QUESTION: the
   reference parser's `parseSelectiveLogic` signature is `number | undefined`
   only (parser.ts:300); string input is not defensively handled there.
   OPEN QUESTION: confirm whether a stray string value should escrow-and-default
   or throw a recoverable per-entry error. Default posture per this suite's
   error philosophy (never throw on one bad field): treat as `undefined` ->
   `and_any`, and escrow the original string under
   `st.fields.entries[uid].selectiveLogic`.
5. **`position` as an unrecognized string** (not matching any substring
   rule in the position table) — falls through to `character` (parser.ts:248,
   259). This is silent normalization, not an error; MUST NOT be reported as
   `dropped` since it maps to a defined canonical value, but SHOULD be
   escrowed under `st.fields.entries[uid].position` if the original string
   doesn't round-trip byte-identically through `positionToNumber`.
6. **Duplicate/derivable lorebook name resolution** — `resolveLorebookImportName`
   (parser.ts:354-366) tries, in order: an explicit caller-supplied `name`
   option, then the file's own `name` field (rejected if it's literally the
   placeholder string `"Imported Lorebook"`), then a name derived from an
   entry whose `title` is exactly `"name"` (case-insensitive) by taking its
   content's first non-blank line and stripping a `name:`/`name=`/`name-`
   prefix, then a name sanitized from the source filename, then finally the
   literal fallback `"Imported Lorebook"`. This codec's `parse()` must
   replicate this chain when a `filename` option is supplied; without a
   filename, the chain simply skips that step.
7. **`uid` values that are non-sequential or have gaps** (e.g. `{"0":...,
   "5":...}`) — import must NOT assume UIDs are dense/contiguous; iterate
   `Object.values(entries)` in object key-insertion order (parser.ts:1043,
   `Object.values(data.entries)`), and use the iteration index (not the UID
   itself) for `sortOrder` fallback. On export, positional UIDs are
   regenerated from `0..n-1` (serializer.ts:279); this is a declared
   byte-identity break — see byte-identity level below.
8. **A ST entry uses `triggers` for both a generation-hook array (legacy
   overload) AND the codec later needs the canonical `triggers[]`** — no
   collision in canonical output because `LorebookEntry.triggers` is always
   sourced from ST `key`, never from ST `triggers`; the ST `triggers` field
   is exclusively escrowed as `unsupportedFields.generationTriggers` /
   canonical escrow. Document this explicitly to prevent an implementing
   agent from wiring the wrong source field.
9. **Regex trigger with flags round-tripping through `escapeUnescapedSlashes`** —
   export re-escapes any unescaped `/` inside a stored regex `keyword` before
   wrapping it in `/pattern/flags` (serializer.ts:162-177, 190). A pattern
   containing an already-escaped `\/` must not become double-escaped; the
   escaper only touches slashes NOT already preceded by `\`.
10. **`characterFilter` with empty `names`/`tags` but `isExclude: true`
    present** — imports as `{names: [], tags: [], isExclude: true}`, a
    valid-but-vacuous blacklist-of-nothing. Not an error.
11. **Zero probability (`probability: 0`)** — imported as-is (not treated as
    "absent"/default); reference code emits a distinct advisory warning
    (`STImportWarnings.zeroProbability`, parser.ts:578-580) since a
    permanently-silent entry is often unintentional. This codec's
    `ParseReport.warnings` should carry an equivalent note.
12. **Entry with no triggers and not `constant`** — imports successfully but
    is effectively unreachable (can never fire). Reference code warns
    (`STImportWarnings.noTriggers`, parser.ts:573-575) but does not error or
    drop the entry.
13. **Non-JSON-object top-level input** (array, string, number, null) —
    `detectLorebookFormat` throws `'Invalid JSON: Expected object'`
    (format-detection.ts:46); the legacy fallback path in `parseLorebook`
    catches that and falls through to its own array/shape checks
    (parser.ts:181-195), ultimately returning `format: 'unknown'` with a
    populated `errors[]` and `lorebook: null` if nothing matches
    (parser.ts:1227-1236). This codec must not throw out of `parse()`; it
    returns a report with `errors` populated instead.
14. **`scene` position round-trip loss** — see Position mapping table:
    `scene` and `before_example` both export to ST position `2`, so
    `scene` cannot be recovered from a foreign ST round trip once the
    original canonical entity is gone. This is inherent to the ST format
    (it has no `scene` position at all) and is NOT something this codec can
    fix; it must be listed plainly in the capabilities matrix as `escrow`
    only when the *canonical* origin was ST-adjacent RC data carrying a
    `scene` value already (i.e., the codec should escrow `position: 'scene'`
    itself when serializing FROM canonical TO st-worldinfo, so a future
    parse of that same file by an RC-aware reader could recover it via
    escrow, even though plain ST itself cannot).

## Test plan

Fixtures required (place under `fixtures/st-worldinfo/`):

- `minimal.json` — one entry, only `key`/`comment`/`content` set, everything
  else default. Exercises baseline defaulting.
- `full-fields.json` — one entry with every documented ST field populated
  (including `groupOverride`, `automationId`, `vectorized`,
  `matchCharacterDepthPrompt`, `matchCreatorNotes`, `outletName`,
  `triggers` generation hooks) to exercise the full escrow set.
- `regex-triggers.json` — entries with `/pattern/flags` keys, including one
  with an unescaped internal slash (must NOT parse as regex) and one with an
  escaped slash inside the pattern (must round-trip without double-escaping).
- `positions-all.json` — nine entries, one per `InjectionPosition` value
  (including RC-extension `append`/`append_bottom`/`prepend_top` via
  `rcPosition` sidecar, and legacy `scene`), to pin the full position table.
- `enabled-disable-conflict.json` — entries covering all four combinations of
  `enabled`/`disable` presence to pin the precedence rule.
- `advanced-probability-mixed.json` — RC-authored ST export with
  `sideEffects` present and mixed per-trigger probabilities (via the
  `AdvancedTrigger`-shaped objects RC's own exporter never emits to ST, but a
  hand-crafted fixture simulating a third-party tool that does) to exercise
  the `mixedProbabilities` max-and-warn path.
- `agnai-basic.json` — Agnai-shaped array lorebook (`keywords`/`name`/`entry`)
  to exercise the variant parse path and confirm it is NOT misdetected as ST.
- `groups-to-categories.json` — multiple entries sharing `group` strings, to
  pin category synthesis and `categoryId` back-resolution on export.
- `malformed-not-an-object.json`, `malformed-empty.json` — negative cases for
  edge case 13, must return a report with errors, never throw.
- `sparse-uids.json` — non-contiguous numeric keys (`"0"`, `"7"`, `"12"`) to
  pin edge case 7 (index-based iteration, not UID-based).
- `filename-derived-name.json` — no `name` field, imported with a `filename`
  option, to pin edge case 6's fallback chain.

Round-Trip Law applicability: **applies** for the ST variant at
`byteIdentityLevel: 'semantic'` (declared above) — NOT `canonical-json` or
`byte`, because of the known lossy normalizations documented in this spec
(UID regeneration, `enabled`/`disable` collapse to `disable`-only,
`selective` boolean recomputation, `scene`/`before_example` collapse,
per-trigger probability max-and-collapse). Every fixture's
`serialize(parse(F))` must still produce a file that reparses to a
deep-equal canonical entity + escrow as the original parse, per the Law's
actual definition (parse-parse equality, not byte equality). The Agnai
variant is **parse-only** (see Non-goals) so the Round-Trip Law does not
apply to it directly; instead, Agnai fixtures are asserted only against a
fixed `expected.json` canonical shape.

Property/unit tests beyond fixtures:

- `parsePosition`/`positionToNumber` inverse-mapping table test (all 9
  canonical values against every accepted numeric/string ST input variant).
- `parseSelectiveLogic`/`selectiveLogicToNumber` full 0-3 round trip.
- `normalizeLorebookPriority` fractional-vs-integer boundary test at
  exactly `1` and just below/above.
- Fuzz test: random valid JSON objects with an `entries` object of numeric
  keys and random extra unknown keys — assert `parse()` never throws and
  every unknown key surfaces in escrow.

## Non-goals

- **Agnai serialize.** This codec parses Agnai lorebooks into canonical form
  but does not serialize canonical -> Agnai. The reference implementation has
  no Agnai serializer either. Add it only if a concrete user need surfaces
  (OPEN QUESTION 1).
- **RoleCall's own export format.** Covered by `specs/formats/rolecall-lorebook.md`.
  This spec's detection logic must correctly hand off to that codec (not
  misclassify RoleCall array/schemaVersion exports as ST or Agnai) but does
  not itself parse RoleCall's shape.
- **The lorebook trigger-matching/activation engine.** Covered by
  `specs/engine/lorebook-engine.md`. This spec only defines the JSON <->
  canonical mapping, not runtime activation behavior.
- **Editing or validating entry content quality** (e.g. token budget
  warnings, contradiction detection). Covered by the Script Doctor specs.
- **Compendium/`metadata` JSONB authoring.** ST has no representation for it
  at all; this codec never writes it and, per OPEN QUESTION 5, does not read
  it either (there is nothing to read from an ST source).

## Sources consulted

- `<RoleCall>\packages\lorebook\src\types.ts` (lines
  1-200 trigger/position/role/side-effect types, 216-331 `LorebookEntry`,
  342-402 `Lorebook`/`LorebookWithEntries`)
- `<RoleCall>\packages\lorebook\src\format-detection.ts`
  (full file; detection precedence, confidence scoring)
- `<RoleCall>\packages\lorebook\src\parser.ts` (full
  file; ST/Agnai/RoleCall parse functions, position/role/selectiveLogic
  numeric mapping, name resolution chain, unsupported-field capture)
- `<RoleCall>\packages\lorebook\src\serializer.ts`
  (full file; ST export field-by-field construction, position/role/selectiveLogic
  export mapping, category resolution, mixed-probability collapse)
- `<RoleCall>\packages\lorebook\src\regex-utils.ts`
  (lines 1-60; `parseRegexFromString`/`escapeUnescapedSlashes` behavior)
- `<RoleCall>\apps\rc\src\lib\library\json-parsers.ts`
  (lines 1-120; app-level `LorebookEntry`/`isLorebook` shape, confirms the
  same field set is used at the UI layer)
- `docs\00-MASTER-PLAN.md`,
  `docs\02-ARCHITECTURE.md`, `docs\06-PRODUCTION-BIBLE.md` (project
  conventions, dependency rules, this file's brief)
- `specs\formats\canonical-model.md`,
  `specs\formats\escrow-and-roundtrip.md` (shared envelope, escrow rules,
  Round-Trip Law definition)
- `templates\SPEC-TEMPLATE.md`
  (structure followed)

OPEN QUESTION 1: Should this codec ever serialize canonical -> Agnai format?
No production need identified in VAUDEVILLE (no Agnai serializer exists
there). Left as a non-goal until a concrete use case appears.

OPEN QUESTION 2: For edge case 4 (`selectiveLogic` given as a string in some
third-party export), confirm the intended behavior (escrow-and-default vs.
per-entry recoverable error) with an actual malformed fixture from the wild,
since the reference implementation's type signature does not anticipate this
input and no runtime guard was found.

OPEN QUESTION 3: Is there a canonical public ST World Info JSON schema
document (versioned) this suite should also cite directly, beyond the
VAUDEVILLE implementation? The production bible's ground-truth row for this
file lists only VAUDEVILLE paths (no public-spec citation instruction, unlike
the chara-card/charx/backyard rows), so this spec treats VAUDEVILLE's
implementation as authoritative and does not cite an external ST spec
document. If Chi wants a public cross-check added, name the source.

OPEN QUESTION 4: The exact confidence threshold and tie-breaking between "ST
with low confidence (0.3 fallback)" and "Agnai" when an object has `entries`
as an array with entries that match neither ST nor Agnai per-entry field
signatures (i.e., truly ambiguous minimal entries like `{}`) is not fully
specified by the reference implementation (parser.ts:198-223 falls through to
`'sillytavern'` as the final default for any array/object entries shape that
didn't hit an earlier branch). This spec follows that same default-to-ST
behavior; flagging in case a stricter Agnai-first or unknown-format result is
preferred for the clean-room implementation.

OPEN QUESTION 5: Should the codec read a `metadata`-shaped JSONB blob if a
third-party tool ever attaches one to an ST entry under some non-standard
key, to preserve it as escrow? No such observed field exists in ST's public
usage or in the VAUDEVILLE parser (`metadata` is only populated on the
RoleCall import path, parser.ts:774-776). Current spec position: no,
`metadata` has no ST-side representation to read from; treat as a
RoleCall-only concept for this codec.
