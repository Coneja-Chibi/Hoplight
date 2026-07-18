# Spec: Lumiverse Preset Codec

**Package:** `packages/presets` (per `02-ARCHITECTURE.md:16-17`: "presets/ ... Lumiverse
converter" lives beside the ST preset parse/serialize code, not in `packages/formats/`.
`formats/` cannot depend on `presets/` - the dependency rule is `core <- formats <-
everything`, i.e. `formats` sits below `presets` in the load order, so a codec that
calls `parsePreset`/`serializePreset` (both in `presets/`) must itself live in
`presets/`, not `formats/`.) · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/st-preset.md (defines `RawPreset`/`ParsedPreset`, the shape this codec
converts into) · **VAUDEVILLE reference:** packages/presets-core/src/lumiverse-converter.ts,
packages/presets-core/src/preset-parser.ts, packages/presets-core/src/types.ts,
apps/rc/src/lib/macros/handlers/lumiverse-compat.ts

## Purpose

Lumiverse (the platform behind community preset exports such as "ThreadBare") ships
presets as a JSON wrapper with a block-based prompt model, structurally different
from SillyTavern's `prompts[] + prompt_order[]` shape. This codec detects that
wrapper, converts it into an ST-shaped `RawPreset`, and hands off to the existing
ST preset parser (`specs/formats/st-preset.md`) so downstream code (categories,
samplers, system prompts, the canonical `Preset` model) needs zero Lumiverse-specific
branching. It exists so users who only have Lumiverse-exported presets can bring them
into Vaudeville Studios and use them exactly like any ST preset, including inside the
prompt-assembly and Test Stage engines.

This is explicitly a **one-way conversion at the structural level**: Lumiverse's own
block/wrapper JSON shape is the source format for **parsing only**. There is no
"serialize back to Lumiverse wrapper JSON" path in the VAUDEVILLE reference
implementation, and this spec does not invent one (see Non-goals and the Round-Trip
Law note below).

## Behavior

### Detection

A JSON document is a Lumiverse preset wrapper if and only if:

```
typeof json === "object" && json !== null
  && json.type === "lumiverse_preset"
  && typeof json.preset === "object" && json.preset !== null
```

(VAUD: `lumiverse-converter.ts:63-71`, function `isLumiversePreset`.) `schemaVersion`
is read (currently observed as `2`) but is NOT part of the detection predicate - the
converter does not branch on its value. There is no known Lumiverse preset
`schemaVersion` other than `2` in the VAUDEVILLE codebase; this codec should still
record whatever `schemaVersion` value is present into escrow rather than assume `2`.

The wrapper shape:

```json
{
  "type": "lumiverse_preset",
  "schemaVersion": 2,
  "cover_url": "https://...",
  "preset": {
    "id": "...",
    "name": "...",
    "description": "...",
    "blocks": [ /* LumiverseBlock[] */ ],
    "promptBehavior": { },
    "completionSettings": { },
    "samplerOverrides": { },
    "advancedSettings": { },
    "promptVariables": { }
  }
}
```

(VAUD: `lumiverse-converter.ts:38-57`, interfaces `LumiversePresetInner` and
`LumiverseWrapper`.) Both the wrapper and `preset` inner object carry an open
`[key: string]: unknown` index signature - Lumiverse's real-world exports are known
to include fields beyond the ones this codec reads.

### Parse pipeline

Parsing a Lumiverse wrapper is a two-stage pipeline, matching `parsePreset`'s
auto-detection in VAUD (`preset-parser.ts:293-297`):

1. **Convert**: `LumiverseWrapper -> RawPreset` (this codec's job; see block model
   below).
2. **Parse**: `RawPreset -> ParsedPreset` via the existing ST preset parser
   (`specs/formats/st-preset.md`), unmodified.

Name resolution: if `wrapper.preset.name` is a string, it is used as the parsed
preset's display name; otherwise the caller-supplied fallback name is used (VAUD:
`preset-parser.ts:295`, default fallback `"Imported Preset"` from
`preset-parser.ts:293`).

### Block model

Each `LumiverseBlock` (VAUD: `lumiverse-converter.ts:24-36`):

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable block identifier. Blocks with a non-string `id` are skipped entirely. |
| `name` | string | Display name; coerced to `String(...)` defensively before use. |
| `role` | string? | `"system" \| "user" \| "assistant"`; anything else (including absent) falls back to `"system"`. |
| `marker` | string? | `''` = normal content block. `'category'` = section header (no content, name only). `'chat_history'` = the chat-history injection point. |
| `content` | string? | Block body. Coerced to `String(...)`. |
| `enabled` | boolean? | Defaults to enabled; only an explicit `false` disables. |
| `isLocked` | boolean? | Maps to `forbid_overrides`. |
| `depth` | number? | Injection depth; defaults to `4` when absent. |
| `position` | string? | Observed values `'pre_history' \| 'post_history'`. **Read but not consumed** by the converter - see Edge case 6. |
| `injectionTrigger` | string[] \| null? | Passed through as `injection_trigger`; `null`/absent becomes `[]`. |

Three block kinds are handled distinctly:

**1. `marker === "chat_history"`** - becomes the ST structural marker prompt with
reserved identifier `"chatHistory"` (the exact identifier the ST parser and prompt
builder key on):

```
{ identifier: "chatHistory", name: "Chat History", content: "",
  role: "system", enabled: block.enabled !== false, marker: true,
  injection_position: 0, injection_depth: block.depth ?? 4,
  injection_order: 100, forbid_overrides: false,
  injection_trigger: block.injectionTrigger ?? [] }
```

(VAUD: `lumiverse-converter.ts:181-198`.)

**2. `marker === "category"`** - becomes a category-header prompt. Content is
forced empty and the name is decorated with `━━━ <name> ━━━` (VAUD:
`lumiverse-converter.ts:201-213`) so the downstream ST legacy-format category
detector (`preset-parser.ts:108-114`, requiring 2+ consecutive box-drawing marker
characters and empty content) recognizes it as a category the same way it would
recognize a native ST NemoPresetExt category.

**3. Everything else (`marker === '' \| undefined`, i.e. a normal content block)** -
becomes a regular `RawPrompt` with `name`/`content` taken as-is (VAUD:
`lumiverse-converter.ts:207-223`).

**Reserved-id collision guard**: block ids `"chatHistory"` and
`"lumiverseVariableDefaults"` are namespaced (`__lumiverse_block_<id>`) if a normal
content block happens to use one of those ids, so an imported block never shadows
the converter's own synthesized entries (VAUD: `lumiverse-converter.ts:161-168`).

### Field map: `LumiverseBlock` -> `RawPrompt`

| Lumiverse field | RawPrompt field | Native/Escrow/Dropped | Notes |
|---|---|---|---|
| `id` (namespaced per collision guard) | `identifier` | native | See reserved-id guard above |
| `name` | `name` | native | Decorated with box-drawing chars if `marker === "category"` |
| `content` | `content` | native | Forced `""` for category headers |
| `role` | `role` | native | Falls back to `"system"` for unknown/absent values |
| `enabled` | `enabled` (and `prompt_order[].order[].enabled`) | native | `block.enabled !== false` |
| `isLocked` | `forbid_overrides` | native | |
| `depth` | `injection_depth` | native | Defaults to `4` |
| `injectionTrigger` | `injection_trigger` | native | `null`/absent -> `[]` |
| `position` (`pre_history`/`post_history`) | - | **dropped at conversion; not read into any RawPrompt field** | See Edge case 6. All converted prompts get `injection_position: 0` (relative/legacy) regardless of `block.position`. |
| (none - synthesized) | `injection_order` | native | Always hardcoded to `100` for every converted block |
| (none - synthesized) | `system_prompt` | native | Always `false` for content/history blocks |

### Field map: `LumiversePresetInner` settings -> `RawPreset`

| Lumiverse path | RawPreset field | Native/Escrow/Dropped | Notes |
|---|---|---|---|
| `preset.samplerOverrides.temperature` | `temperature` | native | `num()` coercion: only finite numbers pass, else `undefined` |
| `preset.samplerOverrides.topP` | `top_p` | native | |
| `preset.samplerOverrides.topK` | `top_k` | native | |
| `preset.samplerOverrides.minP` | `min_p` | native | |
| `preset.samplerOverrides.presencePenalty` | `presence_penalty` | native | |
| `preset.samplerOverrides.frequencyPenalty` | `frequency_penalty` | native | |
| `preset.samplerOverrides.repetitionPenalty` | `repetition_penalty` | native | |
| `preset.samplerOverrides.maxTokens` | `openai_max_tokens` | native | |
| `preset.samplerOverrides.contextSize` | `openai_max_context` | native | |
| `preset.samplerOverrides.streaming` | `stream_openai` | native | `bool()` coercion |
| `preset.promptBehavior.impersonationPrompt` | `impersonation_prompt` | native | `str()` coercion |
| `preset.promptBehavior.newChatPrompt` | `new_chat_prompt` | native | |
| `preset.promptBehavior.newGroupChatPrompt` | `new_group_chat_prompt` | native | |
| `preset.promptBehavior.continueNudge` | `continue_nudge_prompt` | native | |
| `preset.promptBehavior.groupNudge` | `group_nudge_prompt` | native | |
| `preset.promptBehavior.sendIfEmpty` | `send_if_empty` | native | |
| `preset.completionSettings.assistantPrefill` | `assistant_prefill` | native | |
| `preset.completionSettings.assistantImpersonation` | `assistant_impersonation` | native | |
| `preset.completionSettings.namesBehavior` | `names_behavior` | native | |
| `preset.completionSettings.continuePrefill` | `continue_prefill` | native | |
| `preset.completionSettings.continuePostfix` | `continue_postfix` | native | |
| `preset.completionSettings.enableWebSearch` | `enable_web_search` | native | |
| `preset.completionSettings.sendInlineMedia` | `image_inlining` | native | |
| `preset.completionSettings.useSystemPrompt` | `claude_use_sysprompt` | native | |
| `preset.completionSettings.squashSystemMessages` | `squash_system_messages` | native | |
| `preset.completionSettings.enableFunctionCalling` | `function_calling` | native | |
| `preset.advancedSettings.seed` | `seed` | native | |
| `preset.blocks[]` | `prompts[]` + `prompt_order[0].order[]` | native | See block model above; single `prompt_order` entry with `character_id: 100001` |
| `preset.promptVariables` | synthesized `lumiverseVariableDefaults` prompt | native (lossy synthesis) | See Variable defaults below |
| `preset.name` | escrow (`_lumiverse_name`) + used as fallback display name | escrow | |
| `preset.description` | escrow (`_lumiverse_description`) | escrow | |
| `wrapper.cover_url` | escrow (`_lumiverse_cover_url`) | escrow | |
| `preset.promptBehavior.emptySendNudge` | escrow (`_lumiverse_empty_send_nudge`) | escrow | No RawPreset field corresponds to this |
| `preset.advancedSettings.customStopStrings` | escrow (`_lumiverse_custom_stop_strings`) | escrow | No RawPreset field corresponds to this |
| (marker) | `_lumiverse_source: true` | escrow | Marks the RawPreset as Lumiverse-derived, for round-trip/debugging |
| `wrapper.type`, `wrapper.schemaVersion` | - | **not currently escrowed by the VAUD converter** | OPEN QUESTION below |
| `preset.id` | - | **not currently escrowed by the VAUD converter** | OPEN QUESTION below |
| any other key on `wrapper` or `preset.*` (via the open index signatures) | - | **dropped by the VAUD converter today** | OPEN QUESTION below |

All `_lumiverse_*` keys plus `_lumiverse_source` are written directly onto the
`RawPreset` object as sibling fields (VAUD: `lumiverse-converter.ts:266-272`), not
into a nested escrow structure - they ride through `RawPreset`'s
`[key: string]: unknown` index signature and land in `ParsedPreset.rawSettings` via
the ST parser's unknown-field passthrough (`preset-parser.ts:421-442`). Any key
starting with `undefined` value is stripped before the `RawPreset` is returned
(VAUD: `lumiverse-converter.ts:276-279`, "strip undefined keys so `?? default`
fallbacks behave identically to a field that was never present").

**Canonical-model mapping**: from here, `RawPreset -> ParsedPreset -> canonical
Preset` follows `specs/formats/st-preset.md` exactly (this codec produces nothing
the ST codec doesn't already know how to carry). The `_lumiverse_*` fields land in
`ParsedPreset.rawSettings` and from there in the canonical `Preset`'s escrow bucket
keyed `st-preset` (per that spec), NOT a `lumiverse-preset` escrow key, because by
the time they reach the canonical layer they are indistinguishable from any other
ST `rawSettings` passthrough field. This codec's own escrow bucket
(`escrow["lumiverse-preset"]`) SHOULD hold: the wrapper-level fields not carried by
`_lumiverse_*` (`type`, `schemaVersion`, `preset.id`), so a Lumiverse-origin preset
can, at minimum, be identified as such without relying on the `_lumiverse_source`
convention living inside `rawSettings`. See Public API sketch for where this codec
adds a real escrow bucket instead of only relying on the VAUD `_lumiverse_*`
sibling-field convention.

### Variable defaults synthesis

`preset.promptVariables` is a map of `blockId -> { varName: defaultValue }`. RC/ST
has no concept of per-preset variable defaults, so the converter synthesizes a
single hidden prompt, `lumiverseVariableDefaults`, placed first in the prompt order
(VAUD: `lumiverse-converter.ts:95-145,170-176`):

1. Merge all `promptVariables` maps into one `Map<name, value>`, first-write-wins
   across blocks (later blocks defining the same variable name are ignored).
2. Drop any `(name, value)` pair where either the name or `String(value)` contains
   a macro-significant sequence (`"::"`, `"{{"`, `"}}"`) - these would corrupt the
   synthesized macro syntax and there is no in-band escape.
3. For each surviving pair, emit one line:
   `{{if {{hasvar::<name>}}}}{{else}}{{setvar::<name>::<value>}}{{/if}}`
   - i.e., "if the variable is already set (by mid-chat user action), do nothing;
   otherwise set the default." This guards against the synthesized defaults
   clobbering a user's later `/setvar` or in-chat variable change on every
   subsequent prompt build.
4. If no pairs survive, no prompt is synthesized (defaultsPrompt is `null`, nothing
   is added).

The synthesized prompt: `identifier: "lumiverseVariableDefaults"`,
`name: "Variable Defaults (imported)"`, `role: "system"`, `enabled: true`,
`marker: false`, `injection_position: 0`, `injection_depth: 4`,
`injection_order: 100`, `forbid_overrides: false`, `injection_trigger: []`.

This is a **lossy, one-directional synthesis**: the original `promptVariables`
structure (which block owned which default) is not recoverable from the
synthesized macro text, and is not currently escrowed by the VAUD converter either.
See Edge case 5 and the OPEN QUESTION list.

### Macro dialect: no translation

Block `content` strings may use Lumiverse's own macro dialect: `{{if::...}}`
conditional blocks, `{{rcounter::name}}` running counters, reasoning-tag emitters
(`{{reasoningPrefix}}`/`{{reasoningSuffix}}`), group-card macros
(`{{groupCardMode}}`, `{{charGroupFocused}}`, `{{charGroupFocusedDescription}}`,
`{{charGroupFocusedPersonality}}`, `{{groupOthers}}`), Lumiverse platform aliases
(`{{lumiaDef}}`, `{{lumiaPersonality}}`), and Lumiverse-only platform tokens with
no Vaudeville equivalent (`{{lumiaCouncilModeActive}}`, `{{spotify_track_name}}`,
`{{sim_tracker}}`, etc. - the full list is enumerated at
`lumiverse-compat.ts:169-189`).

**This codec does NOT translate or rewrite macro text.** Content strings are carried
through byte-for-byte as `RawPrompt.content`. Resolving these macros at generation
time is the macro engine's job (`specs/engine/macro-engine.md`), which registers a
Lumiverse-compatibility macro set mirroring VAUD's
`registerLumiverseCompatMacros()` (VAUD: `lumiverse-compat.ts:198-212`):

- `rcounter`/`runningcounter`: auto-incrementing per-generation counter, no-op in
  read-only render mode.
- `reasoningprefix`/`reasoningsuffix`: emit `<think>`/`</think>` by default (or
  context-configured tags); Lumiverse's optional `::raw` argument is accepted and
  ignored (Vaudeville's macro engine always emits raw).
- Group-card macros resolve against the active production's group-chat context
  (focused speaker name/description/personality, other members) with `'solo'`
  as the default `groupCardMode` outside group chats.
- `lumiaDef`/`lumiaPersonality`: straight aliases for
  character description/personality.
- The Lumiverse-only platform tokens (council/spotify/sim-tracker/etc.) resolve to
  **empty string**, deliberately, not to an "unresolved macro" error state: an
  unrecognized macro would otherwise survive as literal text, which is truthy
  inside `{{if::...}}` guards, and would wrongly activate Lumiverse-only preset
  sections that have no Vaudeville-side equivalent to gate on.

This spec's format-detection/conversion responsibility ends at producing correct
`RawPrompt.content` strings; it explicitly does not implement or re-derive macro
semantics.

## Public API sketch

```ts
// packages/presets/src/lumiverse-preset.ts
// Lives in packages/presets (not packages/formats): this codec calls the ST
// preset parser (parsePreset/serializePreset), which is also in packages/presets.
// packages/formats must never import packages/presets (dependency rule:
// core <- formats <- everything, formats has no downstream deps on presets),
// so a codec that needs the ST parser cannot live in formats/.

import type { RawPreset } from "./st-preset"; // st-preset.md's RawPreset, same package

/** Lumiverse block, as observed in the wild (schemaVersion 2). */
export interface LumiverseBlock {
  id: string;
  name: string;
  role?: string;
  marker?: "" | "category" | "chat_history" | string;
  content?: string;
  enabled?: boolean;
  isLocked?: boolean;
  depth?: number;
  position?: "pre_history" | "post_history" | string;
  injectionTrigger?: string[] | null;
  [key: string]: unknown;
}

export interface LumiversePresetInner {
  id?: string;
  name?: string;
  description?: string;
  blocks?: LumiverseBlock[];
  promptBehavior?: Record<string, unknown>;
  completionSettings?: Record<string, unknown>;
  samplerOverrides?: Record<string, unknown>;
  advancedSettings?: Record<string, unknown>;
  promptVariables?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export interface LumiverseWrapper {
  type: "lumiverse_preset";
  schemaVersion?: number;
  cover_url?: string;
  preset: LumiversePresetInner;
  [key: string]: unknown;
}

/** Structural type guard: does this JSON look like a Lumiverse preset wrapper? */
export function isLumiversePreset(json: unknown): json is LumiverseWrapper;

export interface LumiverseConversionResult {
  raw: RawPreset;
  /** Escrow bucket for wrapper-level fields the RawPreset sibling-field
   *  convention does not carry (wrapper.type, wrapper.schemaVersion, preset.id). */
  escrow: { fields: Record<string, unknown>; version?: string };
}

/**
 * Convert a Lumiverse preset wrapper into an ST-shaped RawPreset plus this
 * codec's escrow bucket. Never throws on malformed/partial input; missing
 * or wrong-typed fields are coerced to `undefined` and omitted (matches
 * VAUD's `num()`/`str()`/`bool()` coercion helpers).
 */
export function convertLumiversePreset(
  wrapper: LumiverseWrapper
): LumiverseConversionResult;

/**
 * Full parse entry point: detect + convert + hand off to the ST preset
 * parser. Equivalent to VAUD's `parsePreset` auto-detection branch
 * (preset-parser.ts:293-297), but returns the canonical envelope shape
 * instead of presets-core's bespoke ParsedPreset.
 */
export function parseLumiversePreset(
  json: unknown,
  fallbackName?: string
): { data: import("@vaudeville/core").Preset; escrow: import("@vaudeville/core").Escrow } | null; // null if !isLumiversePreset(json)

/**
 * Per the escrow spec, capabilities are keyed by CANONICAL field path, not by
 * RawPreset/Lumiverse field name. Because this codec's only output is a
 * RawPreset consumed by the ST preset codec, its capabilities table is a
 * DERIVED VIEW: every canonical `Preset` field path the ST codec marks
 * "native" is reachable through this codec too (transitively, via the
 * conversion), except the fields this codec cannot even express as a
 * RawPreset field (promptVariables' per-block ownership, block.position - see
 * edge cases 5 and 6, both "escrow" at best). This codec does not redefine
 * st-preset.md's capabilities table; it only notes where its OWN lossy
 * synthesis narrows what st-preset.md would otherwise call "native".
 */
export const capabilities: Record<string /* canonical Preset field path, per st-preset.md */, "native" | "escrow" | "dropped">;
```

Canonical identification: a `Preset` entity produced by this codec sets
`meta.origin.format = "lumiverse-preset"` on the shared `Entity<T>` envelope
(`canonical-model.md:24`), which is the authoritative way to detect "this preset
was imported from Lumiverse" - not the `_lumiverse_source` sibling field, which is
an ST-layer (`RawPreset`/`rawSettings`) implementation detail that predates the
canonical envelope and is preserved only for round-trip fidelity back through the
ST codec.

## Edge cases & failure modes

1. **`schemaVersion` other than 2, or absent.** The detection predicate does not
   check `schemaVersion` at all; any value (or its absence) is accepted as long as
   `type === "lumiverse_preset"` and `preset` is an object. Record whatever value
   is present in escrow. OPEN QUESTION: whether a future Lumiverse schema version
   changes the block shape enough to need branching - no evidence of a v1 or v3
   wrapper shape was found in VAUDEVILLE.

2. **Block with non-string `id`.** Silently skipped (not added to `prompts` or
   `order`) - matches VAUD `lumiverse-converter.ts:179`. No warning is currently
   emitted by VAUD; this spec requires the Vaudeville implementation to record a
   `warnings` entry in the `ParseReport` for each skipped block (stronger than the
   VAUD reference, which is silent) so users see it in `vaud convert` output.

3. **Two blocks with the same `id`.** Unlike the ST preset parser (which
   deduplicates by identifier, `preset-parser.ts:308`, "if (promptMap.has(...))
   continue"), the Lumiverse converter has no such guard - it pushes every block
   into `prompts[]` and `order[]` unconditionally (VAUD:
   `lumiverse-converter.ts:178-225` has no `has()` check). A duplicate id therefore
   produces a `RawPreset` with two `RawPrompt` entries sharing one `identifier`,
   which the downstream ST parser THEN deduplicates (keeping the first). Net
   effect: last-duplicate-loses is actually first-duplicate-wins after the full
   pipeline runs, and the duplicate's content is silently discarded. Implement the
   same behavior for parity, but record a `warnings` entry.

4. **Reserved-id collision** (`id === "chatHistory"` or
   `id === "lumiverseVariableDefaults"` on a *non-marker* block). Namespaced to
   `__lumiverse_block_<id>` per the collision guard (VAUD:
   `lumiverse-converter.ts:161-168`). The prompt survives under the mangled
   identifier; round-tripping back to Lumiverse's own wrapper format (not
   supported - see Non-goals) would need to reverse this, which is one more reason
   this codec does not attempt Lumiverse-wrapper serialization.

5. **`promptVariables` synthesis is lossy.** The synthesized
   `lumiverseVariableDefaults` prompt cannot be un-synthesized back into a
   `promptVariables` map (which block owned which default is lost; macro-unsafe
   pairs are dropped entirely with no record). Required behavior: escrow the
   ORIGINAL `preset.promptVariables` object verbatim (this codec's escrow bucket,
   not VAUD's convention, since VAUD does not do this today) so a full serialize
   back through the ST codec at least has the source data available even though
   VAUD's own converter does not use it. Record a `warnings` entry naming the
   dropped macro-unsafe pairs.

6. **`block.position` (`pre_history`/`post_history`) is read into the
   `LumiverseBlock` type but never consulted when building the `RawPrompt`** - every
   converted content/category block gets `injection_position: 0` regardless (VAUD:
   `lumiverse-converter.ts:207-223`, no reference to `block.position` anywhere in
   the `RawPrompt` construction). This looks like a gap in the VAUD reference
   implementation rather than an intentional design choice (chat_history block's
   `depth` IS read; `position` for other blocks is dead-read). This spec requires
   this field be escrowed at minimum (`escrow["lumiverse-preset"].fields["blocks/<id>/position"]`)
   so no information is silently lost, and flags the semantic gap as an
   OPEN QUESTION below rather than guessing what `injection_position` value it
   should map to.

7. **Non-string `block.name` / `block.content`.** Coerced via `String(...)` (VAUD:
   `lumiverse-converter.ts:204-206`, "Hand-edited imports can carry non-string
   name/content; coerce so the prompt builder's string ops... never throw"). A
   `null` becomes the string `"null"` - accept this as documented VAUD behavior,
   do not special-case it further.

8. **`json.preset` present but empty object `{}`.** Valid: `blocks` defaults to
   `[]` (no prompts), all settings sections default to `{}` (all samplers
   `undefined`, dropped by the `?? default` chain downstream). Produces a
   minimally-valid empty `RawPreset` with just the (possibly empty) synthesized
   `prompt_order`.

9. **Macro-unsafe default value AND macro-unsafe name both present in the same
   pair.** Filtered out by the single `isMacroSafe(name) && isMacroSafe(String(value))`
   check (VAUD: `lumiverse-converter.ts:122-123`) - either condition failing drops
   the pair.

10. **No serialize-back-to-Lumiverse-wrapper path exists.** Attempting to export a
    canonical `Preset` (even one whose escrow still carries `lumiverse-preset`
    fields) to `format: "lumiverse-preset"` MUST fail cleanly (`UnsupportedFormatError`
    from `vaud export`/`vaud convert --to lumiverse-preset`), not silently emit an
    ST-shaped file mislabeled as Lumiverse. See Non-goals.

## Test plan

- Fixtures required (`fixtures/lumiverse-preset/`):
  - `basic-blocks.json` - a handful of `marker: ''` content blocks plus one
    `chat_history` marker block; exercises the core block map.
  - `with-categories.json` - includes `marker: 'category'` header blocks;
    verifies the box-drawing decoration round-trips through the ST legacy
    category detector correctly (i.e. `vaud inspect` shows the same category
    tree as a native ST NemoPresetExt export with categories).
  - `with-prompt-variables.json` - `promptVariables` on 2+ blocks including one
    macro-unsafe name/value pair (e.g. a default containing `"::"`); verifies
    synthesis + the dropped-pair warning.
  - `duplicate-block-ids.json` - two blocks sharing an `id`; verifies edge case 3
    (first-wins after the full pipeline) and the warning.
  - `missing-optional-fields.json` - a minimal wrapper with `preset: {}`; verifies
    edge case 8.
  - `reserved-id-collision.json` - a content block with `id: "chatHistory"`;
    verifies the namespacing guard (edge case 4).
  - `pre-and-post-history-positions.json` - blocks using both `position` values;
    documents the current dead-read behavior (edge case 6) so a future fix to
    that gap is a visible, intentional fixture change, not silent drift.
  - `real-threadbare-export.json` - a sanitized real-world Lumiverse export (per
    `escrow-and-roundtrip.md`'s "real files from real tools" rule), provenance
    noted in `notes.md`.
- Round-Trip Law applicability: **parse-only codec - the harness's default
  `serialize(parse(F), X)` leg does not apply and must be told so explicitly.**
  This codec exports no `serialize` function for `"lumiverse-preset"` (see
  Non-goals): `serialize(parse(F), "lumiverse-preset")` is undefined behavior, not
  a codec bug. Concretely, for fixtures under `fixtures/lumiverse-preset/**` the
  auto-discovery harness described in `escrow-and-roundtrip.md` ("auto-discovers
  `fixtures/<format>/**` and runs the law against every fixture") MUST run a
  reduced check for this format: `parse(F)` deep-equals the fixture's
  `expected.json` (canonical `data` + `escrow`), and the serialize-back leg is
  skipped rather than attempted against a nonexistent serializer. This requires
  the harness to support a per-format "parse-only" declaration (e.g. this codec's
  exported `capabilities`/module metadata marks itself parse-only, or the harness
  keys off "no serialize export found for this format id"). OPEN QUESTION:
  whether the M0/M1 fixture harness already has this parse-only escape hatch, or
  whether adding it is part of this codec's own ticket - not confirmed against
  any harness implementation, since the harness itself is M0 scope and this spec
  only read the harness's *description* in `escrow-and-roundtrip.md`, not its code.
  Separately, once converted, the resulting canonical `Preset` (and its `st-preset`
  escrow bucket) is subject to the FULL Round-Trip Law at `byte`/`canonical-json`/
  `semantic` level exactly as declared in `st-preset.md` - this codec adds no new
  round-trip obligation beyond what that spec already covers for the ST shape.
- Property/unit tests beyond fixtures:
  - `isLumiversePreset` returns `false` for ST-shaped presets, `chara_card_v2`
    JSON, and non-object input (`null`, arrays, strings).
  - `num()`/`str()`/`bool()` coercion helpers: non-finite numbers, non-boolean
    truthy values (`"true"` string), etc. all yield `undefined`, not a coerced
    guess.
  - Every `_lumiverse_*` sibling field plus this codec's own escrow bucket
    round-trips through `ParsedPreset.rawSettings` unchanged.

## Non-goals

- **No Lumiverse-wrapper serializer.** This codec converts Lumiverse -> canonical
  only. There is no code path in VAUDEVILLE that writes the
  `{ type: "lumiverse_preset", ... }` wrapper shape, and this spec does not design
  one speculatively. If a future need arises (e.g. users want to re-export TO
  Lumiverse), it is a new spec, not an extension of this one.
- **No macro dialect translation.** Content strings pass through verbatim; macro
  resolution is `specs/engine/macro-engine.md`'s responsibility, informed by the
  compat handler list documented above.
- **No reconstruction of Lumiverse's internal `preset.id` / block-ordering UI
  metadata** beyond what is needed to reproduce prompt content and order in the ST
  shape.
- **No validation of Lumiverse's schema** beyond the structural `isLumiversePreset`
  detection predicate; a malformed-but-detectable wrapper is converted best-effort
  per the coercion rules above, never rejected outright.

## Sources consulted

- VAUD `packages/presets-core/src/lumiverse-converter.ts` (full file read;
  key lines: type defs :24-57, detection :63-71, role/coercion helpers :77-93,
  variable-defaults synthesis :95-145, main conversion :150-282, reserved-id
  guard :161-168, chat_history handling :181-198, category/content handling
  :201-225, settings field map :227-273, undefined-key strip :276-279).
- VAUD `packages/presets-core/src/preset-parser.ts` (auto-detection call site
  :293-297; legacy category detection :108-114; identifier dedup :308;
  unknown-field passthrough into `rawSettings` :421-442).
- VAUD `packages/presets-core/src/types.ts` (`RawPreset`/`RawPrompt`/`ParsedPreset`
  shapes :10-104, :240-254).
- VAUD `packages/presets-core/src/index.ts` (package header note on Lumiverse
  converter being vendored :11-14, public export surface :26-32).
- VAUD `apps/rc/src/lib/macros/handlers/lumiverse-compat.ts` (full file read:
  header rationale for empty-string platform tokens :1-11, `rcounter` :24-43,
  reasoning tags :45-68, group-card macros :70-142, platform aliases and
  unavailable-token list :144-196, registration :198-212).
- `docs/02-ARCHITECTURE.md`, `specs/formats/canonical-model.md`,
  `specs/formats/escrow-and-roundtrip.md`, `templates/SPEC-TEMPLATE.md`.
- No public/official Lumiverse format documentation was found or searched for;
  this file's ground truth is scoped to the VAUDEVILLE source only (unlike
  chara_card_v2/v3/charx/Backyard, Lumiverse is not listed as a web-research
  target). All Lumiverse-specific facts in this spec
  trace to the VAUD files above, not to any external spec.

## Open questions

- OPEN QUESTION: (see edge case 1) whether Lumiverse has schema versions other than
  2, and whether they change the block shape (`marker`/`position` semantics in
  particular). No evidence found in VAUDEVILLE of handling any version other than
  the observed 2.
- OPEN QUESTION: what `injection_position` a `pre_history`/`post_history` block
  `position` value should map to. VAUD's converter reads the field onto the
  `LumiverseBlock` type but never uses it (dead read) - every converted block gets
  `injection_position: 0`. This looks like a gap rather than a deliberate choice;
  should this be fixed (map `pre_history`
  to something like `injection_position: 4` "prepend-top" and `post_history` to
  `injection_position: 3` "append-bottom", matching the position enum semantics
  documented in `st-preset.md`/`types.ts:11`), or should VAUD's current
  behavior be preserved for parity with existing Lumiverse-derived presets already in the wild
  via RC?
- OPEN QUESTION: should this codec's own escrow bucket (wrapper `type`,
  `schemaVersion`, `preset.id`, raw `promptVariables`, raw `block.position` per
  block) be added as new behavior beyond what VAUD's converter does today (which
  relies solely on the `_lumiverse_*` sibling-field convention and drops the rest),
  or should Vaudeville Studios deliberately match VAUD's current lossy behavior
  for behavioral parity and treat the additional escrow as a follow-on ticket?
  This spec recommends adding it (per the Round-Trip Law's "nothing is dropped at
  parse time" rule in `escrow-and-roundtrip.md:33-35`), but flags it since it is
  new behavior relative to the VAUD reference.
- OPEN QUESTION: confirm whether any Lumiverse wrapper fields exist beyond the ones
  read by the VAUD converter (the open index signatures on both `LumiverseWrapper`
  and `LumiversePresetInner` suggest more exist in the wild) - needs a corpus of
  real Lumiverse exports beyond `ThreadBare` to enumerate exhaustively before the
  escrow bucket can be considered complete.
