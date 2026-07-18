# Spec: The Test Stage

**Package:** `packages/assembly` (session/trace types, screen-test orchestration) +
`apps/cli` (the `vaud test-stage` command, terminal rendering of the trace) ·
**Milestone:** M5 · **Status:** draft
**Depends on:** `specs/engine/lorebook-engine.md`, `specs/engine/macro-engine.md`,
`specs/engine/token-counting.md`, `specs/formats/regex-scripts.md`,
`specs/engine/productions-and-history.md`, `docs/decisions/ADR-006-ai-and-agent.md`
(model-role mapping). Forward-depends on two specs not yet written in this suite -
`specs/engine/prompt-assembly.md` and `specs/engine/provider-adapters.md` - both
listed in `specs/README.md` under `engine/` but absent from the repo at the time
of writing (see OPEN QUESTION 1). This spec defines the Test Stage's own session,
trace-aggregation, and screen-test contract; it treats `prompt-assembly.md`'s and
`provider-adapters.md`'s exact call signatures as unresolved and flags every place
that dependency is load-bearing.
**VAUDEVILLE reference:** `apps/rc/src/lib/ai/prompt-assembly.ts` (header/imports
only, :1-60 - confirms the shape of inputs a real assembly call needs: character,
persona, presets, lorebook engine, chat history, model name/context limit;
consulted for reference only, not ported), `apps/rc/src/lib/prompt-tracking/types.ts`
(full file - informs the *shape* of an honest assembly trace; not ported field-
for-field, see Non-goals)

## Purpose

The Test Stage lets a creator chat with a character live, using the exact
assembly pipeline (preset + card + persona + lorebook + history) the shipped
roleplay surface would use, entirely local except for the one network call to
the creator's own configured AI provider. It has three jobs: run a plain test
chat (`TS-1`, "The Audition"), expose the assembly/lorebook/macro/regex
machinery that produced any given turn on demand (`TS-2`, "The Rigging View"),
and run the same scene against two models, two presets, or two character
drafts side by side so the creator can pick a winner (`TS-3`, "The Screen
Test"). It also keeps a running, honest cost line, because every card/preset
change a creator makes here costs real provider tokens to test. It is a
feature spec: it does not itself implement assembly, the lorebook engine, the
macro engine, or provider calls - it defines the **session** that wraps those
components across multiple turns, the **trace aggregation** that turns their
individual outputs into the rigging view, and the **screen-test** orchestration
that runs two takes without cross-contaminating engine state. Following the
principle that every feature must exist in the CLI before it exists in the
app, the primary interface here is `vaud test-stage`, a
terminal chat loop; the Studio app (M6) is expected to render the identical
`TestSession`/`RiggingTrace`/`ScreenTestResult` objects with no new engine
capability, per `docs/02-ARCHITECTURE.md`'s "every studio action maps to an
engine call that the CLI can also express."

## Behavior

### Why this feature requires AI, unlike the Converter

The "v0.1 | The Converter: works with zero AI key" milestone and
ADR-006's "AI is optional" apply to convert/inspect/validate/Doctor-deterministic
work, not to the Test Stage: talking to a character requires calling a
configured provider. Two sub-modes exist so the feature degrades honestly
rather than hard-failing with no key configured:

1. **Live turn** (send a message, get a reply) - requires a configured
   provider/model (`specs/engine/key-vault.md`). Refuses with a named error
   ("no model configured for role: test-stage - run `vaud config model
   test-stage <provider/model>`" or equivalent; exact CLI error copy is
   `cli-ux.md`'s concern) if none is set.
2. **Dry-run assembly preview** (build the prompt, show the rigging trace,
   do NOT call a provider) - requires no key. This is the same assembly call
   a live turn makes, just without the inference step, and exists so a
   creator can inspect what a turn *would* send before spending a token.
   `vaud test-stage --dry-run` (exact flag name is `cli-ux.md`'s concern,
   noted here only to establish the capability exists).

### Model roles

Per ADR-006 point 4 ("Model roles are user-mappable... test-stage inference...
can each point at a different configured model"), the Test Stage reads its
default model from the `test-stage` role in the key vault's model-role map
(`specs/engine/key-vault.md`), not a hardcoded default. A session may override
this per-session (see "Swap model mid-session," below) without changing the
persisted role mapping.

### The session model

A `TestSession` is the unit of state that survives across turns within one
`vaud test-stage` invocation (or one Studio test-chat tab, M6). It is
deliberately NOT a canonical entity type (`specs/formats/canonical-model.md`'s
"Content types (v1 surface)" lists `Character, Lorebook, Preset, Persona,
RegexScript, Production` only - no `Session`/`Chat` type). A session holds:

1. **Attachment** - the character being tested (by production `Entity.id`,
   or a bare file path in bare-file mode per
   `specs/engine/productions-and-history.md`'s "Bare-file operation"), an
   optional persona, zero or more active lorebooks, and a preset.
2. **One `LorebookEngine` instance** (`specs/engine/lorebook-engine.md`),
   constructed once at session start and reused for the session's lifetime -
   required because the engine owns sticky/cooldown/delay/frequency runtime
   state internally ("callers create one `LorebookEngine` per chat/test
   session and call `process()` once per generation,"
   `specs/engine/lorebook-engine.md` Behavior > Inputs).
3. **Chat history** - an ordered list of `SessionTurn` (see API sketch),
   each carrying its own frozen `RiggingTrace` snapshot from the moment it
   was generated (see "Historical trace immutability," edge case 6).
4. **Variables state** (`VariablesState` from `specs/engine/lorebook-engine.md`)
   for lorebook side effects, carried across turns the same way the
   `LorebookEngine` instance is.
5. **Active model/preset configuration** for the NEXT turn (mutable via swap,
   below); already-generated turns record whatever configuration actually
   produced them.
6. **A running cost accumulator** (see "The cost line," below).
7. **A `messageCount`** - the same monotonic counter `TriggerContext.messageCount`
   consumes; the session owns advancing it once per completed turn and holds
   it steady across swipe/regenerate calls, per the lorebook engine's
   determinism contract.

### The turn lifecycle

One live turn (`sendMessage`):

1. Build a `TriggerContext` from the session's current chat history, the
   attached character/persona/preset content, and `messageCount` (unchanged
   from the prior turn if this is a swipe/regenerate at the same count).
2. Call `LorebookEngine.process()` to get an `InjectionResult` (lorebook
   entries to inject + their `ActivationTrace`,
   `specs/engine/lorebook-engine.md`).
3. Call the (not-yet-specified) `packages/assembly` assembly function with
   the character, persona, preset, the `InjectionResult`, and chat history,
   to produce a provider-ready messages payload plus an assembly-level trace
   (OPEN QUESTION 1 - this spec cannot fix the exact call signature until
   `specs/engine/prompt-assembly.md` exists; it fixes the INPUTS this
   session must supply, drawn from what `prompt-assembly.ts`'s own imports
   confirm are required: character, persona, preset prompts, lorebook
   injection result, chat messages, model name, context limit).
4. Macro expansion happens inside step 3 (per `specs/engine/macro-engine.md`:
   "The engine only runs when something is actually being assembled or
   rendered... the Test Stage" is one of its three named callers) and
   contributes a macro-expansion trace to the same assembly trace object.
5. If this is a dry-run preview, stop here and return the trace without
   calling a provider.
6. Otherwise, call the provider adapter (`specs/engine/provider-adapters.md`,
   not yet written - OPEN QUESTION 2: exact `ChatRequest`/`ChatResponse`
   shape) with the assembled messages and the session's active model
   config, streaming the reply into the chat pane.
7. Run the `ai_output` and `display_only` regex placements
   (`specs/formats/regex-scripts.md`) over the raw reply before it is shown
   or stored, recording each substitution for the trace.
8. Append a new `SessionTurn` (user message + assistant reply) to history,
   store the frozen trace and the model/preset provenance that produced this
   turn, advance `messageCount`, and update the cost accumulator from
   provider-reported usage (see "The cost line").
9. Run `LorebookEntry.sideEffects` that the `InjectionResult` reported,
   updating the session's `VariablesState`.

Swipe/regenerate re-runs steps 1-8 at the SAME `messageCount` (does not call
`LorebookEngine.advanceMessage()` first), relying on the engine's own
snapshot/restore contract (`specs/engine/lorebook-engine.md`, "Determinism
across regenerations") so a discarded swipe's sticky/cooldown side effects
never leak into the kept generation.

### The rigging view (TS-2)

The rigging view is a read-only aggregation of traces already produced by
steps 2-4 and 7 of the turn lifecycle above, assembled into one
`RiggingTrace` object per turn:

- `lorebook: ActivationTrace` - verbatim from `InjectionResult.trace`
  (`specs/engine/lorebook-engine.md`'s `ActivationTrace`/`ActivationTraceEntry`
  shape, including the `stage` taxonomy that powers "why didn't X fire?").
- `macro: MacroTrace` - the macro engine's expansion/error list for this
  turn's assembled text (`specs/engine/macro-engine.md`'s evaluate-stage
  output; exact type name OPEN QUESTION, that spec does not yet publish a
  finalized trace type name in the excerpt read for this spec).
- `regex: RegexTrace` - one entry per substitution actually applied this
  turn, `{ scriptId, ruleId, placement, matchCount }`
  (`specs/formats/regex-scripts.md` substitution semantics).
- `tokens: { total: TokenCountResult; bySource: Array<{ source: string;
  tokens: TokenCountResult }> }` - using `specs/engine/token-counting.md`'s
  `TokenCounter`/`TokenCountResult` (never a bare number; always carries
  `exact`/`basis` so the rigging view can print `~1,502 tok` honestly when
  not provider-exact, matching the wireframe's `1,502 tok` line - the
  wireframe mock does not show the `~` prefix, but this spec requires it
  whenever `exact: false`, since honest-count is a hard requirement of
  `token-counting.md`, not a rendering nicety).
- `assembly: AssemblyTrace` - whatever `specs/engine/prompt-assembly.md`
  eventually defines as its "FULL TRACE object (every segment: source,
  tokens, why-included)". OPEN QUESTION 1 again: this spec
  treats `assembly` as an opaque pass-through field until that spec exists.

Rendering is UI-agnostic: `RiggingTrace` is plain data, no terminal-escape
codes or DOM baked in. `apps/cli` renders it as the monospace block shown in
wireframe `TS-2` (`wireframes/magic/test-stage.html:75-82`: fired entries,
scan/fire counts, macro expand count, token total with source breakdown,
regex substitution count). A future Studio inspector rail (M6) renders the
same object as a side panel. The rigging view is a toggle from the plain
chat (`TS-1`), never the forced default, per the wireframe's own recorded
objection (`wireframes/magic/test-stage.html:89`, "Against: Intimidating if
it's the default; should be a toggle from TS-1").

**"Why didn't X fire?"** - a lookup, not a re-run: given an entry title or id
and a turn's `RiggingTrace.lorebook.entries`, find the matching
`ActivationTraceEntry` and print its `stage` (one of the 15 stage values in
`specs/engine/lorebook-engine.md`'s `ActivationTraceEntry.stage` union) plus
whatever fields explain that stage (e.g. `stage: 'excluded_cooldown'` prints
remaining cooldown turns if the trace carries it; `stage:
'no_trigger_match'` prints the entry's configured triggers against the
turn's scan text). If the entry was not in the candidate pool at all
(disabled, wrong book not attached to this session), report that distinctly
from "evaluated but did not match."

### Swap model mid-session

`session.setModel(modelConfig)` changes which provider/model the NEXT live
turn uses. It does not retroactively re-run or re-tag any already-generated
turn. Every `SessionTurn`'s assistant message carries a `producedBy: {
provider: string; model: string }` provenance field fixed at generation
time, so a transcript that mixed models mid-conversation (wireframe `TS-1`'s
`SWAP MODEL` button, distinct from the separate `RESTART` button - the
wireframe deliberately offers swap-without-restart) is honestly represented
rather than silently attributed to whatever model is active when the
transcript is later viewed. `session.setPreset(presetId)` is the same
pattern for presets: affects assembly for the next turn only, history
untouched. Swapping either does not reset `messageCount`, the `LorebookEngine`
instance, or `VariablesState` - those are conversation-scoped, not
model/preset-scoped.

If the new model's context limit is smaller than what the next assembly
would need, the assembly step (per its own budgeting - OPEN QUESTION 1 again,
budgeting strategy is `prompt-assembly.md`'s to define) surfaces a warning in
that turn's trace rather than silently truncating without record. This spec
does not define the trimming/eviction strategy itself; see OPEN QUESTION 3.

### The screen test (TS-3)

A `ScreenTest` runs the identical next turn twice, varying exactly one axis,
and returns both takes without committing either to session history until
the creator picks one:

```
axis: "model" | "preset" | "draft"
```

(matching the wireframe's `SWAP AXIS: MODELS` control, `wireframes/magic/
test-stage.html:104`, which implies a single-select axis, not a general
N-way matrix). Two `ScreenTestBranch` configs are supplied (each is a full
model config, preset id, or character reference depending on axis); the
scene state (chat history up to this point) is identical for both.

**Isolation requirement.** Both branches must run against independently
snapshotted lorebook-engine runtime state so that side effects (sticky
windows armed, cooldowns started, per-trigger frequency timestamps) from
Take A do not leak into Take B's evaluation, and vice versa. This is the
same problem the lorebook engine already solves for same-`messageCount`
swipes (`specs/engine/lorebook-engine.md`, "Determinism across
regenerations" - that spec explicitly names this file as the consumer of
its snapshot/restore contract: "directly observable by callers running
multiple candidate generations per turn (the Test Stage's A/B screen test,
`specs/features/test-stage.md`)"). Concretely: `runScreenTest` calls
`LorebookEngine.process()` twice at the SAME `messageCount`, relying on the
engine's own per-`messageCount` snapshot/restore, exactly as a swipe would -
a screen test is implemented as two speculative generations, not a special
engine mode.

**Execution.** Both branches' provider calls run concurrently (not
sequentially) so a screen test does not double the wall-clock wait on top of
doubling the token spend. Each branch's success/failure is independent - one
take can error (rate limit, network) while the other completes; the UI shows
whatever came back for each, not an all-or-nothing failure (edge case 7).

**Picking a winner.** The creator picks Take A or Take B (wireframe: `pick A`
/ `pick B` chips). The picked take's turn is appended to session history
exactly as a normal live turn would be (with its own `producedBy` and frozen
`RiggingTrace`). The unpicked take is discarded by default - not written to
history, not billed further - unless the creator explicitly requests both be
saved to the transcript for later comparison (OPEN QUESTION 4: no ground
truth defines a "save both takes" transcript shape; noting the capability
gap rather than inventing one).

**Draft axis.** `axis: "draft"` compares two versions of the same character
rather than two models/presets. Because canonical entities are not
inherently versioned outside of production history snapshots
(`specs/engine/productions-and-history.md`), a draft-axis screen test's two
branches are each either (a) two distinct bare character files, or (b) the
same entity id read at two different history snapshot ids via
`readFileAtSnapshot` (`specs/engine/productions-and-history.md`'s API
sketch). OPEN QUESTION 5: this spec does not resolve which of (a) or (b) - or
both - the CLI/Studio must support; wireframe `TS-3`'s "draft 3 vs draft 4"
label is consistent with either interpretation ("draft 3" could name a
snapshot or a file).

### The cost line

Every turn (live or screen-test branch) that reaches a provider call
accumulates cost into the session's running total, shown as the wireframe's
implied cost line (named explicitly in the `TS-3` "Against" note: "Doubles
token spend per turn; needs a visible cost line," `wireframes/magic/
test-stage.html:120`). Cost accounting rules:

1. **Prefer provider-reported usage.** If the provider adapter returns
   `usage.input_tokens`/`usage.output_tokens` (or equivalent), those numbers
   are the tokens used for cost math - never the local `TokenCounter`
   estimate - matching the precedent `specs/engine/token-counting.md`
   documents from VAUDEVILLE (`inference-engine.ts:1759-1760`:
   `tokensFromUsage.prompt || countMessagesTokens(...)`, "prefer the
   provider's reported token usage when it exists").
2. **Fall back to the local estimate, marked inexact,** only when the
   provider did not report usage (some OpenAI-compatible/local endpoints
   omit it). The cost line must then show the estimate with the same
   `~`-prefix honesty convention as `token-counting.md`'s `estimateLabel`.
3. **Price-per-token data source is an OPEN QUESTION (6).** No spec in this
   suite (including `provider-adapters.md`, not yet written) currently
   defines where per-model $/token pricing comes from - a bundled static
   table shipped with releases, a user-editable table in
   `~/.vaud/config.json`, or a live-fetched catalog. This spec requires only
   that the Test Stage NEVER fabricates a dollar figure for a model whose
   price is unknown: it shows token counts alone plus an explicit
   "pricing unknown for `<model>`" note, and shows "local model, no cost"
   rather than `$0.00` for a recognized zero-cost local/Ollama model (edge
   case 9) - `$0.00` would misleadingly claim a known-zero price where the
   truth is "not applicable."
4. **Screen tests must show the projected doubled cost BEFORE running,**
   using local estimates (a screen test has not happened yet, so there is no
   provider usage to prefer) - this is the wireframe's own stated
   requirement, not an inference.
5. The accumulator is per-session, resets when a new `TestSession` starts,
   and is never persisted as billing/telemetry data anywhere (`docs/02-
   ARCHITECTURE.md`'s "No telemetry of any kind" invariant applies; the cost
   line is local-only, ephemeral UI state).

## Public API sketch

```ts
// packages/assembly - session, trace aggregation, screen-test orchestration.
// (Package placement per OPEN QUESTION 1's note: this could equally land in a
// new packages/session; sketched under packages/assembly here because
// 02-ARCHITECTURE.md already assigns that package "Prompt assembly for the
// Test Stage" and a session is the thing that repeatedly calls it.)

import type { Entity, ContentType } from "@vaud/core";
import type { TokenCounter, TokenCountResult } from "@vaud/core";
import type {
  LorebookEngine,
  LorebookWithEntries,
  InjectionResult,
  ActivationTrace,
  VariablesState,
} from "@vaud/lore";

export interface ModelConfig {
  provider: string;   // "anthropic" | "openrouter" | "openai" | "gemini" | "openai-compatible"
  model: string;
  contextLimit?: number; // explicit override; else provider-adapter default (see token-counting.md's contextLimitIsDefault precedent)
}

export interface SessionAttachment {
  characterRef: { entityId: string } | { filePath: string }; // bare-file per productions-and-history.md
  personaRef?: { entityId: string } | { filePath: string };
  lorebookRefs: Array<{ entityId: string } | { filePath: string }>;
  presetRef?: { entityId: string } | { filePath: string };
}

export interface SessionTurn {
  index: number;               // position in history, 0-based
  messageCount: number;        // the TriggerContext.messageCount this turn was generated at
  userMessage: string;
  assistantMessage: string;
  producedBy: { provider: string; model: string; presetId?: string };
  trace: RiggingTrace;         // frozen at generation time, see edge case 6
  costForTurn: TurnCost;
  timestamp: string;           // ISO
}

export interface RiggingTrace {
  lorebook: ActivationTrace;              // from @vaud/lore, verbatim
  macro: unknown;                          // OPEN QUESTION: macro-engine.md trace type, not finalized in the excerpt this spec read
  regex: Array<{ scriptId: string; ruleId: string; placement: string; matchCount: number }>;
  tokens: {
    total: TokenCountResult;
    bySource: Array<{ source: string; tokens: TokenCountResult }>;
  };
  assembly: unknown;                       // OPEN QUESTION 1: opaque until prompt-assembly.md exists
  warnings: string[];                      // e.g. context-limit-exceeded-on-swap (see "Swap model mid-session")
}

export interface TurnCost {
  inputTokens: TokenCountResult;
  outputTokens: TokenCountResult;
  usdEstimate: number | null;              // null when pricing is unknown (OPEN QUESTION 6) - never a fabricated 0
  pricingBasis: "provider-usage" | "local-estimate" | "unknown";
}

export class TestSession {
  constructor(attachment: SessionAttachment, options: {
    tokenCounter: TokenCounter;
    initialModel: ModelConfig; // resolved from the "test-stage" model role by the caller (key-vault.md), or explicit override
  });

  readonly history: readonly SessionTurn[];
  readonly messageCount: number;
  readonly costSoFar: { inputTokens: number; outputTokens: number; usdEstimate: number | null };

  /** Runs one live turn: assemble, infer, regex-post-pass, append to history. */
  sendMessage(userMessage: string): Promise<SessionTurn>;

  /** Re-runs the last turn at the same messageCount (relies on LorebookEngine's
   *  own snapshot/restore determinism, per specs/engine/lorebook-engine.md). */
  regenerate(): Promise<SessionTurn>;

  /** Assembles a turn's prompt without calling a provider. No key required. */
  previewAssembly(userMessage: string): Promise<{ trace: RiggingTrace }>;

  /** Changes the model used for the NEXT turn only. Does not retag history. */
  setModel(model: ModelConfig): void;

  /** Changes the preset used for the NEXT turn only. Does not retag history. */
  setPreset(presetRef: { entityId: string } | { filePath: string }): void;

  /** Looks up a lorebook entry's fate in a given turn's trace without re-running anything. */
  explainEntry(turnIndex: number, entryIdOrTitle: string): ActivationTrace["entries"][number] | null;
}

// Screen test - a pair of speculative generations off the same session state.

export type ScreenTestAxis = "model" | "preset" | "draft";

export interface ScreenTestBranch {
  label: string; // e.g. "draft 3", "claude-sonnet"
  model?: ModelConfig;                                            // axis: "model"
  presetRef?: { entityId: string } | { filePath: string };        // axis: "preset"
  characterRef?: { entityId: string; snapshotId?: string } | { filePath: string }; // axis: "draft"
}

export interface ScreenTestTakeResult {
  branch: ScreenTestBranch;
  status: "ok" | "error";
  turn?: SessionTurn;   // present when status === "ok"
  error?: string;       // present when status === "error"
}

export interface ScreenTestResult {
  axis: ScreenTestAxis;
  userMessage: string;
  takeA: ScreenTestTakeResult;
  takeB: ScreenTestTakeResult;
  projectedCost: { estimatedTotalUsd: number | null; note?: string }; // shown BEFORE run, per "The cost line" rule 4
}

/** Runs both branches concurrently against isolated LorebookEngine snapshots
 *  of the SAME session state (same messageCount). Neither branch is appended
 *  to session.history automatically. */
export function runScreenTest(
  session: TestSession,
  userMessage: string,
  axis: ScreenTestAxis,
  branchA: ScreenTestBranch,
  branchB: ScreenTestBranch
): Promise<ScreenTestResult>;

/** Commits the chosen take to session history, exactly as sendMessage would. */
export function pickScreenTestWinner(
  session: TestSession,
  result: ScreenTestResult,
  winner: "A" | "B"
): SessionTurn;
```

## Edge cases & failure modes

1. **No provider/model configured for the `test-stage` role and no explicit
   override given.** `sendMessage`/`regenerate` reject with a named,
   non-throwing-into-the-void error identifying which role is unconfigured;
   `previewAssembly` still succeeds (no key required, see "Why this feature
   requires AI, unlike the Converter").
2. **Model swap mid-session to a model with a smaller context window than
   the next assembly needs.** Surface a warning in that turn's
   `RiggingTrace.warnings`, do not silently truncate without record. Exact
   trimming strategy is OPEN QUESTION 3 (this spec does not invent an
   eviction policy that belongs to `prompt-assembly.md`).
3. **Draft-axis screen test needs two versions of one character.** Whether
   that means two file paths or two history-snapshot reads of one entity is
   OPEN QUESTION 5; both `characterRef` shapes are sketched in the API above
   so the ticket can pick without an interface break.
4. **Regenerate/swipe while the rigging view is open.** The trace for that
   turn is REPLACED, not appended - a swipe produces one new
   `SessionTurn`/`RiggingTrace` pair per the lorebook engine's own
   speculative-generation model; there is no "trace history per swipe"
   concept, only the trace of whichever generation is currently kept at that
   `messageCount`.
5. **Provider streaming interrupted mid-response (network drop, user abort).**
   The turn is not appended to history. Cost is charged only for whatever
   usage the provider actually reported for the partial generation; if the
   provider reports nothing for an aborted call, no cost is added
   (`pricingBasis` stays whatever it already was - never guessed from a
   partial local token count of an incomplete reply).
6. **Historical trace immutability.** A turn's `RiggingTrace` is frozen at
   generation time and stored on the `SessionTurn` itself. If a referenced
   lorebook entry is later deleted, renamed, or its trigger edited, the OLD
   turn's trace still shows what actually happened at generation time
   (stale `entryId`/`entryTitle` display is expected and correct, not a
   bug) - the trace is never recomputed retroactively against current
   entity state.
7. **Screen test: one branch errors, the other succeeds.** Both
   `ScreenTestTakeResult`s are independent; a failed branch does not block
   picking the successful one. `pickScreenTestWinner` must reject an attempt
   to pick a branch whose `status` is `"error"`.
8. **Preset swap drops a macro/persona slot the prior preset had.** If the
   new preset's prompt list does not reference the persona (or a macro that
   pulled from it), the persona simply stops being injected for future
   turns - this is ordinary assembly behavior, not an error condition the
   Test Stage itself must detect or warn about; cross-reference
   `specs/features/script-doctor.md` for a deterministic "unused persona"
   style check, out of scope here.
9. **Cost line for a recognized zero-cost local model (Ollama, etc.).**
   Shows "local model, no cost," never `$0.00` - `$0.00` implies known
   pricing where the correct claim is "pricing does not apply."
10. **User cancels an in-flight screen test before either branch completes.**
    Both provider calls are aborted (provider-adapter abort semantics,
    `specs/engine/provider-adapters.md`, not yet written); no
    `SessionTurn` is appended for either branch. Whether the provider itself
    still bills for tokens generated before cancellation is provider-
    specific and cannot be promised from the studio side - OPEN QUESTION 7.
11. **Two screen-test branches on `axis: "model"` targeting the SAME
    provider/model by mistake (user error, not a distinct model).** Not
    rejected - the screen test still runs both branches (now functionally
    an A/A test); the UI does not need to detect or block this, since a
    creator may deliberately want to see sampling variance between two
    identical-config runs.
12. **`explainEntry` called with a title/id that never appears in the
    referenced turn's `ActivationTrace.entries` at all** (the entry belongs
    to a lorebook that was never attached to this session). Returns `null`,
    distinctly documented as "not evaluated this session" rather than
    conflated with `stage: 'excluded_disabled'` (which means it WAS
    evaluated and rejected).
13. **`previewAssembly` called after a model swap but before any live turn
    at the new model.** Assembly still runs against the swapped-in model's
    context limit for budgeting purposes even though no provider call
    happens - the preview is meant to answer "what would the NEXT live turn
    send," which is defined by the currently active model/preset, not the
    last turn's.

## Test plan

- Fixtures required (new corpus under `fixtures/test-stage/`):
  - `single-turn-basic.json` - one character, one lorebook, one preset;
    scripted single `sendMessage` call with a mocked provider adapter;
    asserts the resulting `SessionTurn.trace` matches a golden
    `RiggingTrace` (lorebook `ActivationTrace` + token totals), and that
    `producedBy` records the configured model.
  - `swipe-determinism.json` - two consecutive `regenerate()` calls at the
    same `messageCount` against a lorebook containing a sticky + a cooldown
    entry; asserts no side-effect bleed between the discarded and kept
    generation (mirrors `specs/engine/lorebook-engine.md`'s
    `swipe-regeneration-determinism.json`, exercised here at the session
    layer instead of the engine layer directly).
  - `model-swap-provenance.json` - `sendMessage`, `setModel`, `sendMessage`
    again; asserts turn 1 and turn 2 carry different `producedBy.model`
    values and that turn 1's trace/tokens are untouched by the swap.
  - `preset-swap-drops-persona.json` - exercises edge case 8: preset swap to
    one with no persona slot; asserts the persona is absent from the next
    turn's assembly inputs (not a crash, not an error).
  - `dry-run-no-key.json` - `previewAssembly` with no provider configured at
    all; asserts it succeeds and returns a trace, and that a subsequent
    `sendMessage` call (still no key) rejects with the named
    unconfigured-role error (edge case 1).
  - `screen-test-model-axis.json` - two mocked provider adapters (different
    models) invoked concurrently off one session state with a sticky
    lorebook entry; asserts BOTH branches observe the sticky as freshly
    triggered (isolation requirement) rather than one branch seeing the
    other's side effect.
  - `screen-test-partial-failure.json` - one mocked branch throws, the other
    succeeds; asserts `ScreenTestResult` reports both statuses independently
    and `pickScreenTestWinner` rejects picking the errored branch (edge
    case 7).
  - `screen-test-cost-projection.json` - asserts `projectedCost` is computed
    and shown before either branch actually runs (rule 4 under "The cost
    line").
  - `cost-provider-usage-preferred.json` - mocked provider response
    includes `usage`; asserts `TurnCost.pricingBasis === "provider-usage"`
    and the local estimate is NOT what's reported.
  - `cost-local-model-no-price.json` - mocked local/OpenAI-compatible
    provider with no usage and no known price table entry; asserts
    `usdEstimate === null` and a "pricing unknown" note, never `0`.
  - `explain-entry-not-evaluated-vs-excluded.json` - exercises edge case 12:
    one entry never attached to the session (`null` result), one entry
    attached but disabled (`stage: 'excluded_disabled'`), asserting the two
    are distinguishable.
- Round-Trip Law applicability: none - this is session/runtime logic, not a
  codec; no `parse`/`serialize` pair exists for a `TestSession`.
- Property/unit tests beyond fixtures:
  - `messageCount` never advances during `regenerate()`, always advances by
    exactly 1 after a committed `sendMessage()` or `pickScreenTestWinner()`.
  - `RiggingTrace` objects stored on past `SessionTurn`s are never mutated
    by any later session operation (structural/deep-freeze check).
  - Screen-test branch execution is concurrent, not sequential: a test with
    two mocked providers each holding an artificial delay asserts total
    wall-clock time is close to the SLOWER branch's delay, not the sum of
    both (proves the "does not double the wall-clock wait" requirement).
  - `pickScreenTestWinner` is idempotent-safe against double-invocation
    (calling it twice on the same `ScreenTestResult` either errors or is a
    documented no-op on the second call - exact behavior TBD at
    implementation, but must not silently append two turns).

## Non-goals

- Does not define `packages/assembly`'s own assembly function signature,
  budgeting algorithm, or its "FULL TRACE object" shape - that is
  `specs/engine/prompt-assembly.md`'s job (not yet written, OPEN QUESTION 1).
  This spec only fixes what a session must supply as inputs and consume as
  outputs.
- Does not define provider adapter internals, streaming protocol, or
  abort/cancellation semantics - `specs/engine/provider-adapters.md`'s job
  (not yet written, OPEN QUESTION 2).
- Does not define the `vaud test-stage` CLI flag grammar, help text, or
  `--json` output shape - `specs/features/cli-converter.md`/`cli-ux.md`'s
  job; this spec only establishes that the command exists and what
  `TestSession` operations it must expose.
- Does not define pricing/catalog data (per-model $/token) - OPEN QUESTION 6,
  unresolved by any spec in this suite as of this writing.
- Does not implement the Script Doctor's audit passes (unused-persona
  detection, slop banks, etc.) even where the rigging trace surfaces data
  those passes could use - `specs/features/script-doctor.md`'s job.
- Does not define a canonical, versioned session/transcript file format for
  saving a Test Stage conversation into a production. Sessions are
  in-memory/ephemeral for M5; whether and how a transcript gets written to
  disk (and whether it becomes a new canonical content type) is unscoped
  here - OPEN QUESTION 8.
- Does not implement embeddings/semantic retrieval for lorebook matching -
  inherited non-goal from `specs/engine/lorebook-engine.md`; the Test Stage
  passes through whatever `semanticHits` a caller supplies (empty in M5) and
  builds no retrieval layer itself.
- Does not define the Studio app's (M6) visual layout for the rigging rail
  or screen-test split view - only the data those views would render.

## Sources consulted

- `docs\02-ARCHITECTURE.md`
  lines 21-22 (`packages/assembly` description: "Prompt assembly for the
  Test Stage: preset + card + persona + lorebook + history -> messages
  payload, with a full trace object"), lines 78-83 (Faces: "every studio
  action maps to an engine call that the CLI can also express"), lines
  85-90 ("No telemetry of any kind" - basis for the cost line being
  ephemeral/local-only).
- `docs\decisions\ADR-006-ai-and-agent.md`
  (full file) - point 4, "Model roles are user-mappable... test-stage
  inference... can each point at a different configured model," the basis
  for the `test-stage` model role and for AI being optional elsewhere but
  not here.
- `specs\engine\lorebook-engine.md`
  (full file) - `LorebookEngine` session-instance contract ("Inputs"
  section), the full `process()` pipeline, `ActivationTrace`/
  `ActivationTraceEntry` shape (API sketch), and specifically its
  "Determinism across regenerations" section, which names this file
  (`specs/features/test-stage.md`) as the consumer of the snapshot/restore
  contract for the A/B screen test.
- `specs\engine\macro-engine.md`
  lines 1-27 - confirms the Test Stage is one of three named callers of the
  macro engine and that macro evaluation never runs during codec parse/
  serialize, only at assembly/render time.
- `specs\engine\token-counting.md`
  (full file) - `TokenCounter`/`TokenCountResult`/`TokenCountOptions`
  interface (reused directly in this spec's API sketch), the
  provider-usage-preferred precedent cited in "The cost line" rule 1, and
  the `~`-prefix honesty convention for inexact counts.
- `specs\formats\regex-scripts.md`
  lines 1-40 - `RegexPlacement` values (`ai_output`, `display_only`,
  `prompt_only`, etc.) used in the turn lifecycle's regex post-pass step and
  `RiggingTrace.regex` shape.
- `specs\engine\productions-and-history.md`
  (full file) - "Bare-file operation" (basis for `SessionAttachment`'s
  `{ filePath }` alternative to `{ entityId }`), `readFileAtSnapshot` (basis
  for the draft-axis screen test's snapshot-read option, OPEN QUESTION 5),
  and confirmation that no `Session`/`Chat` canonical entity type exists in
  this suite (basis for OPEN QUESTION 8).
- `specs\formats\canonical-model.md`
  - "Content types (v1 surface)" list, confirming no session/chat type
  exists at the canonical-model level.
- `specs\README.md` lines 28-40 -
  confirms `prompt-assembly.md` and `provider-adapters.md` are listed as
  planned `engine/` specs but were not present as files at the time this
  spec was written (basis for OPEN QUESTION 1 and OPEN QUESTION 2).
- `wireframes\magic\test-stage.html`
  (full file) - intent source for all three wireframe panels: `TS-1`
  (:27-51, plain chat, `SWAP MODEL`/`RESTART` as distinct controls), `TS-2`
  (:53-91, rigging view layout, the monospace trace block, the "why didn't
  X fire?" chip, the "should be a toggle from TS-1" objection), `TS-3`
  (:93-122, screen-test split view, `SWAP AXIS: MODELS` control, "pick A"/
  "pick B" chips, and the explicit "Doubles token spend per turn; needs a
  visible cost line" objection this spec's "The cost line" section responds
  to directly).
- `<RoleCall>\apps\rc\src\lib\ai\prompt-assembly.ts`
  lines 1-60 (file header + imports only) - consulted for reference only;
  used only to confirm the INPUT shape a real assembly call needs (character,
  persona, preset prompts, lorebook engine result, chat history, model
  name/context limit), not read in algorithmic detail and not ported.
- `<RoleCall>\apps\rc\src\lib\prompt-tracking\types.ts`
  (full file, 883 lines) - read to confirm what a production-grade,
  source-attributed prompt trace looks like in practice (`SourceTree`,
  `TrackedMessage`, `PromptDebugData`, `TokenAttribution`). Used only to
  validate that this spec's `RiggingTrace.tokens.bySource` shape and the
  general "trace is an aggregation of sub-component traces" design are
  consistent with a real, shipped implementation of the same problem - no
  field names or types from this file are copied into the API sketch above;
  VAUDEVILLE's version is itself named as informing `prompt-assembly.md`
  (not this spec).

OPEN QUESTION 1: `specs/engine/prompt-assembly.md` does not exist yet in this
repo (confirmed via `specs/README.md` and a directory listing at spec-writing
time). This spec's session model, turn lifecycle, and `RiggingTrace.assembly`
field all depend on that spec's eventual call signature and trace shape.
Recommend writing `prompt-assembly.md` before or alongside the M5 ticket that
implements `TestSession`, and revisiting this file's `assembly`/OPEN QUESTION
1 references once it exists.

OPEN QUESTION 2: `specs/engine/provider-adapters.md` does not exist yet
either (same confirmation method). This spec's provider-call step, streaming
behavior, and cancellation/abort semantics (edge case 10) all depend on it.

OPEN QUESTION 3: No spec defines a context-budget trimming/eviction strategy
for when a model swap shrinks the available context mid-session. Likely
belongs in `prompt-assembly.md` once written; flagged here because the Test
Stage is the first caller that can trigger it interactively.

OPEN QUESTION 4: No spec defines a "save both screen-test takes" transcript
format for later comparison; only the pick-a-winner path is specified here.

OPEN QUESTION 5: Whether draft-axis screen tests compare two bare file paths,
two production history-snapshot reads of one entity id, or must support
both, is undecided.

OPEN QUESTION 6: No spec in this suite defines where per-model $/token
pricing data comes from (bundled static table, user-configurable, or
live-fetched). The cost line's `usdEstimate` is defined here only in terms
of behavior when pricing IS known vs. unknown, not the data source itself.

OPEN QUESTION 7: Whether a provider bills for tokens generated before a
client-side cancellation is provider-specific and outside what this suite
can guarantee; flagged as a caveat on cancellation cost accounting (edge
case 10) rather than resolved.

OPEN QUESTION 8: Whether Test Stage sessions ever get persisted to disk as a
transcript (and whether that becomes a new canonical content type alongside
Character/Lorebook/Preset/Persona/RegexScript) is unscoped for M5. Sessions
are treated as in-memory/ephemeral throughout this spec.
