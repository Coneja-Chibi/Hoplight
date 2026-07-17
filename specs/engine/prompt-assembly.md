# Spec: Prompt Assembly

**Package:** `packages/assembly` · **Milestone:** M5 · **Status:** draft
**Depends on:** `specs/formats/canonical-model.md`, `specs/formats/escrow-and-roundtrip.md`,
`specs/engine/lorebook-engine.md`, `specs/engine/macro-engine.md` (not yet written — this
spec treats its public surface as the `packages/macros` sketch in `docs/02-ARCHITECTURE.md`
and cross-references VAUDEVILLE's macro processor directly where needed), `specs/engine/token-counting.md`,
`specs/formats/st-preset.md`, `specs/formats/regex-scripts.md`, `specs/formats/canonical-model.md`
("Character" and "Persona" sections)
**VAUDEVILLE reference:** reimplement, do not port —
`apps/rc/src/lib/ai/prompt-assembly.ts` (full file, 3991 lines),
`apps/rc/src/lib/ai/preset-loader.ts`,
`apps/rc/src/lib/ai/lorebook-position-injection.ts`,
`apps/rc/src/lib/ai/context-budget.ts`,
`apps/rc/src/lib/ai/jobs/depth-guides.ts` (`appendAtDepth`),
`apps/rc/src/lib/prompt-tracking/types.ts` (trace/debug shape reference),
`apps/rc/src/lib/regex/apply-regex.ts`

## Purpose

Prompt assembly turns a (character, persona, preset, active lorebooks, message history,
current turn) tuple into the exact ordered message list an AI provider will see, plus a
full trace explaining where every byte came from. It is the component the Test Stage
(`specs/features/test-stage.md`) drives to let a user watch their prompt get built,
swap a preset mid-session, and diagnose why a lorebook entry did or didn't fire. It has
no network access and no AI calls of its own — it is a pure function (modulo controlled
randomness in macro/lorebook rolls, see "Determinism") of its inputs to `{ messages, trace }`.
It is the top of the engine stack: it calls `packages/lore` (lorebook matching),
`packages/macros` (macro expansion), and `packages/regexkit` (regex post-passes), and
consumes canonical `Character`/`Persona`/`Preset`/`Lorebook` entities from `packages/core`
plus a `TokenCounter` from `specs/engine/token-counting.md`. This is a clean-room
reimplementation of VAUDEVILLE's `apps/rc/src/lib/ai/prompt-assembly.ts`: that file is the
proven behavioral reference (10+ ordered assembly stages, hard-won edge-case fixes with
inline VVS-ticket comments), but it is DB-entangled (Supabase, chat rows, job workers,
RC-specific features like TunnelVision/CarrotKernel/Stagecraft/Visual Novel/Character
Minds/Orison) and none of that entanglement belongs in `packages/assembly`. This spec
defines the studio-native subset: what a local, keyless, DB-free engine needs to
reproduce the SAME assembly order and the SAME edge-case behavior for the formats this
studio actually supports (chara_card v2/v3, ST world info/RC lorebook, ST/Lumiverse
presets, ST/RC personas, ST/RC regex scripts), without the RC product surface.

## Behavior

### Inputs

`packages/assembly` assembles ONE turn of ONE session. The caller (Test Stage session
model, `specs/features/test-stage.md`) owns everything session-scoped across turns
(message history, persisted macro variables, the `LorebookEngine` instance so its
runtime state — sticky/cooldown/delay counters — survives across calls). `assemblePrompt`
itself is stateless except for the per-call `TokenCounter` cache (see token-counting.md).

```
AssemblyInput = {
  character: Character            // canonical, from packages/core
  persona?: Persona
  preset?: Preset                 // absent = synthesized default prompt set (see below)
  promptEnabledStates?: Record<identifier, boolean>  // chat-scoped overrides, applied over Preset.prompts[].enabled
  activeLorebooks: LorebookWithEntries[]
  lorebookEngine: LorebookEngine  // caller-owned instance (session-scoped runtime state)
  regexScripts?: RegexScript[]
  messages: TurnMessage[]         // full history, oldest first; role + content + optional metadata
  currentMessage: string
  selectedGreetingIndex?: number  // 0 = first_mes, 1+ = alternateGreetings[index-1]
  chatSummary?: string
  authorNote?: { content: string; position: 'after_scenario' | 'in_chat'; depth: number; frequency: number }
  contextLimit?: number
  maxResponseTokens?: number
  isImpersonate?: boolean
  impersonateBrief?: string
  tokenCounter: TokenCounter
}
```

Fields deliberately NOT carried over from VAUDEVILLE's `PromptAssemblyInput`
(`prompt-assembly.ts:239-428`), because they are RC product surfaces with no
Vaudeville Studios equivalent: `previewMode` (this package's "preview" IS its normal
mode — there is no DB to skip), `chatId`/`presetId`/`characterId`/`personaId` (callers
pass loaded entities, not IDs — no DB layer exists to resolve them), `stagecraftActiveProps`,
`tvConfig`/`tvSummaryWatermark` (TunnelVision), `characterMindsEnabled`, `sceneFrameEnabled`,
`vnConfig` (Visual Novel), `orisonPreferenceContext`. See "Non-goals."

### Assembly order

Twelve ordered stages, matching the shape of VAUDEVILLE's numbered pipeline
(`prompt-assembly.ts:972-3962`, its own stage comments) with the RC-only stages
(CarrotKernel/Stagecraft injection, Scene Frame, Visual Novel, Character Minds, Orison,
TunnelVision) removed. Each stage is independently testable; the public API additionally
exposes a `trace: AssemblyTrace` built incrementally across all twelve.

**1. Resolve preset prompts.** If `preset` is provided, resolve its `prompts[]` +
`promptOrder` (per `specs/formats/st-preset.md`) into two buckets by `injectionPosition`:
`relativePrompts` (position `0`, in `prompts[]`/`promptOrder` sequence order, filtered to
`enabled`) and `inChatPrompts: Map<depth, Prompt[]>` (position `1`, "in-chat" prompts,
grouped by `injectionDepth`). Two further buckets carry position `2` (`append`, glued
onto an existing message — see stage 8) and positions `3`/`4` (`bottomPrompts`/
`topPrompts`, pinned to the very end/start of the whole assembled prompt — see stage 10).
`promptEnabledStates` overrides `prompts[].enabled` per-identifier before bucketing
(matches `prompt-assembly.ts:987-1009`'s override-then-DB-fallback logic, minus the DB
fallback — this package has no DB, so an omitted override simply means "use the
preset's own `enabled`").

If `preset` is absent, synthesize the same minimal ST-canonical prompt set VAUDEVILLE
falls back to (`preset-loader.ts:144-200`, `synthesizeDefaultPresetPrompts`): seven
relative system prompts (`{{description}}`, `{{personality}}`, `{{scenario}}`,
`{{persona}}`, `{{lore}}`, `{{summary}}`, `{{mes_example}}`) plus one in-chat prompt at
depth 0 (`{{message_history}}`). This guarantees "no preset selected" still produces a
properly structured, position-aware prompt instead of one mashed system message.

**2. Build the character system-message content.** Only used when no preset marker
consumes character fields directly (i.e. the synthesized-default path, or a preset whose
`prompts[]` has no `charDescription`/`charPersonality`/`scenario` markers at all — see
stage 4's macro-driven path for the normal case). Concatenate, in order, into one string:
`"You are {name}."`, `Description:` block, `Personality:` block, `Scenario:` block,
`Example Dialogue:` block (each only if the source field is non-empty; macros inside each
field expand at this stage using the read-write macro context, matching
`prompt-assembly.ts:2726-2774`), closing with `"Stay in character and respond as they
would."`. This mirrors VAUDEVILLE's simple-mode fallback exactly; it is the ONE place a
raw string template survives in this engine — everywhere else, character fields reach
the prompt exclusively via `{{description}}`/`{{personality}}`/etc. macros so a preset
author controls placement.

**3. Resolve the greeting.** `selectedGreetingIndex` picks between `character.firstMessage`
(index 0) and `character.alternateGreetings[index-1]` (index >= 1); an out-of-range index
falls back to index 0. The resolved text becomes the `{{firstMessage}}`/greeting-message
macro source and IS the synthetic "assistant" message the pipeline inserts before real
chat history (unless a `{{message_history}}` marker exists, in which case it's woven into
the expansion — see stage 5). Matches `prompt-assembly.ts:2784-2794` plus
`getSelectedGreetingText` semantics (source: `apps/rc/src/lib/character/greetings.ts`,
not read in full for this pass — treat as "resolve index into `firstMessage`/
`alternateGreetings`, clamp out-of-range to 0").

**4. Match lorebook entries.** Call `lorebookEngine.process(triggerContext)`
(`specs/engine/lorebook-engine.md`) with a `TriggerContext` built from: the current
message + history (depth-indexed, most-recent-first, `depth: 0` = current message),
`character.description`/`personality`/`scenario`, `persona`'s rendered text as
`userPersona`, and the concatenated preset prompt content as `presetContent` (matches
`prompt-assembly.ts:1886-1909`). The returned `InjectionResult.byPosition` sorts entries
into the same seven buckets the lorebook engine defines
(`world`/`character`/`scene`/`before_example`/`after_example`/`depth`/`append`, plus
`append_bottom`/`prepend_top`). This package does NOT itself decide whether an entry
fires — that is entirely `packages/lore`'s job; this stage only calls it and holds the
result for stages 7-9's splicing.

**5. Build the conversation skeleton.** If `preset.prompts` contains a `{{message_history}}`
macro (in either a relative or in-chat prompt — `hasMessageHistoryMacro`,
`prompt-assembly.ts:3018-3078`), the skeleton is built with history INLINE at the marker
position, with in-chat prompts interleaved at their depths inside that expansion (not
flattened before it, which would silently drop every depth > 0 in-chat prompt — this was
a real VAUDEVILLE bug fixed and must not be reintroduced). Otherwise, the skeleton is:
`relativePrompts` (macro-templated, not yet expanded) + greeting (as a historical
assistant message) + chat history + current user message, with in-chat prompts spliced
in by depth counted from the end of the chat-history region specifically (not the whole
skeleton — a preset's leading system prompts must never be miscounted as "chat depth").
If `chatSummary` is set and no preset prompt already contains a `{{summary}}`/
`{{chatsummary}}` macro, inject a synthesized "Conversation summary so far" system
message immediately before the chat-history region (`prompt-assembly.ts:500-539,
3081-3106`).

**6. Expand macros — main pass.** Run `packages/macros`' processor over every
non-historical message's content (preset prompts, the character system-message string
from stage 2, the current user message) using a WRITABLE macro context (side-effect
macros like `{{setvar}}` fire). Historical messages (prior chat turns, the greeting) use
a READ-ONLY macro context so replaying assembly across turns never re-fires a stateful
macro that already ran when that message was first generated
(`prompt-assembly.ts:3193-3255`, the `_historical` flag). Off-band `$`-macros
(`{{pick$}}`, `{{ask_model$}}` — macro engine spec Part III.3) resolve in an async
PRE-pass before the main expansion, since their output can be referenced by other macros
in the same pass; `packages/assembly` accepts an optional `offbandExecutor` and degrades
those macros to cache-or-empty when none is supplied (no key configured — matches the
"works with zero AI key" invariant; `prompt-assembly.ts:3204-3224`). Phase-annotated
macros (`{{phase}}`/`{{defer}}`/{{after}}`, macro engine spec Part VIII) route through
the phased orchestrator instead of the single pass when present in any non-historical
block (`prompt-assembly.ts:3226-3255`).

**7. Splice structural (non-depth) lorebook entries.** Entries in the `world`/
`character`/`scene`/`before_example`/`after_example` buckets are inserted at anchor
points in the (now macro-expanded) skeleton, keyed off `_promptIdentifier` tags the
preset-prompt stage attaches to the framing prompts it emits for `charDescription`/
`charPersonality`/`scenario`/`dialogueExamples`/`worldInfoBefore`. This is a direct
reimplementation of `injectStructuralLorebookEntries`
(`apps/rc/src/lib/ai/lorebook-position-injection.ts`, full file, 202 lines — copy the
anchor-resolution algorithm verbatim, it has no RC entanglement): `world` entries insert
before the earliest anchor (or before the chat-history region if none), `character`
entries insert after the LAST character-anchor prompt (so multiple `charDescription`/
`charPersonality` markers all get the entries after the final one, not the first),
`scene` after the scenario anchor, `before_example`/`after_example` bracket the first
assistant-role message in the pre-history region (dialogue examples convention).

**8. Apply append placements.** Preset prompts with `injectionPosition: 2` (append) and
lorebook entries in the `append` bucket are GLUED onto the end of the depth-th-from-last
message of their target role (system role falls back to user) inside the chat-history
region, rather than becoming their own message — this is the Lumiverse
`user_append`/`assistant_append` semantic (`specs/formats/lumiverse-preset.md`).
Ascending-depth application order so two appends targeting the same message stack in the
order they were declared (`prompt-assembly.ts:3395-3431`, `appendAtDepth` from
`apps/rc/src/lib/ai/jobs/depth-guides.ts` — reimplement fresh; the algorithm is: find the
message at `depth` positions from the end of the region matching the target role
(falling back to `user` for a `system`-role append with no system message available at
that depth), append `\n\n{content}` to it; if no target exists at that depth, INSERT a
new message instead — this fallback insert path grows the chat-history region boundary
by one, which subsequent depth-counting stages must account for).

**9. Splice depth (in-chat) lorebook entries into history.** Depth counts ONLY
user/assistant messages within the chat-history region (never system messages), depth 0
= immediately before the current/last message. Entries whose `entry.depth` is `>=` the
total chat-message count in the region are injected once, immediately before the FIRST
chat message (there aren't enough messages to count that deep into, so they land at the
front of the region) rather than being silently dropped
(`prompt-assembly.ts:3474-3526` — this "early injection" fallback, including its
never-flushed-if-region-is-empty edge case, is a required behavior, not an optimization).

**10. Inject the author's note.** If present and its turn-frequency gate passes
(`(turnNumber - 1) % frequency === 0`, where `turnNumber` = count of user messages
including the current one — SillyTavern convention: frequency 1 fires every turn,
frequency 2 fires turns 1/3/5/…, `prompt-assembly.ts:944-957`), inject as a system
message either immediately after the leading system-message block (`after_scenario`) or
at a specific chat-history depth (`in_chat`, same depth-counting rules as stage 9,
including the >= total-count "goes at the front" fallback).

**11. Apply pin placements.** `bottomPrompts` (preset `injectionPosition: 3`) +
lorebook `append_bottom` entries push onto the very end of the ENTIRE assembled array
(after chat history, in-chat prompts, author's note — everything). `topPrompts` (preset
`injectionPosition: 4`) + lorebook `prepend_top` entries unshift onto the very front,
before even the relative prompts. These are unconditional positions, not "last/first in
sort order" — a preset author cannot achieve this by reordering `prompts[]`
(`prompt-assembly.ts:3617-3644`).

**12. Final macro pass + sanitization.** Run the macro expander ONE more time over every
message (content injected in stages 7-11 — lorebook text, appends, author's note — has
never been macro-expanded yet; historical messages still use the read-only context).
Then strip any remaining unresolved `{{...}}` syntax (unknown macros, malformed calls,
anything that slipped through) via a leaf-first iterative regex strip (innermost `{{}}`
first, since nested unresolved patterns like `{{if {{compare::x}}}}` need multiple
passes to fully clear — cap iterations at 20 as a runaway guard), then strip orphaned
unpaired `{{`/`}}`, collapse 3+ consecutive newlines to 2, trim, and drop any message that
becomes empty. Record every stripped pattern (deduplicated) on the trace for the "your
preset referenced an unknown macro" diagnostic. If `isImpersonate`, append a final system
message built from the preset's `impersonationPrompt` (or a documented ST-compatible
default) with `{{user}}`/`{{char}}` expanded, optionally appending `impersonateBrief` as
a non-verbatim hint (`prompt-assembly.ts:3942-3958`).

### Regex post-pass

Two `RegexPlacement` values apply inside prompt assembly itself (the other four —
`user_input`, `ai_output`, `display_only`, `reasoning` — are edges outside assembly's
scope, applied by the caller before/after this function runs; see
`specs/formats/regex-scripts.md` "Non-goals"):

- **`lorebook`**: applied to each lorebook entry's raw content, per-entry, BEFORE its
  `[Lorebook: {title}]` header is prepended and before it is placed into any bucket
  (stages 4-9 all consume already-regex'd entry text). This ordering means the header
  itself is never subject to a user's lorebook-placement rules.
- **`prompt_only`**: applied to the ENTIRE assembled message array, as the very last
  operation, after stage 12's sanitization — one rule application per message's content,
  using `depth` = the message's position from the end for `minDepth`/`maxDepth` gating.

VAUDEVILLE splits these two across two different code paths (`lorebook` server-side in
`prompt-assembly.ts:799-803`; `prompt_only` client-side in `useHandleSubmit.ts`, never
read in full for this spec pass) — this is a historical artifact of RC's client/server
split, not a design requirement. `packages/assembly` unifies both into this one function
since there is no client/server boundary in a local-first CLI/app; both placements are
applied inside `assemblePrompt` in the order above. `user_input`/`ai_output`/
`display_only`/`reasoning` remain the caller's responsibility (the Test Stage session
loop applies `user_input` before calling `assemblePrompt` and `ai_output`/`reasoning`
after the model responds).

### Context budgeting

When `contextLimit` is supplied, a budget manager (reimplementing
`apps/rc/src/lib/ai/context-budget.ts`, full file) reserves tokens for REQUIRED content
(character system-message content, the greeting, the current user message — always
included regardless of budget) and IMPORTANT content (persona text, lorebook-injected
text, any chat-summary block — included if space remains, never trimmed themselves), then
trims chat HISTORY from the oldest end to fit whatever budget remains, using
`tokenCounter.countMessages` (`specs/engine/token-counting.md`). A pre-trim safety
ceiling runs BEFORE the budget manager (bounding pathological payloads — hundreds of
messages on a small context window) at `max(60% of contextLimit, contextLimit - 2048)`
tokens of raw history, using a fast `length/4` heuristic rather than the real counter,
specifically so the real budget manager remains the binding constraint on any
realistically-sized history (`prompt-assembly.ts:2831-2864` and its own comment
explaining a prior regression where the pre-trim was the ONLY constraint and users got
~60% of their context window even when 85%+ was free). `messagesTrimmed` (count) and a
`BudgetReport` (`totalBudget`, `requiredTokens`, `importantTokens`, `flexibleTokens`,
`availableTokens`, `usagePercent`) are both surfaced on the assembly result for the Test
Stage's context-usage meter.

### Determinism

Two independent sources of controlled randomness exist in a full assembly: the lorebook
engine's probability rolls and inclusion-group weighted draws (`specs/engine/lorebook-engine.md`
"Determinism across regenerations"), and any macro that samples (`{{pick}}`,
`{{roll}}` — macro engine spec). Neither is made deterministic by `packages/assembly`
itself; determinism (if wanted, e.g. for a fixture-diffed test) is achieved by the CALLER
seeding both the `LorebookEngine`'s RNG and the macro processor's RNG explicitly.
`assemblePrompt` accepts no seed parameter of its own — it is a thin orchestrator over
already-seedable subsystems, not a new source of nondeterminism.

### The trace object

`packages/assembly` builds an `AssemblyTrace` incrementally across all twelve stages —
this is the "FULL TRACE object (every segment: source, tokens, why-included)" the brief
requires, and the data source for the Test Stage's rigging view. It generalizes
VAUDEVILLE's `PromptDebugData`/`PromptAssembler` (`apps/rc/src/lib/prompt-tracking/types.ts`,
full types file read; `apps/rc/src/lib/prompt-tracking/` assembler implementation NOT
read in this pass — only its consumed shape at `prompt-assembly.ts:3649-3697`) into a
package with zero DB/RC coupling: every `SourceIdentifier` in VAUDEVILLE carries a
database `entityId`; this spec's equivalent carries the canonical `Entity.id`
(ulid, per canonical-model.md) instead, and drops every RC-only entity type
(`stagecraft`) from the union. See the trace shape in the API sketch below.

## Public API sketch

```ts
// packages/assembly/src/index.ts

import type {
  Character, Persona, Preset, LorebookWithEntries, RegexScript, TokenCounter,
} from "@vaud/core";
import type { LorebookEngine, InjectionResult, ActivationTrace } from "@vaud/lore";

export interface TurnMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** Captured native-reasoning fields from a prior generation, for round-trip. */
  metadata?: { reasoning?: string; reasoningModel?: string; [k: string]: unknown };
}

export interface AssembledMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AuthorNoteConfig {
  content: string;
  position: "after_scenario" | "in_chat";
  depth: number;
  frequency: number; // 0 = never, 1 = every turn, N = every Nth turn
}

export interface AssemblyInput {
  character: Character;
  persona?: Persona;
  preset?: Preset;
  promptEnabledStates?: Record<string, boolean>;
  activeLorebooks: LorebookWithEntries[];
  lorebookEngine: LorebookEngine;
  regexScripts?: RegexScript[];
  messages: TurnMessage[];
  currentMessage: string;
  selectedGreetingIndex?: number;
  chatSummary?: string;
  authorNote?: AuthorNoteConfig;
  contextLimit?: number;
  maxResponseTokens?: number;
  isImpersonate?: boolean;
  impersonateBrief?: string;
  tokenCounter: TokenCounter;
  /** Executor for {{pick$}}/{{ask_model$}}-class off-band macros; omitted = degrade to cache/empty. */
  offbandExecutor?: (call: OffbandCall) => Promise<string>;
}

export interface OffbandCall {
  macro: string;
  args: string[];
}

export interface BudgetReport {
  totalBudget: number;
  requiredTokens: number;
  importantTokens: number;
  flexibleTokens: number;
  availableTokens: number;
  usagePercent: number;
}

export interface TraceSource {
  entityType: "preset" | "character" | "persona" | "lorebook" | "chat" | "system";
  entityId: string;
  entityName: string;
  field?: string;
  entryId?: string; // lorebook entry id, when entityType === "lorebook"
}

export interface TraceSegment {
  position: number;             // index into the final AssembledMessage[]
  role: AssembledMessage["role"];
  source: TraceSource;
  rawTokens: number;
  expandedTokens: number;
  content: string;
  /** Macros expanded within this segment, with position + resulting token delta. */
  macros: Array<{
    macro: string;
    charStart: number;
    charEnd: number;
    expandedPreview: string;
    tokens: number;
  }>;
}

export interface AssemblyTrace {
  segments: TraceSegment[];
  totalTokens: number;
  lorebook: {
    activation: ActivationTrace; // from packages/lore, embedded verbatim
    totalTokens: number;
  };
  strippedMacros: { totalCount: number; affectedMessages: number; examples: string[] };
  budget?: BudgetReport;
  messagesTrimmed: number;
  timingStages: Array<{ label: string; startMs: number; endMs: number }>;
}

export interface AssemblyResult {
  messages: AssembledMessage[];
  trace: AssemblyTrace;
  presetName?: string;
  samplerSettings?: Record<string, unknown>;
  /** Preset-level assistant prefill, for the caller to apply as a generation prefix. */
  assistantPrefill?: string;
}

export function assemblePrompt(input: AssemblyInput): Promise<AssemblyResult>;
```

## Edge cases & failure modes

1. **No preset provided.** Synthesize the default seven-relative-plus-one-in-chat prompt
   set (stage 1). Never falls back to the raw character-string template unless even the
   synthesized markers resolve to nothing meaningful — the synthesized set always exists.
2. **`{{message_history}}` marker appears in BOTH a relative prompt and an in-chat
   prompt.** Only the relative-prompt occurrence is treated as authoritative for
   placement; the in-chat occurrence's containing prompt is preserved once as a
   structural placeholder appended after the relative-prompt expansion, and excluded from
   the depth prompts woven into history (matches `prompt-assembly.ts:3059-3078`) — this
   prevents double injection of the marker's own prompt.
3. **Preset has NO `{{message_history}}` marker anywhere.** History is appended flat
   after the relative prompts and greeting; in-chat prompts are woven in by depth against
   that same flat region.
4. **Selected greeting index out of range** (e.g. `alternateGreetings.length === 2` but
   index `5` requested). Falls back to index 0 (`character.firstMessage`), not an error.
5. **Depth author's-note/lorebook-entry target depth exceeds the number of chat messages
   in the region.** Injects once at the FRONT of the chat-history region rather than being
   dropped — required behavior, not a should-not-happen case (stage 9, stage 10).
6. **Two depth entries target the SAME depth.** Both inject, in the order the lorebook
   engine returned them (which is itself priority-then-probability sorted per
   `specs/engine/lorebook-engine.md`), as a single multi-message block at that depth
   position.
7. **An append-placement target depth has no message of the target role** (e.g. an
   `assistant`-role append at a depth where only `user`/`system` messages exist in the
   region). Falls back: `system` role appends target `user` if no `system` message
   exists at that depth; if still no target, a NEW message is inserted rather than the
   append being dropped, and the chat-history region boundary grows by one to keep
   subsequent depth-counting stages correct (stage 8).
8. **A structural lorebook entry (`world`/`character`/`scene`/`before_example`/
   `after_example`) has no matching anchor prompt in the skeleton** (e.g. the preset has
   no `charDescription`-identifier prompt at all). Falls back to inserting immediately
   before the chat-history region (matches `injectStructuralLorebookEntries`'s
   `characterBlockStart` fallback chain, `lorebook-position-injection.ts:129-156`).
9. **Historical (already-sent) message contains a stateful macro** (`{{setvar}}`,
   `{{pick}}` with no cached prior roll). Must use the read-only macro context so
   re-assembling the SAME turn twice (e.g. a regenerate) never re-fires it or re-rolls it
   — this is load-bearing for the lorebook engine's own determinism contract
   (`specs/engine/lorebook-engine.md` "Determinism across regenerations") to hold across
   the FULL pipeline, not just inside the lorebook engine.
10. **`contextLimit` is smaller than the REQUIRED-content token total** (character
    prompt + greeting + current message alone exceed the budget). Required content is
    NEVER trimmed — the budget manager reports `usagePercent > 100%` / negative
    `availableTokens` rather than truncating required content; it is the caller's
    responsibility to surface this as a hard error or a warning (this package does not
    reject the request, matching VAUDEVILLE's "never silently drop required content"
    precedent).
11. **`{{message_history}}` marker present but the message array is empty (fresh chat,
    no turns yet).** History region is effectively zero-length; depth-based lorebook/
    author's-note entries with `depth >= 0` all fall into the "front of region" case
    (edge case 5) since `totalChatMessages === 0`.
12. **A regex `prompt_only` rule's pattern is malformed.** Skip that single rule, apply
    the rest, per `specs/formats/regex-scripts.md` edge case 10 — assembly must never
    throw because of a bad user-authored regex.
13. **`promptEnabledStates` references an identifier not present in `preset.prompts[]`.**
    No-op; there is nothing to toggle. Not an error.
14. **Unresolved macro syntax survives to the final sanitization pass nested inside
    another unresolved macro** (e.g. `{{if {{compare::a::b}}}}` where `compare` is
    unknown). The leaf-first iterative strip clears the innermost pattern first, exposing
    the outer one for the next iteration; capped at 20 iterations as a runaway guard
    (deliberately generous — real presets never nest this deep; the cap exists to
    guarantee termination on adversarial/malformed input, not to be hit in practice).
15. **`isImpersonate` with no `impersonationPrompt` on the preset.** Falls back to a
    documented ST-compatible default impersonation instruction string
    (`prompt-assembly.ts:3943-3944`), with `{{user}}`/`{{char}}` expanded.
16. **Persona is present but its rendered text is empty** (e.g. all fields blank). The
    `{{persona}}` macro/relative prompt expands to empty string and is dropped by
    sanitization (stage 12's "drop empty messages after cleanup" rule) rather than
    leaving a blank system message in the output.
17. **A lorebook entry's content itself contains `{{...}}` macro syntax.** Expanded in
    stage 12's final pass (entries reach the skeleton in stages 7/9, AFTER stage 6's main
    macro pass already ran) — lorebook content macros are NOT expanded twice; they are
    expanded exactly once, in the final pass, alongside author's-note and append content.

## Non-goals

- No DB, no chat/session persistence, no snapshot/Repertoire resolution, no per-user
  caching. The caller owns loading canonical entities and owns the `LorebookEngine`
  instance's lifetime across turns.
- No RC-specific features: TunnelVision (managed-lorebook suppression, smart-context
  watermark truncation), CarrotKernel/Stagecraft prop injection, Scene Frame, Visual
  Novel context/action instructions, Character Minds memory blocks, Orison preference
  memory, alt-art character variants. None of these have a Vaudeville Studios analog;
  they are out of scope entirely, not deferred.
- No provider-specific payload shaping (native tool-calling, reasoning-block
  round-tripping/signature handling, thinking-tag stripping policy, image attachment
  preparation). `packages/assembly` produces a provider-agnostic `AssembledMessage[]`;
  `packages/ai` (M2, `specs/engine/provider-adapters.md`) is responsible for translating
  that into a specific provider's request shape, including any reasoning/tool-call
  round-trip logic.
- No macro engine, lorebook engine, or regex substitution algorithm implementation of
  its own — this package calls `packages/macros`, `packages/lore`, and
  `packages/regexkit` and owns only the ORDER in which they run and how their outputs
  splice into the message array.
- No streaming/generation. This package's output is the request payload, not a response.
- No token-count EXACTNESS guarantee — all counts in the trace/budget come from the
  caller-supplied `TokenCounter`, whose exactness (approximate vs. provider-exact) is
  entirely `specs/engine/token-counting.md`'s concern.
- No UI rendering of the trace. `AssemblyTrace` is data; the Test Stage rigging view
  (`specs/features/test-stage.md`) owns its presentation.

## Test plan

Fixtures required, under `fixtures/prompt-assembly/`, each a JSON scenario file bundling
a canonical `Character`/`Persona`/`Preset`/`Lorebook[]` + a scripted turn sequence +
expected `AssembledMessage[]` (golden, exact-diffed, not fuzzy):

- `no-preset-synthesized.json` — preset absent; asserts the seven-relative/one-in-chat
  synthesized set and correct macro expansion order (edge case 1).
- `message-history-marker-relative.json`, `message-history-marker-in-chat.json`,
  `message-history-marker-both.json` — the three marker-location cases (edge case 2, 3).
- `message-history-absent.json` — flat-append fallback (edge case 3).
- `greeting-index-in-range.json`, `greeting-index-out-of-range.json` — greeting
  resolution (edge case 4).
- `depth-entry-exceeds-history-length.json` — a lorebook depth entry AND an author's
  note both targeting a depth beyond the current message count, on a chat with 0, 1, and
  3 messages (edge case 5, 11).
- `depth-entry-collision.json` — two lorebook entries targeting the identical depth
  (edge case 6).
- `append-placement-role-fallback.json` — a system-role append with no system message at
  the target depth, asserting the user-role fallback and the insert-when-absent path
  (edge case 7).
- `structural-lorebook-no-anchor.json` — a `character`-position lorebook entry against a
  preset with no `charDescription`/`charPersonality` prompt at all (edge case 8).
- `historical-setvar-no-refire.json` — a chat history containing a prior `{{setvar}}`
  call; assert assembling the SAME turn twice (simulated regenerate) does not re-fire it
  and produces byte-identical trace output for that segment (edge case 9).
- `context-budget-required-exceeds-limit.json` — `contextLimit` smaller than required
  content alone; assert required content survives intact and `BudgetReport.usagePercent`
  exceeds 100 rather than truncating (edge case 10).
- `context-budget-trims-history.json` — a long history against a moderate
  `contextLimit`; assert oldest-first trimming and correct `messagesTrimmed` count.
- `regex-lorebook-placement.json` — a `lorebook`-placement regex rule that must apply to
  entry content BEFORE the `[Lorebook: title]` header is prepended.
- `regex-prompt-only-placement.json` — a `prompt_only` rule applied to the final
  assembled array, asserting it runs after sanitization (stage 12), with a `minDepth`/
  `maxDepth` gate.
- `regex-malformed-pattern-skipped.json` — one valid + one malformed `prompt_only` rule;
  assert the valid rule still applies (edge case 12).
- `unresolved-macro-nested-strip.json` — a preset prompt with an unknown macro nested
  inside a known block-form macro; assert the leaf-first strip clears both layers (edge
  case 14).
- `impersonate-default-prompt.json`, `impersonate-preset-prompt.json` — impersonation
  instruction fallback vs. preset-provided (edge case 15).
- `empty-persona-dropped.json` — persona with all-blank fields; `{{persona}}` segment
  must not survive sanitization as a blank message (edge case 16).
- `lorebook-content-macro-expanded-once.json` — an entry whose content contains
  `{{char}}`; assert it expands exactly once, in the final pass, not twice (edge case 17).
- `append-vs-depth-vs-pin-ordering.json` — one entry per lorebook injection position in a
  single scenario, asserting the full stage 4-11 ordering produces the documented final
  arrangement end to end (integration fixture, not just a single-stage unit).
- `trace-segment-attribution.json` — asserts every segment in `AssemblyTrace.segments`
  correctly attributes its `source` (preset prompt vs. character field vs. lorebook entry
  vs. persona) and that `expandedTokens` reflects post-macro-expansion content.

Round-Trip Law applicability: none directly — this is a runtime engine, not a codec.
Every fixture's expected `AssembledMessage[]` and relevant `AssemblyTrace` fields are
themselves golden files checked into the fixture corpus, exact-diffed.

Property/unit tests beyond fixtures:

- Depth-counting invariant: for any scenario, the set of indices the depth-splicing
  stage (9) computes as "chat message positions" must exactly equal the set of
  user/assistant-role message indices inside `[chatHistoryStartIdx, chatHistoryEndIdx)`,
  never touching indices outside that region regardless of how many system messages
  (preset framing, structural lorebook entries) surround it.
- Sanitization idempotence: running the final macro pass + strip twice on an
  already-sanitized message array is a no-op (no further characters removed, no
  exception).
- Budget monotonicity: increasing `contextLimit` while holding all other inputs fixed
  never DECREASES the number of history messages retained.
- Trace token-sum sanity: `AssemblyTrace.totalTokens` equals
  `tokenCounter.countMessages(result.messages).count` (the trace's own accounting must
  agree with counting the final output directly, not drift from stage-by-stage
  approximation error).

## Sources consulted

- `<RoleCall>\apps\rc\src\lib\ai\prompt-assembly.ts` (full file
  read across four passes, 3991 lines): header/history note :1-15; `PromptAssemblyInput`
  :239-428; stage markers via `markStage(...)` calls :972, :1188, :1410, :1781, :2147,
  :2709, :3147, :3962; author's-note frequency gate :937-957; preset resolution +
  promptEnabledStates override :987-1009, :1108-1119; character system-message build
  :2726-2774; greeting resolution :2784-2794; lorebook `TriggerContext` build :1886-1909;
  lorebook regex-placement application :795-803; `{{message_history}}` marker detection
  and dual-location handling :3018-3106, :3257-3330; sandwich-top prepend :3332-3349;
  structural lorebook injection call site :3351-3383; append-placement application
  :3385-3432; depth-entry splicing and its early-injection fallback :3434-3533;
  author's-note injection (both position modes) :3536-3615; pin placements :3617-3644;
  `promptDebug`/`PromptAssembler` construction (trace source) :3646-3697; final macro
  pass + iterative unresolved-macro strip :3699-3796; impersonate-mode injection
  :3933-3958; context-budget wiring :2928-2989, including the pre-trim safety-ceiling
  comment/rationale :2831-2864; return shape :3964-3977.
- `<RoleCall>\apps\rc\src\lib\ai\preset-loader.ts`: `SamplerSettings`,
  `RawPresetPrompt`, `ProcessedPrompts` interfaces :33-124; `synthesizeDefaultPresetPrompts`
  :144-200 (full function + its doc comment explaining the synthesized-marker rationale).
- `<RoleCall>\apps\rc\src\lib\ai\lorebook-position-injection.ts`
  (full file, 202 lines): `injectStructuralLorebookEntries` anchor-resolution algorithm,
  `StructuralLorebookPosition` union, `characterBlockStart` fallback chain :129-156.
- `<RoleCall>\apps\rc\src\lib\ai\context-budget.ts` (lines
  1-40 read: `BudgetReport`, `ContextBudgetManager` interfaces; `trimHistoryToFit`/
  `reserveRequired`/`reserveImportant` signatures only — internal trimming algorithm body
  not read in this pass, treated as reference-only per the "reimplement, don't port"
  instruction).
- `<RoleCall>\apps\rc\src\lib\regex\apply-regex.ts` (lines 1-60
  read): `RegexPlacement` union and its documenting comment (six placements, which three
  are "pipeline edges" vs. "storage-layer" placements), `RegexRule`/`RegexScript` shapes.
- `<RoleCall>\apps\rc\src\lib\prompt-tracking\types.ts` (full
  file read): `SourceIdentifier`/`PromptSource` :16-64; `LorebookTriggerInfo` :69-90;
  `PromptDebugData` :704-776; `PromptSectionDebug` (attribution/badges) :560-590;
  `MacroExpansionDebug` :605-634; `SourceNodeDebug` :639-667; `LorebookEntryDebug`
  :670-699 — this is the reference shape `AssemblyTrace` generalizes off DB IDs onto
  canonical entity IDs.
- `docs\the master plan (private planning notes)`,
  `docs\02-ARCHITECTURE.md` (`packages/assembly` description: "Prompt assembly for the
  Test Stage: preset + card + persona + lorebook + history -> messages payload, with a
  full trace object"), `docs\the extraction map (private planning notes)` (:57-61, "reference only —
  reimplement, do not port" instruction and the specific RC-entanglement list),
  `docs\the production bible (private planning notes)` (brief row for this file, line 62).
- `specs\formats\canonical-model.md`,
  `specs\formats\escrow-and-roundtrip.md`, `specs\formats\st-preset.md` (canonical
  `Preset.prompts[]` field shape: `identifier`, `injectionPosition` 0-4 enum,
  `injectionDepth`, `injectionOrder`, `marker`, `isDefault`), `specs\formats\regex-scripts.md`
  (canonical `RegexRule`/`RegexScript` shape and the six-placement substitution
  algorithm), `specs\engine\lorebook-engine.md` (`LorebookEngine`/`InjectionResult`/
  `ActivationTrace` public API this package consumes verbatim), `specs\engine\token-counting.md`
  (`TokenCounter` interface used throughout budgeting and the trace), `templates\SPEC-TEMPLATE.md`.

OPEN QUESTION: VAUDEVILLE's `getSelectedGreetingText` (`apps/rc/src/lib/character/greetings.ts`)
was not read in full for this spec pass — only its call-site usage and stage-3 description
above (index selection, clamp-to-0 fallback) were confirmed from `prompt-assembly.ts`
call sites. Confirm the exact out-of-range/negative-index/non-numeric-index handling
against that file before the M5 ticket locks the contract.

OPEN QUESTION: `apps/rc/src/lib/ai/jobs/depth-guides.ts`'s `appendAtDepth` implementation
was not read in full — this spec's description of the append-placement fallback (edge
case 7) is inferred from `prompt-assembly.ts:3395-3432`'s call-site comments and observed
region-growth bookkeeping, not the function body itself. Confirm the exact
role-fallback/insert-vs-skip logic against that file before implementation.

OPEN QUESTION: the exact default impersonation-prompt string (edge case 15) is quoted at
`prompt-assembly.ts:3943-3944` and is stated there to match SillyTavern's own
`public/scripts/openai.js` default; this spec treats VAUDEVILLE's copy as ground truth
but has not independently verified it against a current SillyTavern source checkout. Low
risk (cosmetic string only) but worth a diff before shipping the fixture.

OPEN QUESTION: `specs/engine/macro-engine.md` does not exist yet as of this writing. This
spec's stage 6 and stage 12 descriptions assume a `packages/macros` public surface
shaped like `docs/02-ARCHITECTURE.md`'s one-line description (tokenizer/parser +
evaluator subset) and VAUDEVILLE's `processMacros`/`createDefaultContext`/
`initializeMacros`/`processPhasedBlocks`/`containsPhaseMacros`/`resolveOffbandAsks`/
`containsOffbandMacros` export names (`prompt-assembly.ts:49-61` import list) as the
shape to reconcile against once that spec is written. When `macro-engine.md` is authored,
this spec's macro-related stage descriptions should be reviewed for consistency and this
OPEN QUESTION removed.
