# Spec: The Lorebook Engine

**Package:** `packages/lore` · **Milestone:** M5 · **Status:** draft
**Depends on:** `specs/formats/canonical-model.md`, `specs/formats/escrow-and-roundtrip.md`, `specs/formats/st-worldinfo.md`, `specs/formats/rolecall-lorebook.md`
**VAUDEVILLE reference:** `packages/lorebook/src/types.ts`, `packages/lorebook/src/triggers/*` (types + special/emotion trigger definitions, dependency-clean, extraction-ready); `apps/rc/src/lib/lorebook/engine.ts`, `apps/rc/src/lib/lorebook/triggers/*`, `apps/rc/src/lib/lorebook/matching/*`, `apps/rc/src/lib/lorebook/selection/*`, `apps/rc/src/lib/lorebook/runtime/state.ts` (engine/matching/selection/runtime machinery — behavioral reference only, not yet extracted into `packages/lorebook`; reimplement clean in `packages/lore`)

## Purpose

The lorebook engine decides, on every turn of a chat/test session, which lorebook
entries activate and where their content gets injected into the assembled prompt.
It is a pure function of (lorebook set, scan sources, runtime/session state) to
(activated entries, injection positions, a full activation trace). It has no
network access, no UI, and no knowledge of any specific AI provider — `packages/assembly`
(prompt-assembly, M5) calls it and consumes `InjectionResult` to build the final
message payload. This spec defines the matching, recursion, selection, and budget
algorithms plus the trace output the rigging/Test Stage view renders.

This is a reimplementation, not a port: VAUDEVILLE's `apps/rc/src/lib/lorebook/engine.ts`
and its `matching/`, `selection/`, `runtime/` submodules are the reference behavior
(read for algorithm fidelity), but `packages/lore` is written fresh against the
canonical `Lorebook`/`LorebookEntry` shape with zero framework/DB coupling. The
canonical entry shape itself is adopted near-verbatim from `packages/lorebook/src/types.ts`,
which is already dependency-clean (see `specs/formats/canonical-model.md`, "Lorebook /
LorebookEntry").

## Behavior

### Inputs

The engine consumes a `LorebookWithEntries[]` (one or more books active in a
session) plus a per-turn `TriggerContext` describing what to scan and the current
turn/session metadata. Session-scoped runtime state (sticky/cooldown/delay
counters, per-trigger frequency, side-effect variables) is owned by the engine
instance and mutated by `process()`, not passed in fresh each call — callers
create one `LorebookEngine` per chat/test session and call `process()` once per
generation.

`TriggerContext` fields (source: `apps/rc/src/lib/lorebook/engine.ts:54-98`):

- `messages: ChatMessage[]` — recent messages, most-recent-first, each with
  `role`, `content`, `depth` (0 = most recent).
- `characterDescription?`, `characterPersonality?`, `userPersona?`, `scenario?`,
  `presetContent?` — optional scan sources gated per-entry by
  `scanCharacterDescription` / `scanCharacterPersonality` / `scanUserPersona` /
  `scanScenario` / `scanPreset`.
- `messageCount: number` — monotonic turn counter; drives sticky/cooldown/delay
  advancement and `[messageCount:X]` special triggers.
- `generationType?: 'normal'|'continue'|'swipe'|'regenerate'|'impersonate'`,
  `swipeCount?`, `isGroupChat?`, `currentSpeaker?`, `activeLorebookNames?` — special
  trigger context.
- `character?: { characterName, characterTags }` — for `characterFilter` gating.
- `variables?: VariablesState` — for side-effect execution.
- `messageTimestamps?`, `currentTime?` — for `[recency:Xm]`.
- `semanticHits?: Array<{ entryId, score }>` — pre-computed embedding-retrieval
  candidates supplied by the caller (assembly layer); folded into the triggered
  set alongside keyword matches (see "Semantic hits", below). Not computed by
  this engine.

### The pipeline (`process()`)

Ten ordered steps, matching `apps/rc/src/lib/lorebook/engine.ts:200-611`:

1. **State advancement.** If `messageCount` increased since the last call,
   advance all sticky/cooldown/delay counters by the delta and snapshot
   runtime + activation state. If `messageCount` is unchanged (a swipe or
   regenerate at the same turn), restore state from the snapshot taken at the
   start of that turn so every speculative generation at a given `messageCount`
   starts from identical state (a fresh generation must not see cooldowns/sticky
   armed by a discarded swipe). If `messageCount` decreased (messages deleted),
   re-snapshot current state as the new baseline. See "Determinism across
   regenerations" below.
2. **Gather candidates.** Collect all `enabled` entries across all active books
   that pass `characterFilter` (if `context.character` is supplied). Entries
   failing the filter are excluded before any trigger evaluation.
3. **Evaluate triggers per entry**, in this order per entry:
   a. Sticky check: if `isStickyActive(entry.id)`, the entry force-activates
      (`matchedTriggers: ['[sticky]']`, `probability: 1`) and skips straight to
      the triggered list — checked *before* cooldown so a cooldown armed at the
      moment of activation cannot cut a sticky window short.
   b. Cooldown check: if on cooldown, skip entirely.
   c. Constant check: `constant: true` entries always activate
      (`matchedTriggers: ['[constant]']`) and call `markFired` immediately.
   d. `delayUntilRecursion > 0` entries are skipped in the direct pass — they may
      only fire via the recursion evaluator (step 4).
   e. Delay check: if delay status is `'waiting'`, skip.
   f. Build (cached) scan text per entry's effective `scanDepth` + scan-source
      flags, using `entry.field ?? lorebook.globalField` for any field that is
      `null` on the entry.
   g. Evaluate `selectiveLogic` over `triggers` (primary) and `secondaryTriggers`
      (see "Selective logic" below). No match -> if the entry had a `'ready'`
      delay status, reset it (delay only survives while triggers keep matching);
      otherwise continue to next entry.
   h. If `entry.delay > 0` and delay hasn't started, start the delay countdown
      and do NOT activate this turn (delay is "wait N turns after first match
      before activating").
   i. Otherwise the entry is added to the triggered set with its computed
      probability and matched-trigger list.
4. **Recursion.** If any triggered entry has `allowRecursion: true`, or any
   active book has `globalRecursion: true`, run the recursion evaluator (see
   "Recursion algorithm" below) over the candidate pool (`!excludeRecursion &&
   (allowRecursion || book.globalRecursion) && !onCooldown`) and merge newly
   triggered entry IDs into the triggered set.
5. **Inclusion groups.** Entries sharing a non-null `groupName` compete: exactly
   one winner per group is selected via weighted random draw on `groupWeight`
   (`Math.random() * totalWeight`, subtract each candidate's weight until <= 0).
   A single-candidate group always wins. Losers are dropped from the triggered
   set; ungrouped entries pass through untouched.
6. **Cross-entry boosting.** For every entry that fired this pass (post-group
   resolution) with non-empty `boostIds` and `boostAmount > 0`, add
   `boostAmount` to the probability of each targeted entry ID that is also in
   the (post-group) candidate set. Boosts from multiple sources on the same
   target stack additively; final probability is capped at 1.0. Boosting a
   target that did NOT independently trigger this turn has no effect (boosting
   only adjusts probability of entries already in the candidate set — it does
   not force-add non-matching entries).
7. **Sort by priority.** Descending `priority`, then descending probability as
   tiebreaker.
8. **Token/entry budget.** `entry.ignoreBudget: true` entries are always
   included regardless of remaining budget. In `budgetMode: 'token'`, walk the
   sorted list including entries while `runningTotal + tokenCount(entry.content)
   <= tokenBudget` (using the caller-supplied `TokenCounter`, not a fixed
   heuristic — see `specs/engine/token-counting.md`); a `tokenBudget <= 0` means
   unlimited (include everything). In `budgetMode: 'entry'`, include up to
   `entryBudget` non-`ignoreBudget` entries. Entries that don't fit are recorded
   as `skippedByBudget` in the trace, not silently dropped.
9. **Roll probability and organize by position.** For each included entry, roll
   `Math.random() < probability` (probabilities >= 1 always inject, <= 0 never
   inject). Injecting entries are NOT re-`markFired` if their activation this
   turn was a sticky re-injection (`matchedTriggers` contains `'[sticky]'`) —
   re-arming sticky/cooldown on every sticky turn would reset the countdown
   each message and could start cooldown before the sticky window naturally
   expires. Non-sticky fresh activations call `markFired` (arms
   `stickyRemaining`/`cooldownRemaining` from the entry's `sticky`/`cooldown`
   fields) and record per-trigger activation timestamps for frequency limits.
   Entries are bucketed into `byPosition` by their `position` field (`depth` and
   `append` bucket further by `entry.depth`).
10. **Side effects.** If `context.variables` is supplied, run each injecting
    entry's `sideEffects.effects` (setvar/addvar/incvar/decvar/delvar) against
    the variable state, honoring `onlyOnFirstTrigger` (tracked per-session,
    seedable via `seedFiredSideEffects()` for resumed sessions) and
    `clearOnDeactivate`.

The engine returns an `InjectionResult`: entries grouped `byPosition`, the flat
`allInjecting` list, `totalTokens`, `sideEffects`, and a `debug` block
(`evaluated`, `matched`, `injected`, `skippedByBudget`, `recursionDepthReached`)
— this `debug` block plus the per-entry `matchedTriggers` array IS the seed of
the ACTIVATION TRACE the Test Stage rigging view renders; `packages/lore`
extends it into the fuller structured trace described in "Activation trace"
below (per-entry pass/fail reasons at every pipeline stage, not just the
aggregate counts VAUDEVILLE computes).

### Determinism across regenerations

A swipe or regenerate re-runs `process()` at the same `messageCount`. Side
effects on runtime state (cooldown arming, sticky arming, per-trigger frequency
timestamps) are committed unconditionally inside step 3/9 regardless of which
generation is "kept." Without correction, a swipe that discards generation 1
would still see generation 1's cooldown/sticky side effects leak into
generation 2. The engine handles this by snapshotting runtime + activation
state immediately after advancing counters for a new `messageCount`, and
restoring from that snapshot at the start of every call that repeats the same
`messageCount` (source: `apps/rc/src/lib/lorebook/engine.ts:200-238`, "speculative
generation" semantics). `packages/lore` must replicate this: the snapshot/restore
behavior is part of the contract, not an implementation detail, because it is
directly observable by callers running multiple candidate generations per turn
(the Test Stage's A/B screen test, `specs/features/test-stage.md`).

### Selective logic

Every entry has `triggers` (primary) and `secondaryTriggers` (optional), combined
via `selectiveLogic`. At least one primary trigger must match for the entry to
be considered at all. If `secondaryTriggers` is empty, only the primary check
matters regardless of `selectiveLogic`. Otherwise:

| `selectiveLogic` | Meaning |
|---|---|
| `and_any` | primary matched AND >= 1 secondary matched |
| `and_all` | primary matched AND ALL secondaries matched |
| `not_any` | primary matched AND NO secondaries matched |
| `not_all` | primary matched AND NOT ALL secondaries matched (>= 1 didn't) |

Source: `apps/rc/src/lib/lorebook/triggers/index.ts:119-211`.

### Trigger matching

Each `Trigger` is `{ keyword, isRegex, flags?, frequency?, lastActivatedAt? }`,
optionally an `AdvancedTrigger` adding its own `probability` (0-100). Matching
dispatches on the keyword shape:

1. **Special trigger** — keyword matches `/^\[(\w+):(.+)\]$/`. Dispatch table
   (source: `apps/rc/src/lib/lorebook/triggers/special.ts:77-129`):
   - `messageCount` / `swipeCount` — numeric comparison via
     `evaluateComparison`: expression `[<>=]*\d+` (e.g. `>=50`, `<10`, `=3`,
     bare `50` treated as `=50`).
   - `randomChance` — `Math.random() * 100 < value` (re-rolled every evaluation,
     not cached).
   - `generationType` — exact match against `context.generationType`
     (case-insensitive on the value side).
   - `isGroupChat` — boolean string compare.
   - `speaker` — case-insensitive compare against `context.currentSpeaker`.
   - `lorebookActive` — checks `context.activeEntryIds` by ID, then by title via
     `entryTitleToId`, then falls back to matching `context.activeLorebookNames`
     (case-insensitive) — this triple fallback means the same syntax
     `[lorebookActive:X]` can reference an entry ID, an entry title, or a
     lorebook name, resolved in that priority order.
   - `recency` — `[recency:Xs|Xm|Xh]`; true if the most recent message
     timestamp is within the window of `context.currentTime`. **No timestamps
     available -> defaults to true** (assumes a live conversation); invalid
     format also defaults to true.
   - `emotion` — routed to a dedicated emotion pattern matcher
     (`matchEmotionTrigger`, regex pattern banks per emotion — see
     `packages/lorebook/src/triggers/emotion.ts`); NOT part of this spec's
     algorithm detail, OPEN QUESTION below on the M5 fallback story.
   - `mood`, `timeOfDay`, `location`, `weather`, `activity`, `relationship`
     (narrative conditionals) — **always return `false` from the regex engine.**
     In VAUDEVILLE these route to an LLM sidecar (TunnelVision) during
     pre-generation; `packages/lore` has no sidecar and no pre-gen phase, so
     these triggers are permanently unmatchable by this engine (see Non-goals).
   - Unknown type -> `false`.
2. **Regex trigger** (`isRegex: true`) — compiled and matched with a safe
   (linear-time, ReDoS-proof) regex engine, using `trigger.flags` if present,
   else `i` unless `caseSensitive`. VAUDEVILLE uses RE2 (`re2js`) specifically
   because trigger patterns are user-supplied and native `RegExp` is vulnerable
   to catastrophic backtracking; `packages/lore` must use an equivalently safe
   engine (RE2 binding or a hand-rolled linear matcher) — this is a hard
   requirement, not an implementation preference, because lorebooks are shared/
   imported content.
3. **Plain keyword** — substring match, case-sensitivity per
   `entry.caseSensitive ?? lorebook.globalCaseSensitive`. If
   `matchWholeWords` (`entry.matchWholeWords ?? lorebook.globalMatchWholeWords`)
   is set, wrap in a word-boundary pattern `(?:^|\W)keyword(?:$|\W)` (escaped
   keyword — safe for a native/fast regex engine since it's not user regex).

**Per-trigger frequency** (`trigger.frequency`): independent of entry-level
cooldown. A trigger with `frequency: N` cannot itself CAUSE activation again
until N messages have passed since it last did, tracked in
`TriggerActivationState.lastActivatedAt` keyed by trigger keyword (not per-entry
— two entries sharing a keyword string share frequency state, which is a
faithful port of VAUDEVILLE behavior worth flagging to implementers, not a bug
to fix). Checked before matching (`canTriggerActivate`), recorded after an
entry actually activates (`recordTriggerActivation`) — a trigger that matched
but whose entry didn't end up injecting (lost a group, or failed the
probability roll) is still recorded if it contributed to the match (see
`recordMatchedTriggers`, called for every willInject roll outcome including
`false`... actually only inside the `willInject` branch — recorded only on
successful injection, source: `engine.ts:546-568`).

### Probability calculation

- **Simple mode** (`triggerMode: 'simple'`): `entry.probability / 100`.
- **Advanced mode**: iterate `entry.triggers`, for each that matches take its
  `AdvancedTrigger.probability` (or 100 for a `SimpleTrigger` mixed into an
  advanced-mode list); combine per `probabilityMode`:
  - `'highest'` (default): `Math.max` across matched triggers.
  - `'additive'`: sum, capped at 100.
  Final value divided by 100, capped at 1.0.
- Constant, sticky, and semantic-hit activations bypass this calculation
  entirely (probability fixed at 1).
- Recursion-triggered entries use the SAME simple/advanced calculation but
  independently, inside the recursion evaluator (`matching/recursion.ts:174-200`
  — note this copy computes probability as a 0-100 integer, not 0-1; the engine
  divides by 100 when merging recursion results back in at
  `engine.ts:504-523`). `packages/lore` should unify these into one probability
  function rather than keep two copies with different scales — flag as a
  cleanup opportunity during implementation, not a behavior change (the
  externally observable probabilities must match).

### Recursion algorithm

Source: `apps/rc/src/lib/lorebook/matching/recursion.ts:57-131`.

```
candidates = entries where !excludeRecursion && (allowRecursion || book.globalRecursion) && !onCooldown
activeContents = []   // content of entries that triggered and don't preventRecursion
triggeredSet = {}
depth = 0
loop while (foundNewTriggers && depth < MAX_RECURSION_DEPTH=10):
  foundNewTriggers = false
  isFirstPass = (depth == 0)
  for each candidate not yet in triggeredSet:
    if candidate.excludeRecursion && !isFirstPass: skip   // only ever matches directly
    if candidate.delayUntilRecursion > depth: skip         // not yet its turn
    scanText = buildScanText(candidate, sources)
    if (candidate.allowRecursion || book.globalRecursion) && activeContents non-empty:
       scanText += "\n" + activeContents.join("\n")
    evaluate selective logic + probability against scanText (using this candidate's
      own book for caseSensitive/matchWholeWords fallback, and the shared
      activationState for frequency gating)
    if matched:
       triggeredSet.add(candidate.id); record matchedTriggers, probability
       if !candidate.preventRecursion: activeContents.push(candidate.content)
       foundNewTriggers = true
  depthReached = depth
  depth++
```

Key semantics:

- `delayUntilRecursion: N` entries are excluded from the DIRECT match pass
  (engine.ts step 3d) entirely — the recursion evaluator's depth-gate
  (`delayUntilRecursion > depth`) is the only path that can fire them, and only
  once `depth >= N`.
- `excludeRecursion` entries can be found by a direct chat-text match on pass 0
  but never by chain-reaction content from other entries on later passes.
- `preventRecursion` entries can be triggered normally but their own content
  never seeds further recursion (chain stops at them).
- `allowRecursion` (entry) OR `globalRecursion` (book) — either enables an
  entry to be found by recursive scanning.
- Recursion results are merged into the main triggered set only for entries not
  already present (a directly-matched entry is not re-added by recursion).
- OPEN QUESTION: VAUDEVILLE's own code comment (`engine.ts:456-463`, "bug 23
  fix") flags that `activeContents` in the top-level caller is seeded empty —
  entries triggered in the DIRECT pass do not seed depth-1 recursion for
  non-`allowRecursion` entries; only entries reachable via the recursion
  evaluator's own internal passes chain onto each other. Confirm this is the
  intended production behavior (not a known bug to fix) before `packages/lore`
  locks the contract — if it's an acknowledged-but-unfixed bug, the port should
  decide explicitly whether to preserve it (byte-identical activation traces vs.
  VAUDEVILLE) or fix it (documented behavior change from the ground truth).

### Semantic hits

`context.semanticHits` (pre-computed by the caller, e.g. an embeddings-backed
retrieval layer — NOT part of this engine) are folded into the triggered set
after keyword matching and before recursion: for each hit whose `entryId` maps
to a candidate entry (enabled, passes character filter) and is not on cooldown,
if the entry didn't already match by keyword, add it with `probability: 1` and
`matchedTriggers: ['[semantic:{score.toFixed(2)}]']`; if it DID already match by
keyword, just append the semantic tag to the existing match's `matchedTriggers`
for trace visibility. The entry's own `probability`/`probabilityMode` still
gates injection downstream via the standard roll — semantic matching only
grants entry into the candidate pool, same as a keyword match would.
`packages/lore` v1 has no embeddings layer (OPEN QUESTION below); this field
exists on the engine's public input contract from day one so a future
`packages/embed` package can be wired in without an engine API change, but M5
implementations may leave it always-empty.

### Scan text construction

`buildScanText(entry, lorebook, sources)`: concatenate, in order, chat messages
with `depth < effectiveScanDepth` (message `depth` 0 = most recent; `break`s at
the first message at/past scan depth, so messages must be ordered
most-recent-first for this cutoff to be correct), then any of
characterDescription / characterPersonality / userPersona / scenario /
presetContent whose corresponding `scan*` flag is on, joined with `\n`. Recursive
scan text appends `activeContents.join('\n')` after the base text when recursion
applies (see above). Scan text is cached per unique `(scanDepth, scan-flags)`
signature within a single `process()` call since most entries in a book share
defaults (`engine.ts:300-303,360-368`).

### Character filter

`characterFilter: { names[], tags[], isExclude }`. No filter, or a filter with
both `names` and `tags` empty, always passes. Otherwise: `nameMatch` is a
case-insensitive exact match against `context.character.characterName`;
`tagMatch` is a case-insensitive exact match of ANY filter tag against ANY
character tag. `matches = nameMatch || tagMatch`. `isExclude: false`
(whitelist) passes iff `matches`; `isExclude: true` (blacklist) passes iff
`!matches`. Applied once, before any trigger evaluation (step 2), not
reconsidered during recursion (recursion candidates are drawn from the same
pre-filtered `allEntries` list).

### Injection positions

`InjectionPosition` values and their meaning (source: `packages/lorebook/src/types.ts:159-192`):

| Value | Meaning | ST export mapping |
|---|---|---|
| `world` | before character card | ST position 0 |
| `character` | after character card | ST position 1 |
| `before_example` | before example messages | ST position 2 |
| `after_example` | after example messages | ST position 3 |
| `depth` | at `entry.depth` messages from the end of history | ST position 4 |
| `append` | RC extension: glued onto the end of the existing message at `entry.depth` (no new message) | maps to ST position 4 on export |
| `append_bottom` | RC extension: pinned to the very end of the assembled prompt (after history/post-history) | maps to ST position 4 on export |
| `prepend_top` | RC extension: pinned to the very top of the assembled prompt | maps to ST position 0 on export |
| `scene` | legacy/generic | maps to ST position 2 on export |

`before_example`/`after_example` are kept distinct (not collapsed to a single
"example" position) specifically to avoid data loss on ST -> RC -> ST
round-trips (source comment, `types.ts:179-180`). This engine only *organizes*
entries into these buckets (`InjectionResult.byPosition`); actually splicing
them into a message array is `packages/assembly`'s job
(`specs/engine/prompt-assembly.md`).

### Budgets

`Lorebook.tokenBudget` (0 = unlimited) + `budgetMode: 'token'|'entry'` +
`entryBudget` (default 20, used only in `'entry'` mode). `LorebookEntry.ignoreBudget`
bypasses both modes unconditionally. Token counting for budget purposes must use
the shared `TokenCounter` interface from `specs/engine/token-counting.md`
— VAUDEVILLE's reference implementation (`selection/priority.ts:25-34`) uses a
crude `words * 1.3 + 2` heuristic; `packages/lore` should NOT port that
heuristic as final behavior, only as a documented fallback when no real
tokenizer is configured (this is a deliberate improvement over the reference,
not a silent deviation — call it out in the ticket).

## Public API sketch

```ts
// packages/lore/src/index.ts

import type { Lorebook, LorebookEntry, CharacterFilter } from '@vaud/core';
import type { TokenCounter } from '@vaud/core';

export interface LorebookWithEntries extends Lorebook {
  entries: LorebookEntry[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** 0 = most recent */
  depth: number;
}

export interface CharacterContext {
  characterName: string;
  characterTags: string[];
}

export interface VariablesState {
  local: Record<string, string | number>;
  global: Record<string, string | number>;
}

export interface SemanticHit {
  entryId: string;
  score: number;
}

export interface TriggerContext {
  messages: ChatMessage[];
  characterDescription?: string;
  characterPersonality?: string;
  userPersona?: string;
  scenario?: string;
  presetContent?: string;
  messageCount: number;
  generationType?: 'normal' | 'continue' | 'swipe' | 'regenerate' | 'impersonate';
  swipeCount?: number;
  isGroupChat?: boolean;
  currentSpeaker?: string;
  activeLorebookNames?: string[];
  character?: CharacterContext;
  variables?: VariablesState;
  messageTimestamps?: number[];
  currentTime?: number;
  semanticHits?: SemanticHit[];
}

export interface TriggeredEntry {
  entry: LorebookEntry;
  probability: number;       // 0-1, final (post-boost)
  matchedTriggers: string[]; // keyword strings + tags like '[sticky]', '[constant]', '[semantic:0.87]'
  willInject: boolean;
}

export interface InjectionResult {
  byPosition: {
    world: TriggeredEntry[];
    character: TriggeredEntry[];
    scene: TriggeredEntry[];
    before_example: TriggeredEntry[];
    after_example: TriggeredEntry[];
    depth: Map<number, TriggeredEntry[]>;
    append: Map<number, TriggeredEntry[]>;
    append_bottom: TriggeredEntry[];
    prepend_top: TriggeredEntry[];
  };
  allInjecting: TriggeredEntry[];
  totalTokens: number;
  sideEffects?: SideEffectsResult;
  trace: ActivationTrace;
}

/** One row per candidate entry, explaining pass/fail at every pipeline stage. */
export interface ActivationTraceEntry {
  entryId: string;
  entryTitle: string;
  lorebookId: string;
  stage:
    | 'excluded_disabled'
    | 'excluded_character_filter'
    | 'excluded_cooldown'
    | 'sticky_reinjection'
    | 'constant'
    | 'excluded_delay_waiting'
    | 'no_scan_text'
    | 'no_trigger_match'
    | 'delay_started'
    | 'matched_direct'
    | 'matched_recursion'
    | 'matched_semantic'
    | 'excluded_group_loser'
    | 'excluded_budget'
    | 'excluded_probability_roll'
    | 'injected';
  matchedTriggers: string[];
  probability: number;
  recursionDepth?: number;
  tokenCount?: number;
  boostedFrom?: string[]; // entry IDs that boosted this entry's probability
}

export interface ActivationTrace {
  entries: ActivationTraceEntry[];
  summary: {
    evaluated: number;
    matched: number;
    injected: number;
    skippedByBudget: number;
    recursionDepthReached: number;
  };
}

export interface SideEffectsResult {
  executions: Array<{
    entryId: string;
    effect: { type: 'setvar' | 'addvar' | 'incvar' | 'decvar' | 'delvar'; variable: string; scope: 'local' | 'global' };
    appliedValue: string | number;
  }>;
}

export interface LorebookEngineOptions {
  tokenCounter: TokenCounter;
}

export class LorebookEngine {
  constructor(lorebooks: LorebookWithEntries[], options: LorebookEngineOptions);
  setLorebooks(lorebooks: LorebookWithEntries[]): void;
  setBudgetOptions(opts: { mode: 'token' | 'entry'; tokenBudget?: number; entryBudget?: number }): void;
  process(context: TriggerContext): InjectionResult;
  advanceMessage(): void;
  resetSideEffects(): void;
  seedFiredSideEffects(entryIds: Iterable<string>): void;
  buildInjectionText(entries: TriggeredEntry[]): string;
}
```

## Edge cases & failure modes

1. **Sticky entry with an active cooldown from a prior activation.** Sticky is
   checked before cooldown, so the sticky window is honored in full even if
   cooldown would otherwise block re-matching; cooldown only prevents a *fresh*
   activation, never interrupts an active sticky window.
2. **Constant entry that is also on cooldown.** Constant entries are checked
   before the cooldown gate in the direct pass (step 3c comes after 3b in
   VAUDEVILLE's order — verify against `engine.ts:317-342`: cooldown IS checked
   before constant). Constant entries ARE subject to cooldown. Confirmed by
   source order: sticky (no cooldown check) -> cooldown gate -> constant.
3. **Entry with `delayUntilRecursion > 0` and `allowRecursion: false`.** Never
   fires: the direct pass skips it outright (step 3d), and the recursion
   candidate filter requires `allowRecursion || book.globalRecursion`. If the
   owning book also has `globalRecursion: false`, this entry is permanently
   dead configuration. `vaud validate` / the Script Doctor should flag this
   combination as a warning (cross-reference `specs/features/script-doctor.md`).
4. **`matchWholeWords` with a keyword containing regex-special characters.**
   The keyword is escaped before being wrapped in the word-boundary pattern —
   a literal keyword like `"C++"` matches literally, not as a regex.
5. **User-supplied regex trigger that fails to compile.** Falls back to a
   literal case-insensitive substring match of the raw pattern text (not a
   silent no-match) — `matching/keyword.ts:108-115`. This is a deliberate
   safety fallback, not an error; `packages/lore` must preserve it and surface
   a warning in the trace/report rather than throwing.
6. **Two entries with an identical trigger keyword string, different
   `frequency` values.** They share ONE `lastActivatedAt` timestamp (keyed by
   keyword string, not entry+keyword) — the second entry's frequency window is
   affected by the first entry's activations, and vice versa. This is
   inherited VAUDEVILLE behavior, not a bug to silently fix; document it in the
   engine's public docs as a gotcha for lorebook authors.
7. **`groupWeight` all zero across a group's candidates.** `resolveInclusionGroups`
   falls back to picking the first candidate deterministically (array order),
   not a uniform random pick.
8. **`messageCount` goes backward** (user deletes messages mid-session). Runtime
   state cannot be reconstructed for the lower count; the engine re-baselines
   (treats current state as the new snapshot point) rather than attempting
   time-travel — subsequent regenerations at that lower count replay
   consistently from the re-baselined point, but activation history from the
   "future" that got deleted is NOT unwound (sticky/cooldown counters keep
   whatever values they had, they just stop being touched by the deleted
   turns).
9. **`tokenBudget: 0` in `budgetMode: 'token'`.** Treated as "unlimited," not
   "zero tokens allowed" — every included-so-far entry gets in, budget math is
   skipped entirely.
10. **An entry boosted by `boostIds` that never independently matches this
    turn.** The boost has no effect — boosting only raises probability for
    entries already in the post-group candidate set; it cannot force an
    unmatched entry into consideration.
11. **Semantic hit for an entry that is disabled or fails the character
    filter.** Silently ignored (the `allEntries.find` lookup only searches the
    pre-filtered candidate pool).
12. **Semantic hit for an entry on cooldown.** Dropped, same as a keyword match
    would be — cooldown is enforced uniformly regardless of match source.
13. **Recursion loop that would exceed `MAX_RECURSION_DEPTH` (10).** The loop
    terminates at depth 10 regardless of whether new entries are still being
    found; `debug.recursionDepthReached` reports the last completed depth, not
    an error state. No entry beyond that horizon fires this turn.
14. **`probabilityMode: 'additive'` in advanced mode with matched trigger
    probabilities summing past 100.** Capped at 100 (1.0) before the roll, not
    rejected or wrapped.
15. **Empty `triggers` array on a non-constant, non-sticky entry.**
    `anyPrimaryMatched` is false unconditionally (loop over zero triggers never
    sets it true) — entry never activates by keyword match; it can still be
    force-included via `constant`, an active sticky window, or a semantic hit.
16. **`scanDepth: 0`.** No chat messages are scanned (loop `break`s
    immediately since every message has `depth >= 0`); only the optional
    scan-source flags (character description etc.) can still contribute text.

## Non-goals

- No pre-generation phase and no LLM sidecar: `[emotion:X]` falls back to the
  regex pattern-bank matcher only; `[mood]`, `[timeOfDay]`, `[location]`,
  `[weather]`, `[activity]`, `[relationship]` (narrative conditionals) are
  permanently unmatchable by this engine — they always return `false`. A
  future `packages/interview`/AI-backed evaluator could add this later as a
  separate optional pass; it is out of scope for M5.
- No embeddings/semantic retrieval implementation. `semanticHits` is an input
  slot on the contract, not a capability this package builds.
- No prompt assembly, no message-array splicing, no macro expansion of injected
  content (`packages/macros` runs macro expansion on the assembled prompt,
  not inside this engine — see `specs/engine/macro-engine.md`).
- No persistence of runtime state across process restarts. Session state
  (sticky/cooldown/delay counters, per-trigger frequency, side-effect
  "already fired" markers) lives in the `LorebookEngine` instance only; a
  caller that needs to resume a session across a restart must persist and
  replay via `seedFiredSideEffects` and by reconstructing `messageCount`
  correctly (there is no engine-native serialize/deserialize of runtime state
  in this v1 — OPEN QUESTION below).
- No editor/UI concerns (drag-to-reorder, entry CRUD, category management).

## Test plan

Fixtures required (new corpus under `fixtures/lorebook-engine/`, JSON scenario
files: input lorebook(s) + a scripted sequence of `TriggerContext` calls +
expected `InjectionResult`/trace per call):

- `simple-keyword-match.json` — one entry, one plain keyword, exact substring
  hit and miss.
- `whole-word-vs-substring.json` — keyword `"cat"` against `"category"` with
  `matchWholeWords` on and off.
- `case-sensitivity.json` — mixed-case keyword against mixed-case text, entry
  override vs. lorebook global.
- `regex-trigger-safe.json` — `isRegex: true` with valid pattern + flags.
- `regex-trigger-malformed-fallback.json` — an intentionally invalid pattern,
  asserting the literal-substring fallback path (edge case 5).
- `regex-trigger-redos-attempt.json` — a catastrophic-backtracking-shaped
  pattern (e.g. `(a+)+$`), asserting the engine returns within a bounded time
  budget (proves the safe-regex-engine requirement, not just correctness).
- `selective-logic-and-any.json`, `-and-all.json`, `-not-any.json`,
  `-not-all.json` — one fixture per operator, primary + secondary keyword
  combinations covering match/no-match boundaries.
- `constant-entry.json` — always injects, respects cooldown (edge case 2).
- `sticky-window.json` — entry fires, stays sticky for N turns without
  re-arming cooldown mid-window, then expires and cooldown (if any) begins.
- `cooldown-blocks-reactivation.json` — entry fires, cooldown blocks the next
  N turns, then reactivates.
- `delay-then-fire.json` — trigger matches, delay countdown, fires after N
  turns of continued matching; and a companion where the trigger stops
  matching mid-delay (delay resets, edge case in step 3g).
- `per-trigger-frequency.json` — two triggers on one entry with different
  `frequency` values, asserting independent cooldown windows; plus the
  shared-keyword-across-entries gotcha (edge case 6).
- `recursion-chain.json` — entry A's content (post-activation) causes entry B
  to match on a later recursion pass; `preventRecursion` stops a chain;
  `excludeRecursion` only matches pass 0; `delayUntilRecursion` gates an entry
  to a specific depth.
- `recursion-max-depth.json` — a pathological chain exceeding
  `MAX_RECURSION_DEPTH`, asserting clean termination (edge case 13).
- `inclusion-group-weighted.json` — three entries in one group with different
  `groupWeight`; statistical assertion over many seeded rolls, plus the
  all-zero-weight fallback (edge case 7).
- `cross-entry-boost.json` — entry A boosts entry B and C; B independently
  matches (boost applies), C does not match this turn (boost has no effect,
  edge case 10).
- `token-budget-exclude.json` — entries sorted by priority, budget cuts off
  mid-list, `ignoreBudget` entries included past the cutoff.
- `entry-budget-mode.json` — same shape in `budgetMode: 'entry'`.
- `character-filter-whitelist.json`, `-blacklist.json` — name match, tag match,
  no-match-passes-blacklist.
- `special-trigger-messagecount.json`, `-generationtype.json`,
  `-lorebookactive-by-id-title-name.json` (triple fallback), `-recency.json`
  (including the no-timestamps-defaults-true case), `-randomchance.json`.
- `narrative-conditional-always-false.json` — `[mood:tense]` never matches
  (Non-goals contract, guards against a future accidental implementation
  drifting from the documented "always false" behavior without a spec update).
- `semantic-hit-merge.json` — a semantic hit for an entry that also
  keyword-matched (tag appended, no duplicate), a semantic-only hit, a
  semantic hit for a disabled/filtered/cooldown entry (dropped, edge cases
  11-12).
- `swipe-regeneration-determinism.json` — call `process()` twice at the same
  `messageCount` (simulating a swipe) and assert byte-identical
  `InjectionResult` shape and that runtime state after the second call matches
  a fresh third call at that same count (proves the snapshot/restore
  contract).
- `message-count-regression.json` — `messageCount` decreases between calls;
  assert the re-baseline behavior (edge case 8) rather than a crash or
  time-travel attempt.
- `injection-position-bucketing.json` — one entry per `InjectionPosition`
  value, asserting each lands in the correct `byPosition` bucket, `depth`/
  `append` bucketed by `entry.depth`.
- `side-effects-first-trigger-only.json` — `onlyOnFirstTrigger` gates repeat
  firing; `seedFiredSideEffects` correctly suppresses on a "resumed" session.

Round-Trip Law applicability: N/A directly (this is a runtime engine, not a
codec) — but every fixture's expected `InjectionResult` is itself a golden
file checked into the fixture corpus and diffed exactly (not fuzzy-matched),
since matching output IS the product being validated end-to-end.

Property/unit tests beyond fixtures:

- Probability roll boundary properties: `probability >= 1` always injects,
  `probability <= 0` never injects, across many random seeds for the
  in-between range converging to the expected rate.
- Recursion always terminates within `MAX_RECURSION_DEPTH` for any generated
  lorebook (no manually crafted infinite-chain fixture should hang).
- `evaluateSelectiveLogic` truth table exhaustively tested against the four
  operators independent of the engine (unit-level, not fixture-level).
- Scan-text cache correctness: entries with identical `(scanDepth, scan-flags)`
  signature must observe the exact same scan text as entries computed without
  caching (differential test against a cache-disabled code path).

## Sources consulted

- `C:\Users\chiev\Documents\VAUDEVILLE\packages\lorebook\src\types.ts` (full
  file: `LorebookEntry` :216-331, `Trigger`/`SimpleTrigger`/`AdvancedTrigger`
  :55-84, `SelectiveLogic` :108, `InjectionPosition` :182-192, `Lorebook`
  :342-393, `DEFAULT_ENTRY`/`DEFAULT_LOREBOOK` :717-787)
- `C:\Users\chiev\Documents\VAUDEVILLE\apps\rc\src\lib\lorebook\engine.ts` (full
  file: `process()` pipeline :200-611, determinism/snapshot comments
  :200-238, `evaluateTriggers` :651-722)
- `C:\Users\chiev\Documents\VAUDEVILLE\apps\rc\src\lib\lorebook\triggers\index.ts`
  (selective logic :119-211, `matchTrigger` dispatch :57-80, frequency
  wrapper :89-104)
- `C:\Users\chiev\Documents\VAUDEVILLE\apps\rc\src\lib\lorebook\triggers\keyword.ts`
  (full file: RE2 vs native regex strategy :1-149)
- `C:\Users\chiev\Documents\VAUDEVILLE\apps\rc\src\lib\lorebook\triggers\special.ts`
  (full file: dispatch table :77-129, recency :184-227, frequency
  helpers :237-273, narrative-conditional always-false :117-123,
  `SPECIAL_TRIGGER_TYPES` :342-499)
- `C:\Users\chiev\Documents\VAUDEVILLE\apps\rc\src\lib\lorebook\matching\index.ts`,
  `recursion.ts` (full file, algorithm :57-201), `scan-sources.ts` (full file),
  `character-filter.ts` (full file)
- `C:\Users\chiev\Documents\VAUDEVILLE\apps\rc\src\lib\lorebook\selection\index.ts`,
  `groups.ts` (full file), `priority.ts` (full file, budget algorithm
  :62-125), `boosting.ts` (full file)
- `C:\Users\chiev\Documents\VAUDEVILLE\apps\rc\src\lib\lorebook\runtime\state.ts`
  (full file: sticky/cooldown/delay counters, snapshot/restore :107-126)
- `C:\Users\chiev\Documents\VAUDEVILLE\packages\lorebook\src\triggers\special.ts`
  (confirmed near-identical to `apps/rc` copy, first 60 lines diffed; used to
  confirm `packages/lorebook` is the dependency-clean extraction target per
  `docs/05-EXTRACTION-MAP.md:16-31`)
- `C:\Users\chiev\Documents\vaudeville-studios\docs\05-EXTRACTION-MAP.md`
  (:16-31, packages/lore extraction source list)
- `C:\Users\chiev\Documents\vaudeville-studios\docs\00-MASTER-PLAN.md`,
  `docs\02-ARCHITECTURE.md`, `docs\06-PRODUCTION-BIBLE.md` (brief row for this
  file, line 59), `specs\formats\canonical-model.md`,
  `specs\formats\escrow-and-roundtrip.md`, `templates\SPEC-TEMPLATE.md`

OPEN QUESTION: whether the `activeContents`-seeding gap described in
`engine.ts:456-463` ("bug 23 fix," part b not yet implemented) is intentional
production behavior to replicate exactly, or a known bug that `packages/lore`
should fix outright. Needs a decision from whoever owns the VAUDEVILLE lorebook
engine before the recursion ticket is written.

OPEN QUESTION: whether `packages/lore` v1 needs engine-native
serialize/deserialize of runtime state (sticky/cooldown/delay counters,
per-trigger frequency map) for session persistence across CLI process
restarts, or whether the Productions layer (`specs/engine/productions-and-history.md`)
is expected to own that by replaying `messageCount` from scratch each launch.
VAUDEVILLE runs in a long-lived server process and never needed this.

OPEN QUESTION: which safe-regex engine `packages/lore` should bind for user
trigger patterns (RE2 via a Bun/Node-compatible binding, a pure-TS linear
regex engine, or a different ReDoS mitigation such as a matching timeout).
VAUDEVILLE uses `re2js`; whether that package is viable in the Bun/single-exe
distribution model (ADR-001/ADR-003) is unverified and should be resolved in
the M0/M5 ticket, not assumed here.

OPEN QUESTION: exact fallback behavior for `[emotion:X]` when no LLM sidecar
is present — VAUDEVILLE's regex pattern banks live in
`packages/lorebook/src/triggers/emotion.ts` (903 lines, not read in detail for
this spec pass) and were only confirmed to exist, not audited field-by-field.
A follow-up spec pass (or an addendum to this file) should map
`EMOTION_PATTERNS`/`EMOTION_BANKS` before the emotion-trigger ticket is
written, since this spec currently treats emotion matching as a black box.
