# Spec: Regex Scripts

**Package:** `packages/formats` (codec) + `packages/core` (canonical `RegexScript` type) ·
**Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md
**VAUDEVILLE reference:** `apps/rc/src/lib/regex/apply-regex.ts`, `apps/rc/src/lib/regex/import-st-regex.ts`,
`apps/rc/src/app/api/content/regex-scripts/[id]/export/route.ts`,
`apps/rc/src/components/regex/RegexEditor.tsx`, `apps/rc/src/lib/library/json-parsers.ts`

## Purpose

Regex scripts are user-authored find/replace rules that transform text at named
points in the roleplay pipeline (user input, AI output, display, prompt assembly,
lorebook entries, reasoning channel). This spec defines the canonical `RegexScript`
model, the SillyTavern JSON codec (parse + serialize, including the placement-number
mapping and its known asymmetry in the VAUDEVILLE reference implementation), the
RC-native `linkedRegexScripts` embedding used inside presets, and the substitution
semantics (`{{match}}`, `$&`, `$<name>`, `$N`, `trim_strings`) that both codecs and
the runtime engine (specs/engine/*) must implement identically. It does not define
the NL regex *builder* (pattern authoring UI) — see Non-goals.

## Behavior

### 1. Canonical model

`packages/core` defines the canonical shape. It is a rename of VAUDEVILLE's runtime
`RegexRule`/`RegexScript` (`apps/rc/src/lib/regex/apply-regex.ts:31-51`) from
DB-snake_case to camelCase, matching the convention already used for `Lorebook`/
`LorebookEntry`:

```ts
type RegexPlacement =
  | "user_input"    // user text just before it joins the outgoing prompt
  | "ai_output"      // model text just after streaming completes
  | "display_only"   // cosmetic transform that never reaches the wire
  | "prompt_only"     // the assembled outgoing prompt (all messages), just before inference
  | "lorebook"         // lorebook entry text after macro expansion
  | "reasoning";        // the reasoning/<think> channel specifically

interface RegexRule {
  id: string;
  name: string;
  description: string | null;
  findPattern: string;       // regex source, WITHOUT surrounding /slashes/
  replaceString: string;
  placement: RegexPlacement[];
  flags: string;              // JS RegExp flags, e.g. "gm", "gis"
  enabled: boolean;
  minDepth: number | null;
  maxDepth: number | null;
  runOnEdit: boolean;
  sortOrder: number;          // application order within a script; array order is NOT authoritative
  trimStrings: string[];
}

interface RegexScript {
  id: string;
  name: string;
  description: string | null;
  rules: RegexRule[];
}
```

Canonical field notes:

- `findPattern` never carries the `/pattern/flags` wrapper; flags always live in the
  separate `flags` field. This matches the parsed (not source-JSON) shape in
  VAUDEVILLE (`import-st-regex.ts:36-45,62-76`).
- `sortOrder` is authoritative for application order, not array position — the
  runtime engine sorts by it before applying rules
  (`apply-regex.ts:111`: `applicableRules.sort((a, b) => a.sort_order - b.sort_order)`).
  Codecs must preserve `sortOrder`, not just array order, on round-trip.
- `placement` is always an array, even for a single value.
- Canonical model has no analog of ST's `id` (a slugified script id, distinct from
  the rule's canonical `id`) or `substituteRegex` (see escrow, section 4).

### 2. SillyTavern JSON codec

**Source shape** (`import-st-regex.ts:16-28`, `SillyTavernRegex` interface — this is
the shape ST scripts export as, one object per rule; RC treats "script" and "rule"
as 1:1 when importing raw ST JSON):

```ts
interface SillyTavernRegex {
  scriptName: string;
  findRegex: string;            // "/pattern/flags" wrapped form
  replaceString: string;
  trimStrings?: string[];
  placement?: (string | number)[];
  minDepth?: number | null;
  maxDepth?: number | null;
  runOnEdit?: boolean;
  disabled?: boolean;
  markdownOnly?: boolean;
  promptOnly?: boolean;
  // Present on ST/RC exports but NOT read by the parser — escrow (section 4):
  // id?: string;
  // substituteRegex?: number;
}
```

**Detection.** A JSON value is a candidate regex-script document if (structural
detection, `json-parsers.ts:174-212`, `isRegexScript`):

- it is `{ data: [...] }` where every element has a string `findPattern`,
  `scriptName`, or `name`, OR
- it is a bare array where every element has a string `findPattern`, `scriptName`,
  or `name`, OR
- it is a single object with a string `findPattern` or `scriptName`, or a string
  `name` co-occurring with a string `findPattern`.

Detection priority against other content types, in `detectJsonType`
(`json-parsers.ts:252-268`): `persona > character > lorebook > regex > preset`.
Regex is checked before preset specifically to avoid a regex document (which can
carry sampler-adjacent-looking fields) being misdetected as a preset — see
specs/formats/content-detection.md for the full ordering and its rationale.

**Parse: `findRegex` unwrap.** `findRegex` is `/pattern/flags`. The wrapper regex
MUST use a dot-all-safe character class, not `.`, to unwrap multi-line patterns:

```
/^\/([\s\S]+)\/([gimsuvy]*)$/
```

(`import-st-regex.ts:72`, fixed under VVS-502 — the original `.+` unwrap silently
failed on any `findRegex` containing a newline and stored the raw
`"/pattern/flags"` string, slashes included, as `findPattern`, corrupting the
pattern and inflating it toward storage caps.) If `findRegex` does not match the
wrapper form (no leading/trailing slash pair), it is used as-is for `findPattern`
and `flags` defaults to `"gm"`.

**Parse: placement mapping (source of truth, current and correct).** ST placement
numbers map to canonical `RegexPlacement` as follows
(`import-st-regex.ts:79-97`, this is ST's own `regex_placement` enum):

| ST number | ST constant | Canonical placement |
|---|---|---|
| 0 | MD_DISPLAY | `display_only` |
| 1 | USER_INPUT | `user_input` |
| 2 | AI_OUTPUT | `ai_output` |
| 3 | SLASH_COMMAND | not supported — falls back to `ai_output` |
| 5 | WORLD_INFO | `lorebook` |
| 6 | REASONING | `reasoning` |
| any other number (incl. missing/unknown, e.g. 4) | — | falls back to `ai_output` |

If a placement entry is already one of the six canonical strings (re-parsing a
document that came from RC's own flat export, or from `linkedRegexScripts`), it
passes through unchanged rather than falling into the numeric map (RC placement
strings: `user_input`, `ai_output`, `display_only`, `prompt_only`, `lorebook`,
`reasoning` — `import-st-regex.ts:102-116`).

If `placement` is missing entirely, default to `["ai_output"]`
(`import-st-regex.ts:111`, confirmed by `st-placement-map.test.ts:71-78`).

**Parse: format-only flag overlay.** After the base placement mapping, two ST-only
boolean flags reinterpret an `ai_output` entry (`import-st-regex.ts:117-123`,
pinned by `st-format-flags.test.ts`):

- `promptOnly: true` → every `ai_output` entry in the placement array becomes
  `prompt_only`.
- `markdownOnly: true` → every `ai_output` entry becomes `display_only`.
- `promptOnly` is checked first; if both are present, `promptOnly` wins (the code
  is an `if/else if`, `import-st-regex.ts:118-122`).
- The result is de-duplicated (`Array.from(new Set(...))`,
  `import-st-regex.ts:123`).

**Parse: remaining field mapping.**

| Source field | Canonical field | Notes |
|---|---|---|
| `scriptName` | `name` | default `Regex ${index+1}` if absent |
| (none) | `description` | always `null` on ST parse; ST has no description field |
| `findRegex` | `findPattern` + `flags` | unwrapped per above |
| `replaceString` | `replaceString` | default `""` |
| `placement` | `placement` | mapped per above; default `["ai_output"]` |
| `disabled` | `enabled` | `enabled = !disabled`; default `enabled = true` |
| `minDepth` | `minDepth` | `?? null` |
| `maxDepth` | `maxDepth` | `?? null` |
| `runOnEdit` | `runOnEdit` | `item.runOnEdit !== false` — i.e. defaults to `true`, only `false` when explicitly set |
| `trimStrings` | `trimStrings` | default `[]` |
| (array index) | `sortOrder` | assigned as the rule's position in the input array |
| `id` | escrow (`sillytavern`) | not read into canonical; see section 4 |
| `substituteRegex` | escrow (`sillytavern`) | not read into canonical; see section 4 |
| `promptOnly` | `placement` overlay | consumed into placement per Behavior section 2; not escrowed |
| `markdownOnly` | `placement` overlay | consumed into placement per Behavior section 2; not escrowed |
| any other unrecognized key | escrow (`sillytavern`) | catch-all, see section 4 |

**`{ data: [...] }` wrapper.** `isRegexScript` (section 2, Detection) also accepts a
document shaped `{ data: [SillyTavernRegex, ...] }`. When detected in this shape,
unwrap to the inner array before running `parseSillyTavernRegex` on it; the wrapper
key itself (`data`) carries no information beyond "this is an array" and is not
escrowed.

**Serialize to SillyTavern format — use the CORRECT inverse, not the reference
export route.** VAUDEVILLE's live export endpoint
(`apps/rc/src/app/api/content/regex-scripts/[id]/export/route.ts:8-15`,
`RC_TO_ST_PLACEMENT`) implements the OLD, pre-VVS-fix shifted-by-one map:

```
user_input → 0, ai_output → 1, display_only → 2, lorebook → 1, reasoning → 1
```

This is a known bug in the reference implementation, not a spec. It is the exact
off-by-one error the import side fixed and pinned a regression test for
(`st-placement-map.test.ts:1-21`: "Earlier versions of this map had everything
shifted by one... silently routed every imported `[2]` script to `display_only`").
The export route was never updated to match. Consequence in production: RC → ST
JSON → RC through the flat `regex_scripts` field is lossy (an `ai_output` rule
exports as `1` and re-imports as `user_input`) — this is precisely why
`linkedRegexScripts` (section 3) exists as the lossless RC-to-RC path
(`preset-regex-roundtrip.test.ts:1-28`).

**Do not port this bug.** The Vaudeville Studios codec MUST serialize using the
correct inverse of the parse-side map in this spec:

| Canonical placement | ST number |
|---|---|
| `display_only` | 0 |
| `user_input` | 1 |
| `ai_output` | 2 |
| `lorebook` | 5 |
| `reasoning` | 6 |
| `prompt_only` | 2, with `promptOnly: true` set on the output object |

Additional serialize rules:

- `prompt_only` has no ST placement number; emit ST placement `2` and set
  `promptOnly: true` on the rule object (mirrors the format-only-flag overlay used
  on parse, in reverse).
- `display_only` may alternatively be expressed as ST placement `2` with
  `markdownOnly: true`; prefer the direct `0` mapping (fewer flags, matches the
  documented ST enum) — the `markdownOnly` form exists only because it is
  ST's own alternate spelling for the same target and the parser accepts both.
- `findPattern` + `flags` re-wrap to `` `/${findPattern}/${flags}` ``.
- `enabled: false` → `disabled: true`; `enabled: true` (or missing) → `disabled`
  omitted or `false`.
- `id`, `name`→`scriptName`, `trimStrings`→`trimStrings`, `minDepth`, `maxDepth`,
  `runOnEdit` map straight across.
- Escrowed `sillytavern.fields.id` and `sillytavern.fields.substituteRegex`, if
  present, are re-emitted at their original keys (Round-Trip Law, escrow rule 2).
  If no escrowed `id` exists (canonical-only rule, never parsed from ST), synthesize
  one: slugify `name` (`name.toLowerCase().replace(/[^a-z0-9]+/g, "-")`) — this
  matches the reference export's synthesis fallback
  (`route.ts:43`) and keeps output stable/deterministic.
- Container shape: a script with exactly one rule serializes as a flat object (not
  a one-element array); two or more rules serialize as an array
  (`route.ts:164`, `exportData = stRules.length === 1 ? stRules[0] : stRules`).
  This is a lossy asymmetry the codec must reproduce because it is what real ST
  installs expect on import; it is why this codec's byte-identity level is
  `semantic`, not `canonical-json` (see Test plan).

### 3. RC-native embedding: `linkedRegexScripts`

Presets and characters can carry regex scripts as an extension payload. Two forms
coexist inside `extensions` on a preset (`import-st-regex.ts:158-195`,
`pickPresetRegexSource`):

- `extensions.regex_scripts`: flat, ST-compatible array of `SillyTavernRegex`
  objects — lossy for RC-only placements (`lorebook`, `reasoning`) and metadata
  (`trimStrings`, depth bounds), because it round-trips through the ST codec above.
- `extensions.linkedRegexScripts`: RC-native, lossless array of full scripts:

```ts
interface LinkedRegexScript {
  id?: string;
  name?: string;
  description?: string;
  rules?: Array<{
    name?: string;
    find_pattern?: string;
    replace_string?: string;
    trim_strings?: string[];
    placement?: string[];       // already canonical strings, not ST numbers
    min_depth?: number | null;
    max_depth?: number | null;
    run_on_edit?: boolean;
    enabled?: boolean;
    sort_order?: number;
    flags?: string;
  }>;
}
```

**Source selection rule (mandatory):** when both fields are present on a preset's
`extensions`, prefer `linkedRegexScripts` — it is the lossless form. Fall back to
`regex_scripts` only when `linkedRegexScripts` is absent or empty. This is not
optional: VAUDEVILLE's own preset importer (`src/lib/imports/preset.ts`, per
`preset-regex-roundtrip.test.ts:121-267`) originally read only the lossy flat form,
which is exactly the bug this spec must not repeat. `linkedRegexScripts` rule
fields map straight across to canonical `RegexRule` (snake_case → camelCase, no
placement translation needed since values are already canonical strings). Preset
serialization must always write BOTH fields: `regex_scripts` (flat, for
non-Vaudeville consumers reading the preset as plain ST JSON) and
`linkedRegexScripts` (for lossless re-import). This embedding format is described
here; the surrounding preset envelope is specs/formats/st-preset.md's concern.

### 4. Escrow

Per specs/formats/escrow-and-roundtrip.md, any ST source field with no canonical
home goes to `escrow["sillytavern"].fields` keyed by its original name, at parse
time, unconditionally:

- `id` (the ST script's own id/slug, distinct from the rule's canonical `id`)
- `substituteRegex` (present on real ST/RC-exported JSON, e.g.
  `route.ts:53`, `substituteRegex: 0`; never read by `parseSillyTavernRegex`)
- any other unrecognized top-level key on the source object

On serialize back to SillyTavern format, escrowed fields merge back into their
original keys (escrow rule 2). Canonical `RegexRule.id` is a Vaudeville-internal
identifier (ulid, per canonical-model.md) and is never written to ST's `id` key —
the two are decoupled, not competing for the same output location. ST's `id` round
trips purely through escrow: parsed into `sillytavern.fields.id`, re-emitted at
that same key on serialize, and otherwise ignored. Escrow rule 4
(`escrowShadowed`, canonical-wins-on-collision) never fires here, because there is
no shared output location for canonical and escrowed `id` to collide over. When no
escrowed `id` exists (a canonical-only rule that never came from an ST parse),
synthesize one on serialize per edge case 14; this is ordinary "codec expresses
canonical" behavior, not an escrow conflict.

### 5. Capabilities matrix (SillyTavern codec)

Per escrow-and-roundtrip.md, the codec exports `capabilities` mapping each
canonical field to `native | escrow | dropped`, used to generate the docs-site
format-support matrix (never hand-edited).

| Canonical field | Capability | Notes |
|---|---|---|
| `id` | escrow | round-trips via `sillytavern.fields.id` when present; synthesized (slug of `name`) when the rule is canonical-only |
| `name` | native | `scriptName` |
| `description` | dropped | ST has no description field; always `null` on parse, cannot be expressed on serialize-to-ST |
| `findPattern` | native | via `findRegex` unwrap |
| `flags` | native | via `findRegex` unwrap |
| `replaceString` | native | |
| `placement` (`user_input`) | native | ST number 1 |
| `placement` (`ai_output`) | native | ST number 2 |
| `placement` (`display_only`) | native | ST number 0 |
| `placement` (`lorebook`) | native | ST number 5; no ST UI concept of this placement, but the number round-trips |
| `placement` (`reasoning`) | native | ST number 6; no ST UI concept of this placement, but the number round-trips |
| `placement` (`prompt_only`) | native, with a caveat | serializes as ST number 2 + `promptOnly: true`; see foreign-serialize lossiness note below |
| `enabled` | native | `disabled` (inverted) |
| `minDepth` | native | |
| `maxDepth` | native | |
| `runOnEdit` | native | |
| `sortOrder` | native | array position on the wire; explicit field on canonical |
| `trimStrings` | native | |

Foreign-serialize lossiness (not a Round-Trip Law violation — ST-authored
fixtures parse and re-serialize cleanly; this only affects canonical documents
that were never sourced from ST): a canonical rule whose `placement` array
contains BOTH `ai_output` and `prompt_only` cannot survive a canonical → ST
serialize round trip. Both values collapse to ST number `2`, and the single
`promptOnly` boolean on the output object cannot distinguish "prompt_only only"
from "ai_output and prompt_only both apply" — the codec must report this
combination as lossy (`escrowed`/`dropped` entry in the `SerializeReport`) rather
than silently emitting a document that re-imports as a different placement set.

### 6. Substitution semantics (shared with the runtime lorebook/prompt engines)

This is the algorithm both the codec's own `testRegexRule`-equivalent (for preview)
and the runtime engine (specs/engine/*, applied at each `RegexPlacement`) must
implement identically. Reference: `apply-regex.ts:113-243`.

1. Filter rules: `enabled`, placement match, `depth` within `[minDepth, maxDepth]`
   (inclusive, either bound `null`/`undefined` = unbounded), and `!isEdit ||
   runOnEdit`.
2. Sort filtered rules by `sortOrder` ascending.
3. Apply rules in order, each rule transforming the output of the previous:
   a. Construct `new RegExp(findPattern, flags)`.
   b. If a macro-expansion callback is supplied and `replaceString` contains
      `{{`, expand macros in `replaceString` BEFORE token substitution (macro
      expansion happens once, on the raw replacement template, not per-match).
   c. Rewrite the literal token `{{match}}` (case-insensitive) in `replaceString`
      to the JS full-match replacement token `$&`.
   d. If `trimStrings` is a non-empty array, use the token-scanning replacer
      (step 4). Otherwise use the fast path: `result.replace(regex, replaceString)`
      directly (JS native `$&`/`$N`/`$<name>` semantics, no trimming).
   e. If wall-clock time for this single rule exceeds `timeout` (default 100ms),
      stop applying further rules (partial application; earlier rules' output is
      kept).
   f. If constructing or applying the regex throws (e.g. invalid pattern), skip
      this rule and continue with the next; do not abort the whole pipeline.
4. Token-scanning replacer (used only when `trimStrings` is non-empty): for each
   match, scan `replaceString` left to right for tokens matching
   `/\$(?:&|<([^>]*)>|(\d+))/g` and emit, per token:
   - `$&` → the full match with every string in `trimStrings` removed (via
     sequential `split(x).join('')`, i.e. literal substring removal, not regex).
   - `$<name>` → the named capture group's value (trimmed the same way) if it
     exists and matched; otherwise emit nothing.
   - `$N` (one or more digits) → capture group `N` (1-indexed, trimmed the same
     way) if `1 <= N <= captureGroupCount` and the group matched; otherwise
     (including out-of-range `N`) emit nothing. `captureGroupCount` is derived
     from the replacer callback's argument list, not assumed from the pattern.
   - Trimming applies ONLY to matched/captured text substituted via a token —
     never to literal (non-token) text in `replaceString`, and never to
     surrounding unmatched text in the source string.
   - This is a single left-to-right pass over `replaceString`, not chained
     `.replace()` calls, specifically so that trimmed content re-inserted by one
     token is never re-scanned for further tokens (prevents both out-of-range-$N
     leaking `fullString` and `$&`-inside-a-capture-group re-expanding).

## Public API sketch

```ts
// packages/core — canonical types
export type RegexPlacement =
  | "user_input" | "ai_output" | "display_only"
  | "prompt_only" | "lorebook" | "reasoning";

export interface RegexRule {
  id: string;
  name: string;
  description: string | null;
  findPattern: string;
  replaceString: string;
  placement: RegexPlacement[];
  flags: string;
  enabled: boolean;
  minDepth: number | null;
  maxDepth: number | null;
  runOnEdit: boolean;
  sortOrder: number;
  trimStrings: string[];
}

export interface RegexScript {
  id: string;
  name: string;
  description: string | null;
  rules: RegexRule[];
}

// packages/formats/sillytavern-regex — codec
import type { Codec, ParseReport, SerializeReport } from "@vaud/core";

export interface SillyTavernRegexCodec extends Codec<RegexScript> {
  id: "sillytavern-regex";
  detect(input: unknown): boolean; // structural, per Behavior section 2
  parse(input: unknown): { entity: Entity<RegexScript>; report: ParseReport };
  serialize(entity: Entity<RegexScript>): { output: unknown; report: SerializeReport };
  capabilities: Record<CanonicalFieldPath, "native" | "escrow" | "dropped">;
}

// packages/formats/rolecall-regex-embed — the linkedRegexScripts <-> RC-native
// embedding used inside presets; consumed by st-preset.md's codec, not
// standalone-file detectable.
export function pickRegexSource(
  extensions: Record<string, unknown> | null | undefined,
): { source: "linkedRegexScripts" | "regex_scripts" | "none"; scripts: RegexScript[] };

// packages/regexkit (runtime; NOT the codec) — substitution semantics shared
// with prompt assembly and the lorebook engine
export interface ApplyRegexOptions {
  depth?: number;
  isEdit?: boolean;
  timeoutMs?: number;
  expandMacro?: (text: string) => string;
}

export function applyRegexRules(
  text: string,
  rules: RegexRule[],
  placement: RegexPlacement,
  options?: ApplyRegexOptions,
): string;

export function applyRegexScripts(
  text: string,
  scripts: RegexScript[],
  placement: RegexPlacement,
  options?: ApplyRegexOptions,
): string;

export function validateRegexPattern(
  pattern: string,
  flags?: string,
): { valid: boolean; error?: string };
```

## Edge cases & failure modes

1. `findRegex` has no `/pattern/flags` wrapper (bare pattern string, no slashes):
   use it verbatim as `findPattern`, default `flags` to `"gm"`. Does not error.
2. `findRegex` wraps a multi-line pattern (contains literal newlines inside the
   slashes): must unwrap correctly using `[\s\S]+`, not `.+` — regression fixture
   required (VVS-502).
3. `placement` array contains a mix of ST numbers and canonical strings in the same
   array (possible if hand-edited): each entry is mapped independently per its own
   type/value; unrecognized numeric entries fall back to `ai_output`.
4. `placement` is `[3]` (ST `SLASH_COMMAND`): falls back to `ai_output`. Not
   dropped, not an error.
5. `placement` is an unassigned number (e.g. `[4]`, or any number not in
   `{0,1,2,3,5,6}`): falls back to `ai_output`. OPEN QUESTION: whether ST has ever
   assigned meaning to placement `4`; not found in the reference implementation or
   its comments — treat as unknown/unassigned, do not guess.
6. Both `promptOnly: true` and `markdownOnly: true` are set on the same rule:
   `promptOnly` wins (checked first in the reference `if/else if` chain); the
   codec must reproduce this precedence, not merge both.
7. Both `extensions.linkedRegexScripts` and `extensions.regex_scripts` present on
   an embedding preset: `linkedRegexScripts` wins entirely (not merged) — see
   `preset-regex-roundtrip.test.ts:132-180`.
8. `sortOrder` values collide or are missing after a hand edit: sort is a stable
   JS array sort on the numeric key; ties keep relative input order (V8 stable
   sort). No renumbering on parse; renumbering (if ever done) is an editor-surface
   concern, not the codec's.
9. `trimStrings` contains a string that is itself a regex metacharacter (e.g.
   `"*"`, `"("`): trimming is literal substring removal
   (`split(x).join('')`), never treated as a regex — this must not be
   reinterpreted as a nested pattern.
10. A rule's `findPattern` is an invalid regex (fails `new RegExp(...)` at apply
    time): the engine skips that single rule and continues; on the codec/editor
    side, `validateRegexPattern` surfaces the failure before save, but parse of an
    already-broken stored pattern must not throw — store it as-is in canonical
    `findPattern` and let validation be a separate, non-blocking pass.
11. Single-rule script exported to SillyTavern JSON round-trips through a flat
    object, not a one-element array; re-parsing that flat object and re-exporting
    must reproduce the flat form again (idempotent, but not literally
    `[rule]`-shaped) — this asymmetry is why byte-identity level is `semantic`.
12. A regex document detected via the bare-array structural rule (`isRegexScript`)
    could theoretically collide with another array-of-objects format that happens
    to have a `name` field on every element; detection priority
    (`persona > character > lorebook > regex > preset`) resolves this — regex
    detection only runs after persona/character/lorebook have already rejected the
    document. Full ordering: specs/formats/content-detection.md.
13. `minDepth`/`maxDepth` are `0`: `0` is a valid, meaningful bound (not treated as
    falsy/absent) — the depth check is `depth < minDepth` / `depth > maxDepth`,
    which correctly includes `minDepth: 0`.
14. Escrowed `sillytavern.fields.id` is absent (canonical-only rule that never came
    from an ST parse) and the script is serialized to ST format: synthesize
    `id` by slugifying `name`; do not emit an empty string or omit the field.

## Test plan

- Fixtures required, under `fixtures/regex-scripts/`:
  - `st-single-rule-flat.json` — bare single-object ST export (not array-wrapped).
    Exercises detection + the single-rule flat-object serialize asymmetry.
  - `st-multi-rule-array.json` — array of 2+ rules, mixed placements.
  - `st-multiline-findregex.json` — VVS-502 regression: `findRegex` containing an
    embedded newline (`/<think>\nfoo\n</think>/gms`).
  - `st-placement-full-matrix.json` — one rule per ST placement number
    `{0,1,2,3,5,6}` plus one with an unassigned number (e.g. `9`), to pin the
    fallback-to-`ai_output` behavior across the whole enum.
  - `st-prompt-only-and-markdown-only.json` — one rule with `promptOnly: true`,
    one with `markdownOnly: true`, one with both set (precedence case).
  - `st-trim-strings.json` — rule exercising `$&`, `$1`, `$<name>` with
    `trimStrings` set, including an out-of-range `$N` reference in
    `replaceString` (must emit nothing for that token, not throw or leak
    `fullString`).
  - `rc-linked-regex-scripts-preset.json` — a preset `extensions` blob carrying
    both `regex_scripts` and `linkedRegexScripts` with DIFFERING placements per
    rule (mirrors `preset-regex-roundtrip.test.ts`), to pin the
    `linkedRegexScripts`-wins rule.
  - `rc-linked-only.json` and `st-flat-only.json` — single-source presets, to pin
    the fallback path when only one embedding is present.
- Round-Trip Law applicability: full — `serialize(parse(F))` must be semantically
  identical to `F` for every ST fixture, at byte-identity level `semantic` (flat
  vs. array container shape and key order may differ; canonical + escrow must be
  deep-equal on re-parse). State explicitly in the codec's exported
  `byteIdentityLevel: "semantic"`.
- Property/unit tests beyond fixtures:
  - Placement round-trip: every canonical `RegexPlacement` value parses from its
    correct ST number and serializes back to that same number (pins the
    corrected inverse map from Behavior section 2 — this is the test that would
    have caught the reference implementation's export bug).
  - `applyRegexRules` timeout: a deliberately slow pattern against a long input
    stops applying further rules after `timeoutMs` without throwing.
  - `applyRegexRules` invalid pattern: a rule with an unparseable `findPattern`
    is skipped, subsequent rules still apply.
  - Token-scan replacer: capture-group-count derivation is correct for 0, 1, and
    N named + numbered groups mixed; out-of-range `$N` and unmatched `$<name>`
    both emit empty string, never leak the full input string.
  - `sortOrder` (not array order) governs application order — a fixture whose
    array order and `sortOrder` values disagree must apply in `sortOrder` order.

## Non-goals

- The NL regex trigger *builder* (pattern authoring assistant: word-family
  analysis, phrase-pattern building, `describeRegex`/`diagnoseRegex`,
  `buildTriggerRegex`, visual builder state) is a separate engine
  (`packages/regexkit` per the extraction map (private planning notes), extracted from
  VAUDEVILLE `packages/lorebook/src/regex-utils.ts` and
  `apps/rc/src/lib/regex/builder-core.ts`) with its own spec. This spec covers
  only the stored `RegexScript`/`RegexRule` data shape and its two codecs.
  builder-core's `RegexBuilderState`/`decompileToBuilderState` are UI-authoring
  concerns, not part of the canonical model or the round-trip contract.
- ReDoS/complexity scoring and pattern-length caps (present in VAUDEVILLE's
  separate `apps/rc/src/lib/regex/engine.ts` as `validateRegex`/
  `estimateComplexity`/`DANGEROUS_PATTERNS`) are a runtime safety concern for the
  engine/editor layer, not the codec. The codec parses and stores whatever
  pattern the source document contains, valid or not (edge case 10).
- Where and how the six placements are actually invoked in the prompt/lorebook
  pipeline (order of application relative to macro expansion, position injection,
  etc.) is specs/engine/prompt-assembly.md's and specs/engine/lorebook-engine.md's
  concern; this spec only defines the substitution algorithm itself and the data
  shape that carries `placement`.
- Backyard/charx/Risu regex-equivalent extension fields, if any exist, are out of
  scope here; check their own codec specs (backyard.md, charx.md).

## Sources consulted

- `<RoleCall>\apps\rc\src\lib\regex\apply-regex.ts`
  (lines 1-51 types; 56-246 `applyRegexRules`; 128-134 `{{match}}` token; 136-232
  trim-string token-scan replacer; 251-278 `applyRegexScripts`; 283-296
  `validateRegexPattern`).
- `<RoleCall>\apps\rc\src\lib\regex\import-st-regex.ts`
  (lines 16-28 `SillyTavernRegex`; 33-46 `ParsedRegexRule`; 56-140
  `parseSillyTavernRegex`, incl. 72 the VVS-502 unwrap regex, 79-97 the
  corrected placement map, 111-123 format-flag overlay; 158-195
  `LinkedRegexScript`/`pickPresetRegexSource`; 203-306
  `importLinkedRegexScripts`; 342-461 `importSTRegexScripts`).
- `<RoleCall>\apps\rc\src\app\api\content\regex-scripts\[id]\export\route.ts`
  (lines 8-15 `RC_TO_ST_PLACEMENT` — flagged as a stale/buggy shifted-by-one map,
  NOT followed by this spec; lines 22-57 `ruleToSillyTavern`; line 164 flat-vs-array
  container rule).
- `<RoleCall>\apps\rc\src\lib\regex\__tests__\st-placement-map.test.ts`
  (full file — documents the shifted-by-one regression and pins the correct
  0/1/2/3/5/6 map).
- `<RoleCall>\apps\rc\src\lib\regex\__tests__\import-st-regex-multiline.test.ts`
  (full file — VVS-502 multi-line `findRegex` unwrap fixture basis).
- `<RoleCall>\apps\rc\src\lib\regex\__tests__\st-format-flags.test.ts`
  (full file — `promptOnly`/`markdownOnly` overlay behavior).
- `<RoleCall>\apps\rc\src\lib\regex\__tests__\preset-regex-roundtrip.test.ts`
  (full file — `linkedRegexScripts`-wins contract and the RC→ST→RC lossiness
  this spec's corrected export map is meant to close).
- `<RoleCall>\apps\rc\src\lib\library\json-parsers.ts`
  (lines 174-212 `isRegexScript`; 252-268 `detectJsonType` priority order).
- `<RoleCall>\apps\rc\src\lib\regex\engine.ts` (lines
  1-80 — separate ReDoS/complexity-scoring engine, cited only for the Non-goals
  scope boundary and the `createReplacementFunction` naming referenced in
  `apply-regex.ts`'s comments).
- `docs\the production bible (private planning notes)` (brief
  row for `regex-scripts.md`, line 51).
- `docs\the extraction map (private planning notes)` (lines
  27-33, `packages/regexkit` scope, cited for the Non-goals boundary).
- `specs\formats\canonical-model.md`,
  `escrow-and-roundtrip.md`, `docs\the master plan (private planning notes)`, `docs\02-ARCHITECTURE.md`
  (structure and conventions).

OPEN QUESTION: whether SillyTavern's `regex_placement` enum has ever assigned a
meaning to value `4` (between `SLASH_COMMAND=3` and `WORLD_INFO=5`). Not present
in any VAUDEVILLE source, comment, or test found. Treated as an unassigned/unknown
number that falls back to `ai_output` like any other unrecognized value (edge
case 5); not verified against ST's own source or public docs.

OPEN QUESTION: whether real-world SillyTavern exports ever set `substituteRegex`
to a value other than `0`, and what that field controls. It is round-tripped
opaquely via escrow in this spec and never interpreted, so the answer does not
change the codec's behavior, but an implementing agent writing fixture notes
should know this is unresolved rather than assume `0` is the only valid value.
