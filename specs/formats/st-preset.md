# Spec: SillyTavern Preset (st-preset)

**Package:** `packages/formats` (codec) · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/lumiverse-preset.md (delegation target, not yet written)
**VAUDEVILLE reference:** `packages/presets-core/src/preset-parser.ts`,
`packages/presets-core/src/types.ts` (`RawPreset` :38, `ParsedPreset` :240),
`packages/presets-core/src/marker-slots.ts`, `packages/presets-core/src/default-settings.ts`,
`packages/presets-core/src/internal/reasoning-effort-values.ts`,
`packages/presets-core/src/internal/sampler-defaults.ts`,
`packages/presets-core/src/utils/normalize.ts`, `packages/presets-core/src/utils/hash.ts`

## Purpose

This codec reads and writes SillyTavern (ST) "completion preset" JSON files: the
sampler settings, system-prompt templates, behavior flags, API options, and the
ordered `prompts[]` array (with per-character `prompt_order[]`) that together
define how ST assembles a chat completion request. Presets are the second of the
studio's three prompt-bearing formats (character, lorebook, preset) and the one
users edit most often when tuning model behavior.

ST presets have no single official spec document; VAUDEVILLE's
`packages/presets-core` is a production-hardened, comment-annotated port
(originally from "LoomBuilder") that already encodes years of ST-compatibility
bug fixes. This codec is a close adaptation of that parser/serializer pair,
retargeted to the studio's canonical `Preset` model and escrow envelope instead
of RC's `ParsedPreset` and DB row shapes.

A preset JSON that begins `{"type": "lumiverse_preset", ...}` is a different
format (Lumiverse's own preset export) and is out of scope here; see
"Edge cases" #1 and `specs/formats/lumiverse-preset.md`.

## Behavior

### Two-layer model

Presets are parsed in two layers, matching VAUDEVILLE's design
(`presets-core/src/types.ts` :38-104, :240-254):

1. **Raw layer** (`RawPreset`): the ST JSON shape, field names as ST writes them
   (`snake_case`, e.g. `frequency_penalty`, `openai_max_context`).
2. **Parsed/canonical layer**: grouped, camelCase settings plus a flat list of
   REAL prompts (divider/category rows excluded - see below) and the resolved
   enabled-state per prompt.

The canonical `Preset` model (`specs/formats/canonical-model.md` :62-64) is
declared as `prompts[]`, `promptOrder`, `samplers`, `systemPrompts`, `templates`,
`behavior`, `apiOptions`. VAUDEVILLE's `ParsedPreset` carries two additional
groups the canonical enumeration does not name: `media` (image/video inlining)
and `generation` (seed/n/maxContextUnlocked/biasPresetSelected), plus the
derived `categories`/`uncategorizedPrompts` view. This spec's decision:

- Folding `media` and `generation` into canonical `Preset.apiOptions` and
  `Preset.samplers` is rejected - they are not sampler or API-auth settings,
  and cramming them in would make those groups mean something different from
  what `canonical-model.md` describes. Instead this spec EXTENDS the canonical
  `Preset` model with two additional top-level groups, `media` and
  `generation`, matching VAUDEVILLE's grouping exactly. This is permitted by
  canonical-model.md's "Open items ... grow via codec specs" clause. A
  canonical-model.md follow-up edit should add these two groups to the
  documented shape; until then this codec spec is the source of truth for
  their fields.
- `categories`/`subCategories`/`uncategorizedPrompts` are NOT part of the
  canonical model and NOT folded into `prompts[]` either. Governing principle
  for every design choice below (required by the Round-Trip Law at `semantic`
  level, escrow-and-roundtrip.md :11-14: `parse(serialize(entity))` must be
  DEEP-EQUAL to `entity` in both `data` and `escrow`): **`serialize` composed
  with `parse` must be idempotent on the canonical entity.** Anything the
  serializer regenerates or reorders (divider identifiers, the rebuilt global
  prompt order) must never be stored verbatim in canonical `data`/`escrow` as
  if it were stable - either it must live ONLY in the output file
  (deterministically reproduced from other canonical state, never read back
  as authoritative) or the codec must stop regenerating it and REPLAY the
  stored value instead. Concretely:
  - Canonical `Preset.prompts[]` holds ONLY real prompts (never divider rows).
    A prompt whose row is a category/subcategory divider (per the detection
    rules in "Category / subcategory extraction" below) never becomes a
    canonical prompt entity.
  - The category tree - dialect (`legacy`/`nemo-wiki`), each category/
    subcategory's display name, its own `content` (nemo-wiki dividers may
    carry non-empty content, unlike legacy dividers which are content-empty by
    detection rule), its ORIGINAL divider `identifier` from the source file,
    and the ordered list of real-prompt identifiers (and nested subcategory
    nodes) it contains - is escrowed under
    `escrow["st-preset"].fields.categoryLayout`. This escrow is LOAD-BEARING,
    not informational: `serialize` MUST replay `categoryLayout` (reusing its
    stored divider identifiers and node content) rather than re-deriving a
    tree from scratch and minting new UUIDs. Reusing the original divider
    identifiers is what makes divider rows - which are themselves not part of
    canonical `data` - reproduce identically across a `parse -> serialize ->
    parse` cycle, which is what the Round-Trip Law actually requires (deep
    equality of `data` and `escrow`, not of the intermediate raw JSON).
  - A canonical prompt whose identifier is absent from `categoryLayout` (e.g.
    a prompt an editor added after import, with no divider association) is
    appended to the top-level uncategorized list on serialize; see edge case
    on newly-added prompts.

### Detection

`detect()` returns a match when the input parses as JSON and satisfies:
- Not a Lumiverse wrapper: `json.type !== "lumiverse_preset"` (delegate instead,
  see edge case #1; `presets-core/src/preset-parser.ts` :294).
- Has at least one of the ST preset marker fields: `prompts` (array),
  `prompt_order` (array), or any of the known sampler/system-prompt/behavior
  keys listed in the field map below. A bare `{}` or an object with none of
  these fields is not detected as an `st-preset`.

This mirrors `presets-core`'s permissive parse (it never throws on a mostly-
empty object; every field defaults) but a codec `detect()` needs a positive
signal so bundle-import classification (`bundle-import.md`) does not misfile
arbitrary JSON as a preset. OPEN QUESTION: the exact minimal field set for
positive detection is not specified anywhere in VAUDEVILLE (RC's importer picks
presets by file-picker context, not content sniffing) - the set above is this
spec's proposal and should be validated against the fixture corpus during
implementation, then locked in `content-detection.md`.

### Parsing: raw prompts to canonical prompts

Each `RawPrompt` (`types.ts` :14-28) parses into a canonical prompt record with
these defaults (`preset-parser.ts` :146-166, `parsePrompt`):

- `content`: `raw.content || ""`
- `role`: `raw.role || "system"`
- `enabled`: `raw.enabled !== false` (absent or `true` -> enabled; only
  explicit `false` disables) - but see "enabled is overridden by prompt_order"
  below; this initial value is provisional.
- `systemPrompt`: `raw.system_prompt || false`
- `marker`: see "Marker resolution" below.
- `injectionPosition`: `raw.injection_position || 0`
- `injectionDepth`: `raw.injection_depth ?? 4`
- `injectionOrder`: `raw.injection_order ?? 100`
- `forbidOverrides`: `raw.forbid_overrides || false`
- `injectionTrigger`: `raw.injection_trigger || []`
- `isDefault`: true iff `identifier` is one of the twelve
  `DEFAULT_PROMPT_IDENTIFIERS` (`types.ts` :401-414: `main`, `jailbreak`,
  `nsfw`, `dialogueExamples`, `chatHistory`, `worldInfoAfter`, `worldInfoBefore`,
  `enhanceDefinitions`, `charDescription`, `charPersonality`, `scenario`,
  `personaDescription`) AND the identifier is not a UUID (a UUID identifier is
  always a user-authored custom prompt even if its name happens to collide).

Duplicate identifiers in `prompts[]`: the FIRST occurrence wins; later entries
with the same `identifier` are silently skipped (`preset-parser.ts` :308,
`if (promptMap.has(rawPrompt.identifier)) continue;`).

### Marker resolution (the 5-vs-12 distinction)

Of the twelve `DEFAULT_PROMPT_IDENTIFIERS`, only FIVE are true structural
placeholders with no content of their own - ST substitutes chat history, world
info, etc. at that position - captured in `DEFAULT_MARKER_IDENTIFIERS`
(`preset-parser.ts` :59-65):

`chatHistory`, `worldInfoBefore`, `worldInfoAfter`, `dialogueExamples`,
`personaDescription`.

The other seven default identifiers (`main`, `jailbreak`, `nsfw`,
`enhanceDefinitions`, `charDescription`, `charPersonality`, `scenario`) carry
real, user-editable prompt content, even though three of them
(`charDescription`, `charPersonality`, `scenario`) are also injection anchors
that ST/RC substitute template-formatted card fields into
(`marker-slots.ts` :81-87, :102, :118 - deliberately `marker: false` in the
template so an editor's `isEditable = !marker` check keeps the content field
open).

Marker resolution precedence (`preset-parser.ts` :154-158):
1. If the raw prompt has an explicit boolean `marker` field, USE IT, including
   `marker: false`. An explicit `false` always wins even for one of the five
   identifiers above.
2. Only when `marker` is absent from the source (legacy ST presets predating
   the `marker` field), infer `marker: true` if and only if the identifier is
   one of the five `DEFAULT_MARKER_IDENTIFIERS` above. All other absent-marker
   prompts (including the other seven default identifiers and any custom
   identifier) default to `marker: false`.

This distinction exists because an earlier, cruder `isDefaultPrompt`-based
check conflated all twelve default identifiers with markers, which turned
every imported `main`/`jailbreak`/`nsfw` prompt into a marker on re-export -
ST then silently dropped that prompt's content (`preset-parser.ts` :52-58).
This bug is a required regression fixture (see Test plan).

### enabled lives in prompt_order, not on the prompt

`RawPrompt.enabled` is read into the provisional per-prompt `enabled` field
during the raw-prompt pass, but it is IMMEDIATELY OVERWRITTEN by the global
prompt order pass that follows (`preset-parser.ts` :318-345):

1. Find the entry in `json.prompt_order` whose `character_id` equals the
   numeric or string literal `100001` (`po.character_id === 100001 ||
   po.character_id === "100001"`). This is the GLOBAL order, applying
   regardless of which character is active. Call it `globalOrder`.
2. If `globalOrder` exists and has at least one entry: for each
   `{identifier, enabled}` in `globalOrder.order`, set that prompt's
   `enabled = orderItem.enabled` (this OVERWRITES whatever `RawPrompt.enabled`
   set) and record it as "referenced." Build the working prompt sequence from
   `globalOrder.order`'s identifier sequence, in that order.
3. Any prompt present in `json.prompts` but NOT referenced by `globalOrder`
   is appended to the end of the working sequence with `enabled` forced to
   `false`. This is deliberate: earlier code dropped unreferenced prompts
   entirely, which was silent data loss; appending disabled preserves them
   without changing ST's effective behavior (they were never active) and lets
   them round-trip.
4. If there is no `globalOrder` (or it has zero entries), the working sequence
   is simply `Object.keys` order of the parsed prompt map (JS Map preserves
   insertion order, i.e. `json.prompts[]` order) and each prompt keeps its
   `RawPrompt.enabled`-derived provisional value.

Non-global entries in `prompt_order[]` (any `character_id` other than
`100001`/`"100001"`) are PER-CHARACTER prompt orders - a different enabled/
ordering override active only when that specific character is loaded. These
are preserved verbatim as `Preset.promptOrder` (a `RawPromptOrder[]` holding
ONLY the non-global entries - the global `100001` entry is deliberately
EXCLUDED from canonical storage; see "Serialization" below for why). Canonical
consumers that need "the order for character X" read this array directly.
Canonical `enabled` per prompt reflects only the GLOBAL resolution above;
per-character overrides are not folded into the flat prompt's `enabled` field
since a single canonical prompt may be enabled for one character's order and
disabled for another's.

The global `100001` entry itself is NOT stored verbatim in
`Preset.promptOrder`, because `serializePreset` unconditionally discards and
rebuilds it (`preset-parser.ts` :680-687) - storing it as if it were stable
canonical data would violate `serialize -> parse` idempotence (see the
governing principle in "Two-layer model" above). Instead the global order is
fully DERIVABLE at serialize time from `categoryLayout` (walk order + divider
placement) and each prompt's resolved `enabled`, and that derivation
reproduces the same identifier sequence and `enabled` values the original
global order (if any) produced - because `categoryLayout` was itself built by
walking that exact sequence at parse time. Nothing is lost by excluding it
from canonical storage.

### Category / subcategory extraction (NemoPresetExt convention)

ST itself has no category concept. NemoPresetExt (a popular preset-organizing
extension) encodes categories as ordinary prompt rows in `prompts[]` whose
`name` follows a divider convention, detected in one of two dialects
(`preset-parser.ts` :138-144, `detectPresetFormat`):

- **legacy**: a category header's `name` contains 2+ consecutive characters
  from the set `{━, -, ─, –}` (`CONSECUTIVE_MARKER_PATTERN`, :70-81) AND the
  prompt's `content` is empty/whitespace-only (a prompt with real content that
  happens to include decorative dashes, e.g. `"─ »» Quick Pace"`, is NOT a
  category - :108-114). The category display name is the header `name` with
  marker characters stripped (:116-118). Legacy format has no subcategory
  concept.
- **nemo-wiki**: a category header matches `/^===(.+)===$/` and a subcategory
  header matches `/^<([^>]+)>$/` (:84-85). Subcategories nest via a stack;
  encountering a new subcategory or category header flushes (closes) any open
  subcategory stack first, so sibling subcategories at the same level do not
  nest into each other (a previously-fixed "matryoshka nesting" bug, :215-217).

Format is detected once per preset by scanning ALL raw prompts for any wiki
pattern (`detectPresetFormat`, :138-144): if any prompt name matches either
wiki pattern, the whole preset parses as `nemo-wiki`; otherwise `legacy`. A
preset can only be one or the other, not mixed.

Prompts in the working sequence are walked in order; each header row opens a
new category/subcategory and every following non-header prompt is appended to
the currently-open (sub)category, or to `uncategorizedPrompts` if none is open
yet (`parseLegacyFormat` :243-280, `parseWikiFormat` :172-241).

This studio codec DIVERGES from VAUDEVILLE at the boundary between "extract
the tree" and "store it": VAUDEVILLE's `ParsedPreset` keeps the tree
(`categories[]`/`uncategorizedPrompts`) as the ONLY representation (no flat
prompt list at all) and reconstructs `prompts[]` fresh on every serialize,
including fresh divider UUIDs - this is safe for VAUDEVILLE because
`ParsedPreset` is a transient in-memory/DB shape, never itself required to
round-trip byte-for-byte through repeated parse/serialize cycles the way this
studio's canonical `Entity<Preset>` must. This codec instead stores the real
prompts flat in canonical `prompts[]` (matching the canonical model's declared
shape) and stores the tree - dialect, node names/content, ORIGINAL divider
identifiers, and per-node ordered child references (leaf prompt identifiers or
nested subcategory nodes) - in `escrow["st-preset"].fields.categoryLayout`.
This escrow is load-bearing: see "Serialization" below.

### Serialization

`serializePreset`-equivalent behavior (reference: `preset-parser.ts` :468-737,
adapted per the divergence noted above) rebuilds `prompts[]` and a fresh
global `prompt_order` entry (`character_id: 100001`) from canonical state:

- The category/subcategory tree is REPLAYED from `escrow["st-preset"]
  .fields.categoryLayout`, not re-derived from scratch. Each divider row is
  emitted using its STORED original `identifier` (not a freshly generated
  UUID) and stored `name`/`content`, in the dialect (`legacy` vs `nemo-wiki`)
  recorded in the escrow (or the caller's explicit `outputFormat` override).
  Divider row shape: `{identifier, name, content, role: "system",
  system_prompt: false, marker: false}`. Reusing the stored identifier is what
  keeps divider rows identical across a `parse -> serialize -> parse` cycle -
  necessary because, while dividers are never canonical `data`, the escrowed
  `categoryLayout` IS canonical `escrow`, and if serialize regenerated
  identifiers the next parse would capture a NEW `categoryLayout` with
  different divider identifiers than the original, breaking escrow
  deep-equality under the Round-Trip Law.
- Each real prompt is emitted from its canonical prompt entity. The five true
  markers (`DEFAULT_MARKER_IDENTIFIERS`) emit the SPARSE 4-key shape ST itself
  prefers - `{identifier, name, system_prompt, marker: true}`, omitting
  `content`/`role`/`injection_position`/`injection_depth`/`injection_order`/
  `forbid_overrides`/`injection_trigger` - ONLY WHEN every one of those fields
  is at its parse-time default (`content === ""`, `role === "system"`,
  `injectionPosition === 0`, `injectionDepth === 4`, `injectionOrder === 100`,
  `forbidOverrides === false`, `injectionTrigger.length === 0`). If ANY of
  those fields carries a non-default value (e.g. a custom `injectionDepth`),
  the FULL shape is emitted instead, still with `marker: true`. This is a
  DELIBERATE DIVERGENCE from VAUDEVILLE, which always emits the sparse shape
  for these five identifiers regardless of content (`preset-parser.ts`
  :506-527) - VAUDEVILLE's own comment there acknowledges the full shape
  "confuses ST's import," but always-sparse is provably lossy: escrow rule 2
  (escrow-and-roundtrip.md) requires escrowed values to merge back into their
  original locations on serialize to the origin format, and a value dropped
  from the OUTPUT FILE cannot be recovered by the NEXT parse of that file (the
  next parse has no escrow to read from - escrow lives in the canonical
  entity, not in the ST JSON). Always-sparse and lossless round-trip are
  mutually exclusive for a marker with non-default injection metadata; this
  spec chooses losslessness (full shape when customized) over exact ST-import
  conservatism. OPEN QUESTION: whether real ST/RC actually mishandles a
  five-key-plus marker row in practice (VAUDEVILLE's comment asserts it does,
  but does not cite a specific ST version or failure mode) - worth verifying
  against a live ST import before this codec ships, since if VAUDEVILLE's
  caution is correct this codec should instead escrow the non-default values
  AND keep the sparse shape, accepting an ST-round-trip loss the studio's own
  round-trip does not share (escrow is read back into canonical on the studio
  side even though it never reached the file).
- `enabled` is NEVER emitted on a `RawPrompt` object - it lives exclusively in
  the rebuilt `prompt_order[100001].order[].enabled`.
- `marker` is only emitted (`marker: true`) when true; a `marker: false`
  prompt omits the key entirely rather than writing `marker: false`.
- The global order (`character_id: 100001`) is REBUILT from scratch by walking
  the replayed `categoryLayout` tree in order (uncategorized prompts first,
  then each category's divider followed by its prompts and subcategories,
  recursively) and reading each visited real prompt's canonical `enabled`;
  each visited divider contributes `{identifier, enabled: true}`. This
  reproduces the same identifier sequence and `enabled` values that produced
  `categoryLayout` at parse time (see "enabled lives in prompt_order" above),
  which is why excluding the global entry from canonical `promptOrder` storage
  loses nothing. The rebuilt global entry is appended after all of canonical
  `Preset.promptOrder`'s (non-global-only, per above) entries.
- A canonical prompt with no `categoryLayout` placement (added after import,
  see edge case) is appended to the top-level uncategorized list, in
  `Preset.prompts[]` array order among such unplaced prompts, after all
  `categoryLayout`-placed content.
- Unknown/unmapped top-level fields, collected into `rawSettings` at parse time
  (see field map), are spread back onto the output object last so they win
  over nothing (no known field collides with an unknown key by construction)
  and survive round-trip untouched.

### Byte-identity level

**semantic.** The redesign above (load-bearing `categoryLayout` replay,
canonical `promptOrder` excluding the derived global entry, conditional
marker shape) is specifically engineered so `parse(serialize(entity))` is
deep-equal to `entity` in both `data` and `escrow` - the semantic bar. It does
NOT reach `canonical-json` or `byte`, because:
1. The raw OUTPUT FILE's global `prompt_order` entry is always rebuilt and
   appended at the end of the `prompt_order[]` array; if the SOURCE file had
   its global entry at a different array position, or had NO global entry at
   all, the raw JSON differs even though the canonical entity round-trips
   perfectly (canonical `promptOrder` never held the global entry to begin
   with, so this is invisible to `data`/`escrow` equality).
2. `enabled` is never written onto a `RawPrompt` object; a hand-authored
   source file that put `enabled` directly on a prompt (with no corresponding
   `prompt_order` entry) will not byte-round-trip, though it parses correctly
   and the RESOLVED `enabled` (case 4 in "enabled lives in prompt_order")
   round-trips at the canonical level.
3. General JSON serialization concerns apply (key order, whitespace) per the
   base `semantic` definition in escrow-and-roundtrip.md.

`serialize(parse(F), "st-preset")` is required to be semantically identical
per the Round-Trip Law: parsing the output again must yield deep-equal
canonical `data` and deep-equal `escrow` to parsing `F` directly. This spec
does NOT claim canonical-json or byte level for `st-preset`.

## Field map

Source: `RawPreset` (`presets-core/src/types.ts` :38-104). Canonical target
groups per "Two-layer model" above (`Preset.samplers`, `.systemPrompts`,
`.templates`, `.behavior`, `.apiOptions`, `.media`, `.generation`,
`.prompts[]`, `.promptOrder`).

| Source field | Canonical field | native/escrow/dropped | Notes |
|---|---|---|---|
| `temperature` | `samplers.temperature` | native | default `1` (`default-settings.ts` :4) |
| `frequency_penalty` | `samplers.frequencyPenalty` | native | default `0` |
| `presence_penalty` | `samplers.presencePenalty` | native | default `0` |
| `top_p` | `samplers.topP` | native | default `0.97` |
| `top_k` | `samplers.topK` | native | default `64` |
| `top_a` | `samplers.topA` | native | default `0` |
| `min_p` | `samplers.minP` | native | default `0` |
| `repetition_penalty` | `samplers.repetitionPenalty` | native | default `1` |
| `openai_max_context` | `samplers.maxContext` | native | default `2_000_000`; field renamed despite `openai_` prefix - applies regardless of provider |
| `openai_max_tokens` | `samplers.maxTokens` | native | default `DEFAULT_MAX_RESPONSE_TOKENS` = `8192` (`internal/sampler-defaults.ts` :17) |
| `prompt_post_processing` | `samplers.promptPostProcessing` | native | default `"none"`; enum `none\|merge\|semi\|strict\|single` per `SamplerSettings` (`types.ts` :224), cast without validation at parse |
| `impersonation_prompt` | `systemPrompts.impersonationPrompt` | native | default `""` |
| `new_chat_prompt` | `systemPrompts.newChatPrompt` | native | default `""` |
| `new_group_chat_prompt` | `systemPrompts.newGroupChatPrompt` | native | default `""` |
| `new_example_chat_prompt` | `systemPrompts.newExampleChatPrompt` | native | default `"[Example Chat]"` |
| `continue_nudge_prompt` | `systemPrompts.continueNudgePrompt` | native | default `""` |
| `group_nudge_prompt` | `systemPrompts.groupNudgePrompt` | native | default `""` |
| `assistant_prefill` | `systemPrompts.assistantPrefill` | native | default `""` |
| `assistant_impersonation` | `systemPrompts.assistantImpersonation` | native | default `""` |
| `wi_format` | `templates.wiFormat` | native | default `"[Details of the fictional world the RP is set in:\n{0}]"` |
| `scenario_format` | `templates.scenarioFormat` | native | default `"{{scenario}}"` |
| `personality_format` | `templates.personalityFormat` | native | default `"[{{char}}'s personality: {{personality}}]"` |
| `wrap_in_quotes` | `behavior.wrapInQuotes` | native | default `false` |
| `names_behavior` | `behavior.namesBehavior` | native | default `0`; numeric enum, values not further documented in VAUDEVILLE source - OPEN QUESTION: exact meaning of each integer |
| `send_if_empty` | `behavior.sendIfEmpty` | native | default `"[Continue]"` |
| `continue_prefill` | `behavior.continuePrefill` | native | default `true` |
| `continue_postfix` | `behavior.continuePostfix` | native | default `" "` |
| `stream_openai` | `apiOptions.streamOpenai` | native | default `true` |
| `claude_use_sysprompt` | `apiOptions.claudeUseSysprompt` | native | default `true` |
| `use_makersuite_sysprompt` | `apiOptions.useMakersuiteSysprompt` | native | default `true` |
| `squash_system_messages` | `apiOptions.squashSystemMessages` | native | default `true` |
| `function_calling` | `apiOptions.functionCalling` | native | default `true` |
| `show_thoughts` | `apiOptions.showThoughts` | native | default `true` |
| `reasoning_effort` | `apiOptions.reasoningEffort` | native | normalized via `normalizeReasoningEffort` (`internal/reasoning-effort-values.ts` :79-88): trimmed+lowercased, `"min"`->`"minimal"`, `"max"`->`"xhigh"`, else must be one of `auto\|none\|minimal\|low\|medium\|high\|xhigh` or falls back to default `"auto"` |
| `enable_web_search` | `apiOptions.enableWebSearch` | native | default `true` |
| `request_images` | `apiOptions.requestImages` | native | default `true` |
| `image_inlining` | `media.imageInlining` | native | default `false` |
| `inline_image_quality` | `media.inlineImageQuality` | native | default `"auto"` |
| `video_inlining` | `media.videoInlining` | native | default `false` |
| `seed` | `generation.seed` | native | default `-1` |
| `n` | `generation.n` | native | default `1` |
| `max_context_unlocked` | `generation.maxContextUnlocked` | native | default `false` |
| `bias_preset_selected` | `generation.biasPresetSelected` | native | default `""` |
| `prompts[]` (real-prompt rows) | `prompts[]` | native | see "Parsing: raw prompts" and marker resolution above |
| `prompts[]` (divider rows: category/subcategory headers) | `escrow["st-preset"].fields.categoryLayout` | escrow | load-bearing; replayed verbatim (including original divider identifiers) on serialize - see "Category / subcategory extraction" and "Serialization" |
| `prompt_order[]` global entry (`character_id: 100001`/`"100001"`) | (not stored verbatim) | dropped from canonical storage, fully re-derivable | drives `prompts[].enabled` resolution and `categoryLayout` construction at parse time; REBUILT from `categoryLayout` + resolved `enabled` at serialize time - see "Serialization" |
| `prompt_order[]` non-global entries | `promptOrder` | native | carried through unchanged in both directions |
| any other top-level key | `escrow["st-preset"].fields.rawSettings.<key>` | escrow | collected via `knownFields` exclusion list (`preset-parser.ts` :422-435); spread back onto output last on serialize |

### RawPrompt field map (real prompts only; divider rows are covered above)

| Source field | Canonical field | native/escrow/dropped | Notes |
|---|---|---|---|
| `identifier` | `prompts[].identifier` | native | stable across round-trip for real prompts (only divider identifiers are ever replayed-not-generated; real prompt identifiers are never rewritten by default) |
| `name` | `prompts[].name` | native | |
| `content` | `prompts[].content` | native | default `""`; DROPPED on serialize output for a true marker ONLY when the marker is at all-default injection state (sparse shape) - see "Serialization" |
| `role` | `prompts[].role` | native | default `"system"`; DROPPED on serialize for an all-default true marker only |
| `enabled` | `prompts[].enabled` (provisional, then overwritten) | native | see "enabled lives in prompt_order" - NEVER emitted on serialize; lives only in the rebuilt `prompt_order[100001]` |
| `system_prompt` | `prompts[].systemPrompt` | native | default `false`; always emitted on serialize (both sparse and full prompt shapes) |
| `marker` | `prompts[].marker` | native | see "Marker resolution"; emitted only when `true` |
| `injection_position` | `prompts[].injectionPosition` | native | default `0`; enum `0\|1\|2\|3\|4` (relative/in-chat/append/append-bottom/prepend-top); DROPPED on serialize for an all-default true marker only |
| `injection_depth` | `prompts[].injectionDepth` | native | default `4`; DROPPED on serialize for an all-default true marker only |
| `injection_order` | `prompts[].injectionOrder` | native | default `100`; DROPPED on serialize for an all-default true marker only |
| `forbid_overrides` | `prompts[].forbidOverrides` | native | default `false`; DROPPED on serialize for an all-default true marker only |
| `injection_trigger` | `prompts[].injectionTrigger` | native | default `[]`; DROPPED on serialize for an all-default true marker only |
| (derived) | `prompts[].isDefault` | native (computed) | true iff identifier in `DEFAULT_PROMPT_IDENTIFIERS` and not UUID-shaped; not stored in source JSON, recomputed on every parse |

`RawPromptOrder` (`types.ts` :30-36): `character_id` (`string \| number`) and
`order: Array<{identifier, enabled}>` carry through as opaque structured data
inside `Preset.promptOrder` for NON-GLOBAL entries only; no further canonical
decomposition. The global (`100001`) entry is excluded from this array (see
field map above).

## Capabilities matrix

```ts
const capabilities: Record<CanonicalPresetFieldPath, "native" | "escrow" | "dropped"> = {
  "samplers.*": "native",
  "systemPrompts.*": "native",
  "templates.*": "native",
  "behavior.*": "native",
  "apiOptions.*": "native",
  "media.*": "native",
  "generation.*": "native",
  "prompts[].identifier": "native",
  "prompts[].name": "native",
  "prompts[].content": "native",
  "prompts[].role": "native",
  "prompts[].enabled": "native",
  "prompts[].systemPrompt": "native",
  "prompts[].marker": "native",
  "prompts[].injectionPosition": "native",
  "prompts[].injectionDepth": "native",
  "prompts[].injectionOrder": "native",
  "prompts[].forbidOverrides": "native",
  "prompts[].injectionTrigger": "native",
  "promptOrder": "native",
};
```

No canonical `Preset` field is unconditionally `dropped` by this codec on
parse (everything unmapped goes to escrow, per the Round-Trip Law's "nothing
is dropped, ever, at parse time"). On SERIALIZE to `st-preset`, a true
marker's `content`/`role`/`injectionPosition`/`injectionDepth`/
`injectionOrder`/`forbidOverrides`/`injectionTrigger` are omitted from the
OUTPUT FILE only when ALL of them are at default (the sparse shape is then
lossless - reparsing recovers the same defaults); when ANY is non-default the
full shape is emitted instead, so nothing is ever actually lost from the
canonical entity across a `parse -> serialize -> parse` cycle. `categoryLayout`
and non-global `promptOrder` entries are always native/escrow-recoverable,
never dropped.

## Public API sketch

```ts
// packages/formats/src/st-preset/index.ts
import type { Entity, ParseReport, SerializeReport } from "@vaud/core";
import type { Preset } from "@vaud/core/preset";

export interface StPresetCodec {
  readonly formatId: "st-preset";

  /** Cheap structural sniff; does not throw. Returns false for lumiverse_preset wrappers. */
  detect(input: unknown): boolean;

  /**
   * Parses a raw ST preset JSON value into a canonical Preset entity.
   * Delegates to the lumiverse-preset codec if `input.type === "lumiverse_preset"`.
   */
  parse(input: unknown, opts?: { name?: string }): {
    entity: Entity<Preset>;
    report: ParseReport;
  };

  /**
   * Serializes a canonical Preset entity back to raw ST preset JSON.
   * `outputFormat` controls legacy-divider vs nemo-wiki-divider category
   * emission; defaults to the format recorded in escrow at parse time.
   */
  serialize(
    entity: Entity<Preset>,
    opts?: {
      outputFormat?: "legacy" | "nemo-wiki";
      regenerateModifiedUUIDs?: boolean;
      baselineHashes?: Map<string, string>;
    }
  ): {
    raw: Record<string, unknown>;
    report: SerializeReport;
  };

  readonly capabilities: Record<string, "native" | "escrow" | "dropped">;
}

export const stPresetCodec: StPresetCodec;
```

This mirrors the `Codec` interface named in `docs/02-ARCHITECTURE.md`
(`detect / parse / serialize / capabilities`) and lives in `packages/formats`,
which per the dependency rule (`core <- formats <- everything`) imports only
`packages/core` (for `Entity`, `ParseReport`, `SerializeReport`, the canonical
`Preset` type) and has no dependency on `packages/presets-core`-equivalent
internals beyond what this spec ports inline.

## Edge cases & failure modes

1. **Lumiverse wrapper input.** `input.type === "lumiverse_preset"`: `detect()`
   returns `false` for `st-preset` (the lumiverse-preset codec claims it
   instead); `parse()` on this codec should not be called with such input by
   the bundle-import classifier. VAUDEVILLE's own `parsePreset` auto-detects
   and delegates internally (`preset-parser.ts` :293-297); this studio's codec
   architecture keeps that delegation at the CLASSIFICATION layer
   (bundle-import.md) instead of inside the `st-preset` parser, so each codec
   stays single-format. OPEN QUESTION: confirm this classification-layer
   delegation is acceptable to bundle-import.md's design once that spec is
   written; if not, `st-preset.parse()` may need to internally delegate like
   VAUDEVILLE does.
2. **Duplicate prompt identifiers.** First occurrence wins; later duplicates
   are dropped silently (matches VAUDEVILLE; a `ParseReport` warning should be
   recorded - VAUDEVILLE does not warn, but the studio's report-honesty
   principle, escrow-and-roundtrip.md's `warnings` list, calls for surfacing
   this even though the behavior itself is unchanged).
3. **Prompt referenced in global `prompt_order` but absent from `prompts[]`.**
   The order entry is skipped (`promptMap.get` returns undefined,
   `preset-parser.ts` :329-333 the `if (prompt)` guard) - no synthetic empty
   prompt is created. No data loss (nothing existed to lose) but should be a
   `ParseReport` warning.
4. **No global order and no `prompt_order` at all.** Working sequence is
   `json.prompts[]` insertion order; every prompt keeps its raw `enabled`
   value (default `true` unless explicitly `false`). No prompts are force-
   disabled.
5. **Marker prompt (one of the 5) carries non-default injection metadata.**
   Parses onto the canonical prompt's fields exactly like any other prompt
   (no special-casing at parse time - the marker distinction only affects
   SERIALIZE). On serialize, the full shape is emitted instead of the sparse
   shape (see "Serialization"), so the values survive both in canonical `data`
   and in the raw output file. See the OPEN QUESTION in "Serialization" about
   whether this is safe for a REAL ST import (VAUDEVILLE avoids the full shape
   here specifically for ST-import compatibility, a concern this spec
   deliberately overrides in favor of the Round-Trip Law).
6. **Legacy-format category header whose name contains marker characters but
   also has real content.** Not a category (`isCategory` requires empty/
   whitespace content, `preset-parser.ts` :108-114); treated as an ordinary
   prompt and placed in whichever category/subcategory is currently open (or
   uncategorized).
7. **nemo-wiki subcategory encountered with no open category.** The
   `isWikiSubCategory(...) && currentCategory` guard (:214) means a
   subcategory header with no preceding category header does NOT open a
   subcategory. It falls through every branch of the `if/else if` chain in
   `parseWikiFormat` (:196-231) and lands on the final `else`
   (`uncategorizedPrompts.push(prompt)`, :230) - the subcategory header
   PROMPT ITSELF (not its would-be children) becomes an ordinary uncategorized
   prompt, name unstripped (still literally `<Sub>`). Its `categoryLayout`
   escrow accordingly records no subcategory node in this case.
8. **Mixed legacy and nemo-wiki divider syntax in one file.** `detectPresetFormat`
   scans ALL prompts and returns `"nemo-wiki"` if ANY prompt matches a wiki
   pattern (:138-144); the file is then parsed exclusively in wiki mode, so any
   legacy-style `━━━ Name ━━━` divider rows are NOT treated as category headers
   in this pass - they become ordinary prompts (their marker-character name
   is preserved verbatim, unstripped) inside whatever wiki category is open.
9. **`character_id` as string vs number `"100001"` / `100001`.** Both forms
   are recognized as the global order on parse (`preset-parser.ts` :320); on
   serialize the studio codec must pick one canonical representation - this
   spec follows VAUDEVILLE and emits the NUMBER form `100001` (:685), while
   preserving any non-global entries' original `character_id` type unchanged
   (they are never rewritten).
10. **UUID-shaped custom identifier that happens to equal a
    `DEFAULT_PROMPT_IDENTIFIERS` string.** Impossible in practice (UUIDs and
    the default identifier strings are disjoint character-shape-wise) but the
    code explicitly guards `isCustomPrompt` (UUID regex match) before checking
    `DEFAULT_PROMPT_IDENTIFIERS`/`DEFAULT_MARKER_IDENTIFIERS`
    (`preset-parser.ts` :91-98, :103-106) - a UUID identifier is NEVER treated
    as default/marker regardless of its `name`.
11. **Unknown top-level fields that collide with a future known field name.**
    Not currently possible (the `knownFields` set is exhaustive over
    `RawPreset`'s declared keys) but if a codec version adds a new known field,
    any existing escrowed `rawSettings.<thatKey>` from an older parse could
    collide on next serialize; the "Conflict rule" in escrow-and-roundtrip.md
    (canonical wins, record `escrowShadowed`) applies.
12. **`reasoning_effort` value outside the known enum and not `min`/`max`.**
    `normalizeReasoningEffort` returns `undefined` for anything unrecognized
    (after trim+lowercase), and the parser then falls back to the default
    `"auto"` (`preset-parser.ts` :403, `?? DEFAULT_PRESET_API_OPTIONS.reasoningEffort`).
    The original unrecognized string is NOT currently escrowed by VAUDEVILLE;
    this codec MUST escrow it (`escrow["st-preset"].fields.reasoningEffortRaw`)
    to satisfy "nothing is dropped, ever, at parse time" - this is a
    deliberate improvement over the ported behavior, flagged here since it is
    new to this spec, not observed in VAUDEVILLE source.
13. **`prompt_post_processing` value outside the declared union.** Cast
    without validation (`preset-parser.ts` :368, `as SamplerSettings[...]`) -
    an invalid string passes through as-is into canonical `samplers.promptPostProcessing`
    typed as the union; this codec should either widen the canonical type to
    `string` or escrow invalid values similarly to case 12. OPEN QUESTION:
    which approach the `core` package's zod schema for `Preset` should take;
    defer to `packages/core` schema authors.
14. **Canonical prompt added or removed after import (editor use), with no
    corresponding `categoryLayout` entry.** A newly ADDED prompt (identifier
    not present anywhere in the escrowed `categoryLayout`) is appended to the
    top-level uncategorized list on serialize (see "Serialization"). A REMOVED
    prompt (identifier present in `categoryLayout` but no longer in
    `Preset.prompts[]`) is simply skipped when replaying that layout node -
    its slot in the tree disappears, its sibling order is otherwise
    unaffected. Neither case is a Round-Trip Law violation since the Law only
    requires `parse(serialize(x))` to equal `x` for entities that were not
    independently mutated between calls; editor mutation is out of scope for
    the parse/serialize pair itself.

## Test plan

Fixtures (place under `fixtures/st-preset/<name>/`, each with the input file,
`expected.json`, and `notes.md` per escrow-and-roundtrip.md's fixture rules):

- `legacy-basic/` - a legacy-format preset with a handful of custom prompts,
  no categories, a global `prompt_order`. Exercises the base field map.
- `legacy-categories/` - legacy `━━━ Name ━━━` category dividers with several
  prompts nested under them, uncategorized prompts before the first category.
  Verifies `categoryLayout` escrow captures the tree and original divider
  identifiers, and that `parse(serialize(parse(F)))` reproduces identical
  divider identifiers (not fresh UUIDs) and identical `data`/`escrow`.
- `nemo-wiki-nested/` - `===Category===` and nested `<Sub>` subcategory
  dividers at 2+ levels deep, exercising the stack-flush-on-sibling behavior
  (edge case region around :214-223), including a wiki category with
  non-empty divider `content`. Same round-trip verification as
  `legacy-categories/`.
- `marker-main-jailbreak-nsfw-regression/` - a preset where `main`,
  `jailbreak`, and `nsfw` prompts have real content and NO explicit `marker`
  field (legacy pre-marker-field ST export). Must parse with `marker: false`
  on all three (per "Marker resolution") and must round-trip their content
  intact through serialize. This is the required regression fixture for the
  documented data-loss bug (`preset-parser.ts` :52-58).
- `marker-with-injection-override/` - a `chatHistory` (true marker) prompt
  with a non-default `injection_depth` (e.g. `7` instead of `4`) in the source.
  Verifies (a) the value parses onto the canonical prompt exactly like any
  other prompt, (b) serialize emits the FULL prompt shape (not sparse) because
  the marker is not all-default, and (c) `parse(serialize(parse(F)))` is
  deep-equal to `parse(F)` including the non-default `injectionDepth`.
- `per-character-order/` - `prompt_order[]` with both a global (`100001`)
  entry and at least one per-character entry; verifies non-global entries
  survive untouched and do not affect resolved `enabled`.
- `unreferenced-prompt/` - a prompt present in `prompts[]` but absent from the
  global order's `order[]`; verifies it is appended, `enabled: false`, at the
  end of the working sequence.
- `unknown-fields-passthrough/` - a preset JSON with several fields not in
  `RawPreset`'s declared surface (simulating a newer ST version or a
  community-extension field); verifies they land in
  `escrow["st-preset"].fields.rawSettings` and are spread back unchanged on
  serialize.
- `reasoning-effort-legacy-values/` - `reasoning_effort: "min"` and
  `reasoning_effort: "max"` inputs; verifies normalization to `"minimal"` and
  `"xhigh"`.
- `duplicate-identifier/` - `prompts[]` containing two entries with the same
  `identifier` and different content; verifies the first wins.
- `wiki-orphan-subcategory/` - a nemo-wiki preset with a `<Sub>` header that
  has no preceding `===Category===` header; verifies it lands in
  `uncategorizedPrompts` per edge case 7, unstripped.

Round-Trip Law applicability: full applicability at `semantic` level (see
"Byte-identity level"). For every fixture F, `parse(serialize(parse(F)))` must
deep-equal `parse(F)` in both `data` and `escrow`. The harness must NOT assert
byte-identical or key-order-identical output JSON for this codec.

Property/unit tests beyond fixtures:
- Marker precedence table: for each of the 12 default identifiers, cross
  `marker` field absent/true/false against expected resolved `marker` and
  `isDefault`.
- `normalizeReasoningEffort` table test covering all documented inputs
  (`internal/reasoning-effort-values.ts` :79-88) plus an unrecognized string.
- `detectPresetFormat` returns `"nemo-wiki"` if ANY prompt matches a wiki
  pattern, `"legacy"` otherwise, including a zero-prompts preset (must return
  `"legacy"`, the loop trivially finds nothing).
- Serializer never emits `enabled` on any `RawPrompt` object, for any fixture.
- Serializer's sparse marker shape has EXACTLY the four keys
  `{identifier, name, system_prompt, marker}` for all five true markers WHEN
  the marker's injection-related fields are all at default; the full 9-key
  shape is emitted otherwise (see "Serialization").
- `categoryLayout` replay never mints a new divider identifier: for any
  fixture with categories, every divider `identifier` in the serialized
  output equals the corresponding divider `identifier` recorded in
  `categoryLayout` at parse time.
- The rebuilt global `prompt_order[100001]` entry, for a fixture whose source
  HAD a global entry, contains the same set of identifiers (real prompts +
  dividers) with the same `enabled` values as the source's global entry, in
  the same relative order (position in the overall `prompt_order[]` array may
  differ; see "Byte-identity level" #1).

## Non-goals

- Lumiverse preset format conversion (`{type: "lumiverse_preset"}` wrapper,
  block model, marker `''`/`category`/`chat_history`) - separate codec, see
  `specs/formats/lumiverse-preset.md`.
- `contextMode`/`maxMessages` (`SamplerSettings` :226-237) - these are
  RC-runtime prompt-assembly knobs never read by `parsePreset`/`serializePreset`
  and have no corresponding field anywhere in `RawPreset`; they belong to
  `specs/engine/prompt-assembly.md` or an RC-specific extension, not this codec.
- `DbPreset`, `DbPresetPrompt`, `DbPromptRegexRule`, `DbPresetCategory`,
  `DbPresetOrder`, `DbPresetState`, `DbPresetPromptVersion` (`types.ts`
  :270-395) - RC/Supabase persistence row shapes, not part of the ST file
  format; out of scope for a format codec entirely.
- Regex rules attached to prompts (`ParsedRegexRule`/`DbPromptRegexRule`) -
  these are loaded from RC's database separately from the preset JSON file
  itself (`ParsedPrompt.regexRules` is `optional`, "loaded from DB" per the
  source comment at `types.ts` :125); the ST preset JSON format proper does
  not carry regex rules. See `specs/formats/regex-scripts.md` for the actual
  ST regex-script JSON format, a distinct file type.
- Rendering/UI concerns: category display formatting, the prompt editor's
  `isEditable = !marker` behavior, health-score or doctor-pass integration.
- Validating sampler value RANGES (e.g. rejecting `temperature: 500`) - this
  codec parses and round-trips whatever numbers are present; range validation,
  if wanted, belongs to a doctor pass (`specs/features/script-doctor.md`).
- Computing token counts for prompt content - delegated to the `TokenCounter`
  interface per `canonical-model.md`.

## Sources consulted

- `<RoleCall>\packages\presets-core\src\types.ts`
  (full file; `RawPreset` :38-104, `RawPrompt` :14-28, `RawPromptOrder` :30-36,
  `ParsedPreset` :240-254, `DEFAULT_PROMPT_IDENTIFIERS` :401-414, `Db*` types
  :270-395)
- `<RoleCall>\packages\presets-core\src\preset-parser.ts`
  (full file: `DEFAULT_MARKER_IDENTIFIERS` :59-65, `isCustomPrompt`/`isDefaultPrompt`/
  `isDefaultMarkerIdentifier` :91-106, `isCategory` :108-114, wiki patterns
  :83-85, `detectPresetFormat` :138-144, `parsePrompt` :146-166,
  `parseWikiFormat` :172-241, `parseLegacyFormat` :243-280, `parsePreset`
  :293-459 including Lumiverse delegation :294-297, duplicate-identifier skip
  :308, global order resolution :318-345, `serializePreset` :468-737 including
  sparse marker shape :506-527, divider UUID generation :561/:597, global
  order rebuild :634-687, `rawSettings` spread :735)
- `<RoleCall>\packages\presets-core\src\marker-slots.ts`
  (full file: `PRESET_MARKER_SLOT_TEMPLATES` and the `charDescription`/
  `charPersonality`/`scenario` marker:false rationale comments :81-92, :102-108,
  :118-124)
- `<RoleCall>\packages\presets-core\src\default-settings.ts`
  (full file: all default constant values)
- `<RoleCall>\packages\presets-core\src\internal\reasoning-effort-values.ts`
  (full file: `normalizeReasoningEffort` :79-88 and enum values :1-18)
- `<RoleCall>\packages\presets-core\src\internal\sampler-defaults.ts`
  (full file: `DEFAULT_MAX_RESPONSE_TOKENS` :17)
- `<RoleCall>\packages\presets-core\src\utils\normalize.ts`
  (full file: `normalizeInjectionPosition`, noted as an RC-DB-only concern, not
  part of the ST JSON format proper)
- `<RoleCall>\packages\presets-core\src\utils\hash.ts`
  (full file: `hashContent`/`computeContentHashes`, used only by
  `regenerateModifiedUUIDs` serialize option)
- `<RoleCall>\packages\presets-core\src\index.ts`
  (full file: package barrel and vendoring/exclusion notes)
- `docs\the master plan (private planning notes)`
- `docs\02-ARCHITECTURE.md`
  (Codec interface, dependency rule, canonical model + escrow summary)
- `docs\the production bible (private planning notes)`
  (brief row for `st-preset.md`, line 48)
- `specs\formats\canonical-model.md`
  (canonical `Preset` field enumeration, :62-64)
- `specs\formats\escrow-and-roundtrip.md`
  (Round-Trip Law, escrow envelope rules, capabilities matrix, fixture corpus
  rules)
- `templates\SPEC-TEMPLATE.md`
- `docs\the extraction map (private planning notes)`
  (lines 7-14, confirms `packages/presets-core` as the extraction source and
  "already dependency-clean")

No public/web sources were consulted: ST presets have no official published
spec and the production bible (private planning notes)'s brief for this file names only the
VAUDEVILLE source as ground truth, consistent with the global rule that web
research is reserved for the formats it explicitly calls out
(chara_card_v2/v3, charx, Backyard).
