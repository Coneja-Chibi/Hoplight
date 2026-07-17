# Spec: The Table Read

**Package:** `packages/interview` · **Milestone:** M4 · **Status:** draft
**Depends on:** `specs/formats/canonical-model.md` (Character/Lorebook/Persona entity
shapes, `Entity<T>` envelope), `specs/formats/escrow-and-roundtrip.md` (deliverables are
written as normal canonical entities and therefore inherit escrow/report semantics on
first serialize), `specs/engine/key-vault.md` (`resolveRole('interview')` - the model
role this engine calls), `specs/engine/productions-and-history.md` (`writeEntity` /
`commitSnapshot` - where finished deliverables land), `specs/features/personas-system.md`
(NOT YET WRITTEN at time of this spec - the six house interviewer voices and the
persona-loading contract this engine calls through the persona voice hook; see OPEN
QUESTION 1) · **VAUDEVILLE reference:** none - the Table Read has no VAUDEVILLE
precedent; it is a wholly new component designed fresh from `docs/01-VISION.md` pillar 2,
the master plan (private planning notes)/`docs/ROADMAP.md` M4 scope, and `wireframes/magic/table-read.html`
(intent only, not a literal UI spec), per the ground-truth column in
the production bible (private planning notes) line 76.

## Purpose

The Table Read is the interview engine that creates a character (and optionally a
starter lorebook, alternate greetings, and a persona for the user) by conversation
instead of form-filling. It is `packages/interview`: a UI-agnostic event-stream engine
with zero rendering code - the CLI's interactive prompt and, later, the Studio app
(`apps/studio`, M6) both drive the exact same engine through the exact same event
protocol, per `docs/02-ARCHITECTURE.md`'s dependency rule ("the studio is forbidden from
having private engine capabilities"). It asks questions (as freeform text, quick-pick
chips, or both), reads the user's energy to decide whether to shorten or deepen the
interview, assembles a canonical `Character` (and sibling entities) live as answers
arrive, and hands the caller a finished deliverable bundle at the end. It requires an AI
key (`ModelRole: "interview"`, `specs/engine/key-vault.md`) - this is the "first AI
moment" `docs/decisions/ADR-006-ai-and-agent.md` §2 describes; everything upstream of
it (the Converter, inspect/validate) works with zero keys, but the Table Read cannot,
because generating adaptive questions and drafting prose fields is exactly what the
model does. This spec defines the event protocol, the three tempos, the adaptive-depth
heuristics, the settings surface, deliverable bundling, and the persona voice hook. It
does not define the interviewer personas themselves, the AI provider call shape, or any
rendering surface.

## Behavior

### Vocabulary

- **Session** - one Table Read run, from `startSession()` to a terminal state
  (`completed`, `abandoned`, or `errored`). One session produces at most one deliverable
  bundle.
- **Turn** - one question-answer round. A turn may consume more than one interview
  "slot" if the user's answer front-loads multiple fields at once (see Adaptive depth).
- **Field target** - a canonical field path the engine is trying to fill, expressed as
  a dotted path into the entity being assembled (e.g. `character.data.personality`,
  `character.data.alternateGreetings[1]`, `lorebook.entries[0].content`). Field targets
  are how the engine tracks completion; they are not necessarily 1:1 with questions
  (one question can target several fields, one field can take several questions to
  fill satisfactorily).
- **Living document** - the in-progress `Character` (+ sibling entities) the session is
  assembling. It exists only in engine memory until the session completes or the caller
  explicitly persists a draft (see "Crash/resume," edge case 8). The wireframe's
  "Living Card" (`wireframes/magic/table-read.html` lines 40-76) is a rendering of this
  state; the engine has no opinion on how it's drawn.

### The three tempos

Selected in session settings before `startSession()` (or defaulted); source: wireframe
"Three Tempos" gallery, `wireframes/magic/table-read.html` lines 27-36, corroborated by
`docs/ROADMAP.md` line 49 ("three tempos (Cold Read / Deep Dive / Rapid Fire)").

| Tempo | Question budget | Chip policy | Adaptive depth | Typical use |
|---|---|---|---|---|
| `cold-read` | ~5 questions, hard ceiling 8 | chips + freeform | shorten-only (never deepens past the ceiling) | "I just want to try this thing" - fastest path to a playable card |
| `deep-dive` | ~12-20 questions, adaptive | chips + freeform | full (shortens AND deepens) | the full interview: contradiction hunting, voice calibration, example-dialogue rehearsal |
| `rapid-fire` | fixed wall-clock budget (default 90s), chip count target ~30 | chips-only (freeform disabled) | none - timer-driven, not signal-driven | a timed lightning round; explicitly opts out of adaptive depth in exchange for a hard time box |

Rules:

1. `cold-read`'s adaptive depth only ever shortens (skips a planned question whose
   field target is already satisfied) - it never inserts a follow-up beyond the stated
   ceiling, because Cold Read's promise (`docs/ROADMAP.md` line 53: "Cold Read produces
   a playable card in under 5 minutes in the terminal") is a hard latency budget, not a
   quality ceiling. A contradiction detected during Cold Read is recorded on the
   deliverable's escrow-adjacent session notes (see "Deliverable bundles") for a later
   Script Doctor pass rather than interrupting the interview.
2. `rapid-fire` uses a wall-clock `progress` signal (`phase: 'gathering'`,
   `percentComplete` computed from elapsed time / budget), not a question-count signal,
   because the mode's defining property is the timer, not the count. `chips`-only means
   `AnswerEvent.freeform` is never accepted in this tempo - a `submitAnswer()` call with
   `kind: 'freeform'` during `rapid-fire` is rejected (edge case 6).
3. `deep-dive` is the only tempo where the "fixed count" settings-surface override
   (see Settings surface, below) is meaningful; `cold-read` and `rapid-fire` have their
   own fixed budgets already and ignore that setting.

### Adaptive depth heuristics

This is original engine design (no VAUDEVILLE precedent to port; licensed by the
ground-truth column in the production bible (private planning notes) line 76 to design fresh from the
wireframe's stated intent). The wireframe's worked example
(`wireframes/magic/table-read.html` lines 56, 64: "You gave me three paragraphs on her
bar, so I'll stop asking about setting" / "3, but she hates that she does it" ->
"That self-loathing generosity is the best thing she has") is the behavioral target
these heuristics are built to reproduce.

After every `AnswerEvent` (except in `rapid-fire`, which skips this step entirely - see
above), the engine makes one `ModelRole: "interview"` call to score the answer against
the **not-yet-satisfied** field targets in the session's plan. The scoring call returns
an `AnswerSignal`:

```ts
interface AnswerSignal {
  /** 0-1. How concrete/specific the answer was for the field it was asked about. */
  specificity: number;
  /** Field targets this answer already substantively addresses, beyond the one asked. */
  incidentalCoverage: FieldTargetId[];
  /** True if this answer conflicts with a prior answer already folded into the living document. */
  contradiction: { withFieldTarget: FieldTargetId; note: string } | null;
  /** True if the answer is itself a question back to the interviewer (deflection), not new content. */
  isDeflection: boolean;
}
```

Decision rules, applied in this order after every scored answer:

1. **Contradiction -> deepen.** If `contradiction` is non-null, insert one clarifying
   follow-up question targeting the conflicting field before continuing the plan. This
   follow-up is inserted regardless of remaining question budget in `deep-dive`
   (contradictions are load-bearing: an unresolved one propagates into the deliverable).
   In `cold-read`, per rule 1 above, no follow-up is inserted; the contradiction is
   logged to session notes instead.
2. **Deflection -> re-ask, do not deepen or shorten.** If `isDeflection` is true, the
   engine re-poses the same question once (optionally rephrased by the persona voice
   hook - see below) rather than treating the deflection as an answer to score against
   field targets. A second consecutive deflection on the same field target causes the
   engine to mark that field target `skipped: 'user-deflected'` and move on (a session
   must always terminate; it cannot loop forever on one question).
3. **Incidental coverage -> shorten.** For every field target named in
   `incidentalCoverage` that still has a planned question in the queue, remove that
   planned question and mark the field target `filled: 'incidental'` with the covering
   answer's text as its provisional value (subject to the same field-patch flow as a
   directly-asked answer - see Field patches, below). This is the mechanism behind the
   wireframe's "skips granted: setting (you fed it plenty)" note.
4. **Low specificity on a load-bearing field -> deepen.** Field targets are tagged
   `weight: 'load-bearing' | 'supporting'` in the question plan (load-bearing:
   `personality`, `scenario`, `firstMessage`, `exampleDialogue`; supporting: `tags`,
   `creatorNotes`, cosmetic/identity fields). If `specificity < 0.4` on a load-bearing
   field target in `deep-dive`, insert one follow-up question for that same field
   before advancing the plan. A field target is deepened at most once per session
   (no infinite deepening loop) - if the follow-up answer is also low-specificity, the
   engine accepts it, marks the field target `filled: 'accepted-vague'`, and surfaces
   that flag in the deliverable's session notes for the user (or a later Script Doctor
   pass) to revisit.
5. **Otherwise -> advance normally.** No shorten, no deepen; the next planned question
   for the next unfilled field target is asked.

`cold-read`'s fixed ceiling (8) and `deep-dive`'s "adaptive" vs. "fixed count: N"
settings-surface toggle both act as an outer bound on top of these rules: rule 1/4
insertions are skipped once the ceiling/fixed-count budget (plus a small deepening
buffer, default 2 extra questions) is exhausted, and the engine moves to wrap-up
(remaining unfilled supporting fields get a single combined "anything else?" freeform
prompt rather than individual questions).

OPEN QUESTION 2: the exact `specificity < 0.4` and buffer-of-2 constants above are this
spec's proposed defaults, not measured from any existing product - `docs/ROADMAP.md`'s
M4 exit criterion ("Deep Dive produces a card that beats a hand-written baseline in a
blind vibe-check by Chi") is a taste judgment, not a numeric target, so these constants
should be treated as tunable and revisited once real sessions exist to calibrate
against, not treated as load-bearing spec facts.

### The event stream protocol

The engine exposes one duplex channel: it emits a stream of `TableReadEvent`s, and the
caller feeds answers back in via `submitAnswer()` (a method call, not a stream event -
but every accepted answer is echoed back into the outgoing stream as an `AnswerEvent`
immediately after validation, so a UI - or a recorder building the "cold-read
transcript" fixtures below - can treat the single outgoing stream as the complete,
replayable transcript of the session without needing to separately log its own calls
into the engine). This satisfies `docs/ROADMAP.md` line 48's "question -> chips ->
answer -> field-patch events" and the production bible (private planning notes) line 76's "progress"
event, plus two lifecycle bookends and an error channel needed for any real UI to
function (session-started/session-ended/error - infrastructure, not a deviation from
the five named event kinds).

Every event carries `sessionId` and a monotonic `seq` (per-session, starting at 0) so a
UI or a test fixture can assert exact ordering and a resumed/replayed stream can dedupe.

```ts
type TableReadEvent =
  | SessionStartedEvent
  | QuestionEvent
  | ChipsEvent
  | AnswerEvent
  | FieldPatchEvent
  | ProgressEvent
  | DeliverableReadyEvent
  | SessionEndedEvent
  | ErrorEvent;
```

1. **`SessionStartedEvent`** - emitted once, first event in every session. Carries the
   resolved `TableReadSettings` (after defaults applied) so the UI never has to
   separately re-fetch what it asked for.
2. **`QuestionEvent`** - one per question actually asked (post-adaptive-depth
   filtering - a question that was skipped by rule 3 above never gets a `QuestionEvent`
   at all, it goes straight to a `FieldPatchEvent` with `source: 'incidental'`).
   Carries the interviewer's rendered question text (already passed through the
   persona voice hook - see below), the field target(s) it's aimed at, and whether
   freeform is accepted for this question (`allowFreeform`, always `false` in
   `rapid-fire`).
3. **`ChipsEvent`** - emitted immediately after a `QuestionEvent` that has quick-pick
   options, never standalone. Zero or more chips plus, when `allowFreeform` is true on
   the paired question, an implicit "write my own" affordance the UI renders itself
   (the engine does not emit a chip object for "write my own" - it's implied by
   `allowFreeform`, not a `ChipSpec`). A question with `allowFreeform: false` and zero
   chips is a contract violation the engine must never produce (edge case 9).
4. **`AnswerEvent`** - emitted once per accepted `submitAnswer()` call (the echo
   described above), after validation but before any field-patch/adaptive-depth
   processing, so a listener sees "here is what was accepted" before "here is what it
   changed."
5. **`FieldPatchEvent`** - one or more per answer, as the living document updates.
   Streaming AI-drafted fields (e.g. example dialogue being composed token-by-token,
   per the wireframe's "Example Dialogue · writing now" live block) emit a sequence of
   `status: 'writing'` patches with growing partial `value`, terminated by exactly one
   `status: 'done'` patch carrying the final value. Fields set directly from a chip
   pick or a short freeform answer typically go straight to a single `status: 'done'`
   patch. A field target that is about to be asked about but has no content yet may
   optionally get a `status: 'queued'` patch when the plan is built or re-planned, so a
   UI can render the wireframe's "Scenario · queued" placeholder before the question
   for it is even reached - this is optional (engines MAY emit it), never required for
   correctness, since `queued` carries no value and changes nothing about the living
   document.
6. **`ProgressEvent`** - emitted after every turn (question answered and its
   field-patches settled) and at phase transitions. `phase` moves
   `'gathering' -> 'assembling' -> 'reviewing' -> 'done'` monotonically (never
   backward). `'assembling'` covers any post-interview AI passes the settings surface
   requested (e.g. drafting alternate greetings not directly asked about turn-by-turn);
   `'reviewing'` is reserved for a future confirm-before-write step (see OPEN QUESTION
   3) and MAY be skipped straight to `'done'` in M4's first cut.
7. **`DeliverableReadyEvent`** - emitted once, when the deliverable bundle (see below)
   has been fully assembled and validated against the canonical schema (zod parse of
   every produced entity succeeds). Carries the bundle manifest (entity kinds produced
   + their in-memory `Entity<T>` payloads) but does NOT itself write anything to disk -
   persistence is the caller's job via `packages/productions`' `writeEntity`/
   `commitSnapshot` (see "Deliverable bundles").
8. **`SessionEndedEvent`** - always the last event of a session. `reason`:
   `'completed'` (a `DeliverableReadyEvent` preceded it), `'abandoned'` (caller called
   `abandonSession()`), or `'errored'` (an unrecoverable error occurred; an `ErrorEvent`
   with `fatal: true` immediately precedes it).
9. **`ErrorEvent`** - non-fatal errors (a single model call failed and was retried,
   a chip's referenced value failed validation) are informational and do not end the
   session; fatal errors (the model role has no key configured, the provider is
   unreachable after retries) set `fatal: true` and are always immediately followed by
   a `SessionEndedEvent` with `reason: 'errored'`.

```ts
interface BaseEvent {
  sessionId: string;
  seq: number;
  ts: string; // ISO
}

interface SessionStartedEvent extends BaseEvent {
  type: "session-started";
  settings: TableReadSettings; // resolved, post-defaults
}

type FieldTargetId = string; // dotted canonical field path, see "Field target" above

interface QuestionEvent extends BaseEvent {
  type: "question";
  questionId: string;
  turn: number; // 0-indexed
  fieldTargets: FieldTargetId[];
  text: string; // persona-voiced question text
  transitionNote?: string; // persona commentary on the PRIOR answer, e.g. wireframe's
                            // "That self-loathing generosity is the best thing she has."
  allowFreeform: boolean;
}

interface ChipSpec {
  id: string;
  label: string;       // short chip label shown to the user
  value: string;        // the literal field value this chip commits if picked
  rank: number;          // display order, 0 = most prominent (wireframe's pick/pick2/pick3 styling)
}

interface ChipsEvent extends BaseEvent {
  type: "chips";
  questionId: string;
  chips: ChipSpec[];
}

interface AnswerEvent extends BaseEvent {
  type: "answer";
  questionId: string;
  kind: "chip" | "freeform";
  chipId?: string;      // set iff kind === 'chip'
  text: string;          // the chip's value, or the freeform text as typed
}

interface FieldPatchEvent extends BaseEvent {
  type: "field-patch";
  fieldTarget: FieldTargetId;
  op: "set" | "append" | "delete";
  value?: string;                 // absent for op:'delete'
  status: "queued" | "writing" | "done";
  source: "direct-answer" | "incidental" | "ai-drafted" | "deflection-skip";
  questionId?: string;             // absent when source is 'incidental' or plan-time 'queued'
}

interface ProgressEvent extends BaseEvent {
  type: "progress";
  phase: "gathering" | "assembling" | "reviewing" | "done";
  turn: number;
  estimatedTotalTurns: number | null; // null when not estimable (e.g. rapid-fire, timer-driven)
  percentComplete: number | null;      // 0-100; null when not estimable
}

interface DeliverableReadyEvent extends BaseEvent {
  type: "deliverable-ready";
  bundle: DeliverableBundle; // see "Deliverable bundles"
}

interface SessionEndedEvent extends BaseEvent {
  type: "session-ended";
  reason: "completed" | "abandoned" | "errored";
}

interface ErrorEvent extends BaseEvent {
  type: "error";
  fatal: boolean;
  code: string;
  message: string; // human-readable, never contains raw key material (key-vault.md's never-log-keys rule)
  recoverable: boolean;
}
```

### Settings surface

Source: wireframe "The Settings Booth" (`wireframes/magic/table-read.html` lines
109-145). Settings are resolved once at `startSession()` and are immutable for the
life of the session except where noted; every field has a documented default so the
booth is fully skippable (wireframe: "every dial has a sane default; the booth is
skippable").

```ts
interface TableReadSettings {
  tempo: "cold-read" | "deep-dive" | "rapid-fire"; // default: "deep-dive"
  depthMode: "adaptive" | { fixedCount: number };   // default: "adaptive"; fixedCount only
                                                       // meaningful for tempo === "deep-dive"
  questionStyle: "chips-and-freeform" | "freeform-only" | "chips-only"; // default: "chips-and-freeform";
                                                       // forced to "chips-only" when tempo === "rapid-fire"
  interviewerPersonaId: string;                       // default: "understudy" (see persona voice hook)
  deliverables: {
    card: true;                                        // always true; a session with no card is not a Table Read
    starterLorebook: boolean;                           // default: false
    alternateGreetings: number;                          // count to draft, default: 0
    personaForUser: boolean;                             // default: false - see "Persona for you", edge case 11
  };
  targetFormat: "universal" | "chara-card-v3" | "rolecall-native"; // default: "universal" - see below
  voiceCalibration: { rehearseSampleLines: number } | { skip: true }; // default: { rehearseSampleLines: 2 }
  production?: { root: string } | { library: true };   // where the finished bundle is written; default: library mode
}
```

`targetFormat` does not change which canonical fields the engine fills - the living
document is always a full canonical `Character` regardless of target - it changes
**which optional format-specific field targets get asked about at all**. `"universal"`
(the wireframe's default-selected chip) asks only format-neutral questions (the
prompt-bearing fields listed in `specs/formats/canonical-model.md` "Design rules" #1)
plus common identity/presentation fields; `"rolecall-native"` additionally asks about
RC-only fields (tagline, palette, prompt-depth injections - see
`specs/formats/canonical-model.md` "RoleCall native" bullet) that a universal/ST-v3
target would never surface, since asking about a field the target format can't express
wastes the user's time. `"chara-card-v3"` asks about V3-only fields (nickname,
multilingual notes, `group_only_greetings`) but not RC-native ones. Regardless of
`targetFormat`, the produced entity is always the full canonical model - `targetFormat`
only affects the **question plan**, not the deliverable's shape; a later `vaud export`
against a different target format is always possible and loses nothing that was
actually asked about (any RC-native field the user never got asked about because
`targetFormat` was `"universal"` simply stays empty/default, it is not escrowed or
blocked - that is a codec-serialize-time concern, not this engine's).

"Voice calibration" (wireframe: "Rehearse 2 sample lines with me") runs after the main
interview, during `phase: 'assembling'`: the engine proposes N candidate lines of
dialogue for the character (drafted from the assembled living document) and asks the
user to pick/edit one, feeding the accepted line back in as a steer on
`exampleDialogue`/`firstMessage` drafting before those fields are finalized. This is
modeled as ordinary `question`/`chips`/`answer`/`field-patch` events like any other
turn - it is not a separate protocol.

### Deliverable bundles

Source: wireframe "What gets made" panel (`wireframes/magic/table-read.html` lines
134-141) and `docs/ROADMAP.md` line 50 ("deliverable bundles (card + starter lorebook +
alt greetings)").

```ts
interface DeliverableBundle {
  character: Entity<Character>;                 // always present
  starterLorebook?: Entity<Lorebook>;             // present iff settings.deliverables.starterLorebook
  personaForUser?: Entity<Persona>;               // present iff settings.deliverables.personaForUser
  sessionNotes: {
    unresolvedContradictions: Array<{ fieldTarget: FieldTargetId; note: string }>;
    acceptedVagueFields: FieldTargetId[];          // rule 4's "accepted-vague" outcomes
    userDeflectedFields: FieldTargetId[];          // rule 2's double-deflection outcomes
    skippedByCeiling: FieldTargetId[];              // fields never reached because the tempo's
                                                       // question budget ran out first
  };
}
```

Every produced entity is a normal `Entity<T>` per `specs/formats/canonical-model.md`
("Shared envelope") - `id` freshly assigned (ulid), `escrow: {}` (nothing to escrow yet;
the entity was never parsed from a foreign format), `meta.origin: { format: "vaud-table-read" }`.
The character's embedded lorebook reference (canonical rule: "An embedded lorebook is a
REFERENCE to a canonical Lorebook entity, not an inline blob," `canonical-model.md` line
49) points at `starterLorebook.id` when that deliverable is enabled.

Persistence is caller-driven, not engine-driven: on receiving `DeliverableReadyEvent`,
the caller (CLI command or Studio) calls `packages/productions`'
`writeEntity(production, entity)` for each entity in the bundle, then
`commitSnapshot(production, "manual", "Table Read: <character name>")` once. The engine
itself never touches the filesystem or imports `packages/productions` - this keeps
`packages/interview` UI-agnostic AND production-agnostic, consistent with the
dependency rule in `docs/02-ARCHITECTURE.md` ("`core <- formats <- everything`" - an
engine package does not reach sideways into another engine package's storage concerns).

`sessionNotes` is not written into any entity's escrow (escrow is reserved for
source-format fields per `escrow-and-roundtrip.md` rule 1 - session notes are not a
source-format field, they're this engine's own bookkeeping) and is not part of the
canonical `Character` schema either. It is returned to the caller alongside the bundle
for the caller to surface (e.g. hand off to `specs/features/script-doctor.md`'s
contradiction pass as a head start) or discard.

### Field patches and the living document

The living document is not exposed as a queryable object on the public API - callers
reconstruct it by folding the `field-patch` stream (this is deliberate: it forces every
consumer, including a future Studio app, to render from the same event log rather than
polling an ad hoc "get current state" method that could drift from what was actually
streamed). A reference fold function is provided for convenience:

`foldFieldPatches(patches: FieldPatchEvent[]): Partial<Character>` - applies patches in
`seq` order; `op: 'set'` replaces the field target's value outright (used for the final
`status: 'done'` patch of a streaming sequence, and for any single-shot patch);
`op: 'append'` concatenates onto the field target's current string value (used only for
`status: 'writing'` intermediate patches on streamed fields - a `'writing'` patch is
always `op: 'append'`, a `'done'` patch is always `op: 'set'` with the complete final
value, so a fold can also just wait for `'done'` patches and ignore `'writing'` ones
entirely if it only needs final state, not live streaming); `op: 'delete'` clears the
field target back to canonical-default/unset (used when an answer retracts something,
e.g. the user edits a previously-accepted field via the wireframe's "every field is
click-to-edit; the interview reroutes" affordance - see edge case 4).

### Persona voice hook

The Table Read's questions are voiced by an **interviewer persona** - the wireframe
shows "Understudy," "Prompter," "Props Master" as selectable interviewer personas
(`wireframes/magic/table-read.html` line 131), which are the same "house personas"
the production bible (private planning notes) line 78 assigns to `specs/features/personas-system.md`
("the six house personas fully written (Understudy, Prompter, Props Master, Director,
Stage Mother + BYO)"). This spec does NOT define persona file format, the persona
roster, or how a persona's voice/working-style/proactivity dials are authored - that is
`personas-system.md`'s job, and it is not yet written (OPEN QUESTION 1). What this spec
defines is the **hook contract** the Table Read calls through to render neutral
question content into that persona's voice:

```ts
interface QuestionSpec {
  fieldTargets: FieldTargetId[];
  neutralPrompt: string;      // the plan's plain-language question, pre-voicing
  priorAnswerSummary?: string; // what the engine wants acknowledged in a transition note
}

interface InterviewerVoiceHook {
  personaId: string;
  /** Renders one question's final text (and any chip label wording) in this persona's voice. */
  renderQuestion(spec: QuestionSpec): Promise<{ text: string; transitionNote?: string }>;
  /** Renders a single re-ask (deflection handling, rule 2) - may rephrase, must preserve the field target. */
  renderReask(spec: QuestionSpec, previousText: string): Promise<{ text: string }>;
}
```

The Table Read engine is constructed with an `InterviewerVoiceHook` implementation
(injected by the caller, sourced from `personas-system.md`'s loader once that spec
exists); `packages/interview` has no compile-time dependency on
`packages/personas`/however that package ends up named, only on this narrow interface,
so the two packages can be built and tested independently and `packages/interview`
never needs to know the persona file format. If no hook is supplied, the engine falls
back to emitting `neutralPrompt` verbatim as `QuestionEvent.text` with no
`transitionNote` (a "no persona" degraded mode - useful for engine-level testing without
`personas-system` wired up, and named explicitly here so implementers don't treat it as
an error path).

`renderQuestion`/`renderReask` are themselves `ModelRole: "interview"` calls (voicing
is generative, per the wireframe's example transition commentary) - they run as part of
the same interview model budget as the adaptive-depth scoring call, not a separate
role.

OPEN QUESTION 1: the exact shape of `personas-system.md`'s persona loader (how a
`personaId` string resolves to voice/tone instructions the hook implementation feeds
into its model call, and what "BYO" persona authoring looks like) is undefined until
that spec is written. This spec's `InterviewerVoiceHook` interface is the stable
integration seam regardless of how that resolves.

## Public API sketch

```ts
// packages/interview/src/index.ts

import type { Character, Lorebook, Persona, Entity } from "@vaudeville/core";
import type { ModelRole } from "@vaudeville/ai"; // key-vault.md

export type TableReadTempo = "cold-read" | "deep-dive" | "rapid-fire";

export interface TableReadSettings {
  tempo: TableReadTempo;
  depthMode: "adaptive" | { fixedCount: number };
  questionStyle: "chips-and-freeform" | "freeform-only" | "chips-only";
  interviewerPersonaId: string;
  deliverables: {
    card: true;
    starterLorebook: boolean;
    alternateGreetings: number;
    personaForUser: boolean;
  };
  targetFormat: "universal" | "chara-card-v3" | "rolecall-native";
  voiceCalibration: { rehearseSampleLines: number } | { skip: true };
  production?: { root: string } | { library: true };
}

export interface InterviewerVoiceHook {
  personaId: string;
  renderQuestion(spec: QuestionSpec): Promise<{ text: string; transitionNote?: string }>;
  renderReask(spec: QuestionSpec, previousText: string): Promise<{ text: string }>;
}

export interface TableReadEngineOptions {
  modelRole?: ModelRole; // default: "interview"
  voiceHook?: InterviewerVoiceHook; // omit for the degraded "no persona" mode
  seed?: number; // deterministic chip ordering / test fixtures only; never affects model output
}

export class TableReadSession {
  readonly id: string;
  readonly settings: TableReadSettings;

  /** Subscribe to the outgoing event stream. Multiple subscribers allowed (fan-out, e.g. a UI + a logger). */
  on(listener: (event: TableReadEvent) => void): () => void; // returns an unsubscribe function

  /** Submit an answer to the current open question. Rejects (ErrorEvent, non-fatal) if
   *  questionId does not match the currently open question, or if kind:'freeform' is
   *  submitted while questionStyle forbids freeform for the current tempo/question. */
  submitAnswer(questionId: string, answer: { kind: "chip"; chipId: string } | { kind: "freeform"; text: string }): Promise<void>;

  /** Directly edits an already-answered field target (wireframe: "every field is
   *  click-to-edit; the interview reroutes"). Emits a field-patch (op:'set') and may
   *  re-open follow-up questions if the edit reintroduces a contradiction. */
  editField(fieldTarget: string, value: string): Promise<void>;

  /** Ends the session early without producing a deliverable. Emits SessionEndedEvent(reason:'abandoned'). */
  abandonSession(): Promise<void>;

  /** Convenience: folds every field-patch event seen so far into a partial Character. */
  currentDraft(): Partial<Character>;
}

/** Starts a new session. Resolves once SessionStartedEvent has been emitted (not once
 *  the session completes - callers drive it forward via submitAnswer as events arrive). */
export function startSession(
  settings: Partial<TableReadSettings>,
  options?: TableReadEngineOptions
): Promise<TableReadSession>;

export function foldFieldPatches(patches: FieldPatchEvent[]): Partial<Character>;
```

## Edge cases & failure modes

1. **No AI key configured (`resolveRole('interview')` returns `null`).**
   `startSession()` rejects before emitting `SessionStartedEvent` at all (there is no
   partial session to abandon) with a typed error naming this the "first AI moment" -
   the caller (CLI) is responsible for the first-key-ask UX per
   `docs/decisions/ADR-006-ai-and-agent.md` §2; the engine itself does not prompt for
   a key (`packages/interview` has no UI).
2. **The model call backing adaptive-depth scoring or persona voicing fails
   transiently (network error, rate limit).** One retry with backoff; on continued
   failure, emit a non-fatal `ErrorEvent` and fall back to rule 5 (advance normally, no
   shorten/deepen) for that turn rather than blocking the session - a scoring failure
   degrades the interview's smartness, it must never stall it.
3. **The model call backing question/chip generation itself fails (not just
   scoring).** This is more serious - there is no question to ask. Retry once; on
   continued failure, emit a fatal `ErrorEvent` and end the session with
   `reason: 'errored'`. `currentDraft()` remains available on the (now-ended) session
   object so the caller can offer "save what we have" rather than losing the partial
   interview outright (see edge case 8).
4. **User edits an already-answered field via `editField()`, and the new value
   contradicts a later answer that was built on the old one** (e.g. editing personality
   after the engine already drafted example dialogue that assumed the old
   personality). `editField` re-runs the adaptive-depth contradiction check (rule 1)
   against every field target marked `filled` that came AFTER the edited one in
   answer order; any conflict re-opens exactly one follow-up question for the affected
   downstream field (same mechanics as a normal mid-interview contradiction), it does
   not silently leave stale content in place.
5. **`depthMode: { fixedCount: N }` where N is smaller than the number of load-bearing
   field targets alone.** The engine still asks about every load-bearing field at least
   once (load-bearing fields are never skipped by a fixed-count budget, only supporting
   ones are) - `fixedCount` is a target for the TOTAL question count, honored on a
   best-effort basis by trimming supporting-field questions first, then by combining
   remaining supporting fields into the wrap-up "anything else?" prompt described under
   Adaptive depth; it is never honored by dropping a load-bearing field silently.
6. **`submitAnswer()` called with `kind: 'freeform'` during `rapid-fire`, or when the
   current question's `allowFreeform` is `false`.** Rejected: non-fatal `ErrorEvent`,
   the currently open question remains open, no `AnswerEvent`/field-patch is emitted.
7. **`submitAnswer()` called with a `questionId` that does not match the currently
   open question** (stale UI, double-submit, answering out of order). Rejected the same
   way as edge case 6 - the engine only ever has one open question per session (no
   concurrent questions in v1; see Non-goals).
8. **Process crash / app close mid-session.** `packages/interview` has no built-in
   persistence (Non-goals) - an in-progress session's state lives only in engine memory
   and `on()` listeners. A caller that wants crash recovery must itself persist
   `currentDraft()` (and enough settings/turn state to reconstruct a fresh session
   continuing from there) via `packages/productions`, e.g. as a WIP entity file; this
   engine does not do that automatically. OPEN QUESTION 3: whether M4 needs a
   first-class "resume a Table Read session" capability (would require the engine to
   expose/accept a serializable session-state snapshot, not just field-patches) or
   whether M4 ships "crash = start over" and resumability is deferred - the roadmap's
   M4 exit criterion doesn't mention resume, so this spec treats it as out of scope for
   the first cut, flagged here rather than silently assumed.
9. **A `QuestionEvent` with `allowFreeform: false` and a paired `ChipsEvent` carrying
   zero chips.** A contract violation the engine must never produce - every question
   must offer at least one way to answer it. If a question-planning step would produce
   this (e.g. an AI-generated chip set came back empty), the engine falls back to
   `allowFreeform: true` for that question rather than emitting a dead-end question,
   even under `questionStyle: 'chips-only'` (an unanswerable question is worse than a
   one-off style violation; this fallback should be rare and is itself worth a
   non-fatal `ErrorEvent` for visibility).
10. **`deliverables.starterLorebook: false` but the interview naturally surfaces
    lorebook-shaped content** (the user volunteers backstory that reads like a lore
    entry, e.g. "she runs a bar called The Ledger"). The engine does not create a
    lorebook entity when the setting is off, regardless of content shape - that
    content stays in the `Character`'s prose fields (description/scenario) only. This
    keeps deliverable composition purely settings-driven, not content-inferred, so the
    bundle a session produces is always predictable from its settings alone.
11. **`deliverables.personaForUser: true`.** Produces a canonical `Persona` entity
    representing the USER's roleplay persona (per `specs/formats/canonical-model.md`'s
    `Persona` content type), asked about via a short separate mini-plan appended after
    the character interview proper (distinct field targets, namespaced
    `persona.data.*` rather than `character.data.*`) - this is NOT the same concept as
    the "interviewer persona" (`interviewerPersonaId`) that voices the questions; the
    two uses of the word "persona" in this feature must not be conflated by an
    implementer (see Non-goals).
12. **Target format is `rolecall-native` but a RC-native field's answer is a chip pick
    that turns out empty/whitespace-only** (user picks a chip with an empty value,
    which should not exist by construction, but a malformed AI-generated chip set
    could produce one). The engine rejects the chip pick as if it were edge case 6
    (non-fatal error, question stays open) rather than committing an empty field-patch
    - mirrors the general principle that a `field-patch` must always carry meaningful
    content or be `status: 'queued'`/an explicit `op: 'delete'`, never an accidental
    empty `'done'` patch.
13. **Two subscribers call `submitAnswer()` for the same open question concurrently**
    (e.g. a UI double-click race). The engine processes accepts in call order and
    rejects the second with edge case 7's "questionId does not match the currently
    open question" error the instant the first is accepted (the open question changes
    synchronously the moment the first `submitAnswer` is accepted, before any async
    model work for the resulting field-patches begins) - no duplicate `AnswerEvent`s
    for one question.

## Test plan

Fixtures required (new corpus under `fixtures/table-read/`, each a scripted transcript:
settings + a scripted sequence of scored mock-model responses (chip generation, answer
scoring, voicing) + the expected exact event sequence, since the model calls themselves
must be mocked/deterministic for a reproducible test - no live provider calls in CI,
consistent with `docs/03-CONVENTIONS.md`'s "Deterministic tests only: no network, no
clock, no randomness without a seed"):

- `cold-read-five-questions.json` - happy path, no contradictions, no deflections,
  asserts exactly the ceiling-respecting question count and a `DeliverableReadyEvent`
  with a fully-populated `Character`.
- `cold-read-ceiling-with-incidental-coverage.json` - an early rich answer triggers
  rule 3 (shorten), asserting the skipped question never emits a `QuestionEvent` and
  its field target's patch has `source: 'incidental'`.
- `deep-dive-contradiction-deepens.json` - a later answer's mock `AnswerSignal` sets
  `contradiction`, asserting exactly one inserted follow-up `QuestionEvent` targeting
  the conflicting field target, and that the follow-up counts against the fixed-count
  budget if one is set (edge case 5's best-effort trimming order).
- `deep-dive-low-specificity-deepens-once.json` - a load-bearing field scored below the
  0.4 threshold twice in a row; asserts exactly one follow-up (never a second), and
  that the field target ends `filled: 'accepted-vague'` with the flag surfaced in
  `sessionNotes.acceptedVagueFields`.
- `deep-dive-deflection-then-skip.json` - two consecutive `isDeflection: true` scores
  on the same field target; asserts one re-ask (`renderReask` called), then
  `skipped: 'user-deflected'` and `sessionNotes.userDeflectedFields` populated, no
  infinite loop.
- `rapid-fire-timer-driven-progress.json` - asserts `ProgressEvent.estimatedTotalTurns`
  is `null` and `percentComplete` is computed from a mocked clock, not question count;
  asserts a `submitAnswer(kind:'freeform')` call is rejected (edge case 6).
- `settings-target-format-universal-vs-rolecall-native.json` - same mock answer bank,
  two sessions differing only in `targetFormat`; asserts the `rolecall-native` session
  asks strictly more (RC-only) questions and the `universal` session's resulting
  `Character` still validates against the full canonical schema with RC-native fields
  left at default.
- `deliverable-bundle-full.json` - all four `deliverables` flags on; asserts
  `DeliverableBundle` contains `character`, `starterLorebook`, `personaForUser`, the
  right count of alternate greetings, and that `character.data.characterBook`
  references `starterLorebook.id` (canonical-model.md's "embedded lorebook is a
  reference" rule).
- `field-edit-reopens-downstream-contradiction.json` - exercises `editField()` and edge
  case 4's re-check.
- `no-voice-hook-degraded-mode.json` - constructs a session with no `voiceHook`,
  asserts `QuestionEvent.text === neutralPrompt` verbatim and no `transitionNote`.
- `question-with-no-freeform-and-empty-chips-falls-back.json` - exercises edge case 9's
  forced fallback to `allowFreeform: true`.
- `stale-questionid-rejected.json`, `freeform-during-chips-only-rejected.json` -
  exercise edge cases 6/7 directly.
- `model-call-transient-failure-degrades-gracefully.json` - mocked scoring call throws
  once then the session continues per rule 5 (edge case 2); a companion
  `model-call-question-generation-fails-fatally.json` for edge case 3's
  `reason: 'errored'` path.

Round-Trip Law applicability: none directly - `packages/interview` is not a format
codec and produces fresh entities rather than parsing existing files. However, every
fixture's produced `Character`/`Lorebook`/`Persona` entities must independently pass
`packages/core`'s zod validation (a produced entity that fails canonical schema
validation is a test failure, since `DeliverableReadyEvent` claims validation already
happened).

Property/unit tests beyond fixtures:

- `foldFieldPatches` is idempotent and order-sensitive: replaying the same patch
  sequence twice produces the same result; reordering `'writing'` patches within one
  field target's streaming sequence (out of `seq` order) must be rejected/ignored by
  a correctness test, not silently accepted, since `op:'append'` is order-dependent.
- Every `TableReadEvent.seq` within a session is strictly increasing with no gaps,
  checked as a generic property across every fixture transcript (not fixture-specific).
- `depthMode: { fixedCount: N }` never results in a load-bearing field target being
  skipped, generated-property test over randomized mock answer banks (edge case 5).
- Adaptive-depth rule ordering (contradiction before deflection before incidental
  coverage before low-specificity) is exercised directly as a unit test against the
  decision function in isolation, independent of the full session/event-stream
  machinery, so the ordering itself is pinned regardless of fixture coverage gaps.

## Non-goals

- Does not define the interviewer persona roster, persona file format, or the persona
  loader - `specs/features/personas-system.md`'s job; this spec only fixes the
  `InterviewerVoiceHook` call contract (see OPEN QUESTION 1).
- Does not define the CLI or Studio rendering of the event stream (chat bubbles, the
  "Dark Room" full-screen reveal-at-end variant, the settings booth's actual widgets)
  - those are UI concerns downstream of this UI-agnostic engine; the wireframe's three
  mockups (Living Card / Dark Room / Settings Booth,
  `wireframes/magic/table-read.html`) are intent references for what a UI built on
  this protocol COULD look like, not additional protocol requirements. Notably, the
  Dark Room variant ("reveal at the end") requires no protocol change at all - it is
  achievable by a UI that simply chooses not to render `field-patch` events live and
  only renders the final `DeliverableReadyEvent`; the engine does not need a
  "dark room mode" setting.
- Does not implement `packages/ai`'s provider adapters, streaming transport, or the
  key vault - consumes `ModelRole: "interview"` via `specs/engine/key-vault.md`'s
  `resolveRole()` and whatever `specs/engine/provider-adapters.md` (not yet written)
  defines for making the actual model call; this spec treats "make a scored/voiced
  model call" as a capability it depends on, not one it implements.
- Does not persist sessions or implement resume-after-crash (OPEN QUESTION 3) in this
  cut.
- Does not implement the Script Doctor's contradiction/slop passes - `sessionNotes`
  is a head start handed to `specs/features/script-doctor.md`, not an overlapping
  implementation of it. The Table Read's own contradiction detection (rule 1) is
  narrowly scoped to conflicts introduced WITHIN one interview session, not a general
  audit of the finished card.
- Does not support multiple concurrent open questions in one session (edge case 7);
  the protocol is strictly one-question-at-a-time.
- Does not define `vaud table-read` CLI grammar (flags, `--json` shape, exit codes) -
  a future CLI-facing spec's concern, analogous to how `cli-converter.md` covers
  `vaud convert` separately from the codec specs it calls.

## Sources consulted

- `docs\the master plan (private planning notes)` (full file) -
  pillar/milestone framing, "M4 The Table Read (v0.3)" line 53, "packages/interview"
  reference via the layer description, locked decisions table (AI/BYOK row).
- `docs\01-VISION.md` (full file) -
  pillar 2 ("The interview is the editor," lines 22-24: adaptive depth, quick-pick
  chips, artifact assembling visibly), taste bar (line 45-48, M4 exit criterion's
  qualitative bar).
- `docs\ROADMAP.md` lines 46-55 ("M4 - The
  Table Read (v0.3)": event stream shape "question -> chips -> answer -> field-patch
  events," three tempos named, adaptive depth, settings, persona voices, deliverable
  bundles, and the two exit criteria quoted verbatim in this spec's Purpose/tempos
  sections).
- `docs\02-ARCHITECTURE.md` lines 31-32
  (`packages/interview` package description: "question planner, modes/depth, chip
  generation, living-document event stream. UI-agnostic"), lines 42-43 (dependency
  rule quoted in "Deliverable bundles"), lines 78-83 (Faces: CLI-first, Studio
  forbidden from private engine capabilities - basis for this spec's UI-agnosticism
  requirement).
- `docs\decisions\ADR-006-ai-and-agent.md`
  (full file) - §1 (BYOK provider list), §2 ("AI is optional... first key ask happens
  at the first AI moment" - basis for edge case 1), §4 (model roles: "Interview,
  treatment rewrites, test-stage inference, and bulk audits can each point at a
  different configured model" - basis for `ModelRole: "interview"` usage throughout).
- `docs\03-CONVENTIONS.md` (full file) -
  "Deterministic tests only: no network, no clock, no randomness without a seed" (Test
  plan's mocked-model-call requirement), no-emoji/no-em-dash house style, CLI output
  vocabulary note ("Flavor lives in the agent personas, not in scriptable command
  output" - informs why the persona voice hook is opt-in/hookable rather than baked
  into the engine's own event text).
- `docs\the production bible (private planning notes)` line 76
  (this file's own brief row, quoted in full at the top of this document) and the
  global rules section (lines 7-25).
- `specs\formats\canonical-model.md` (full
  file) - `Entity<T>` envelope (lines 13-29, used for `DeliverableBundle`'s entity
  shape), Character design rules (lines 42-50, used for `targetFormat`'s
  universal-vs-native question-plan distinction and the "embedded lorebook is a
  reference" rule cited in the deliverable-bundle test fixture), Lorebook/Persona
  content-type listing (line 9).
- `specs\formats\escrow-and-roundtrip.md`
  (full file) - confirmed `sessionNotes` is not an escrow concept (rule 1 is about
  source-format fields; a Table Read session has no source format) and that produced
  entities carry empty escrow at creation time.
- `specs\engine\key-vault.md` (full file)
  - `ModelRole` type (line 196) and `resolveRole()` contract (lines 264, 331-333) used
  directly in this spec's `TableReadEngineOptions.modelRole` and edge case 1.
- `specs\engine\productions-and-history.md`
  (full file) - `writeEntity`/`commitSnapshot` API (lines 324-350) used in "Deliverable
  bundles" to define the caller-driven persistence boundary; confirmed this engine
  must not import `packages/productions` directly (dependency-rule cross-check against
  `02-ARCHITECTURE.md` line 42).
- `specs\engine\lorebook-engine.md` (full
  file) - read as a style/rigor precedent for a fresh-design, non-codec engine spec in
  this same suite (event/trace object shapes, edge-case numbering density, fixture
  naming conventions); no factual claims taken from it for this spec's actual content.
- `specs\engine\productions-and-history.md`
  - also read in full as a second style precedent for a "no VAUDEVILLE reference,
  design fresh from the architecture doc" spec (same category as this one).
- `templates\SPEC-TEMPLATE.md` (full file)
  - structure followed section-by-section.
- `wireframes\magic\table-read.html` (full
  file) - primary intent source per the brief's ground-truth column: three tempos
  gallery (lines 27-36), "TR-1 The Living Card" mock (lines 40-76, source of the
  worked adaptive-depth example quoted in this spec and the field-patch
  queued/writing/done status model), "TR-2 The Dark Room" mock (lines 78-107, cited in
  Non-goals to explain why no protocol change is needed for that UI variant), "TR-3
  The Settings Booth" mock (lines 109-145, direct source of the `TableReadSettings`
  shape: tempo, adaptive depth vs. fixed count, question style, interviewer persona,
  deliverables, target format, voice calibration).
- Confirmed via `Glob`/`Grep` that `specs/features/personas-system.md`,
  `specs/engine/agent-loop.md`, and `specs/engine/provider-adapters.md` do not yet
  exist in this repo at spec-writing time (checked directory listings directly) -
  basis for OPEN QUESTION 1 and the Non-goals note on provider-adapter dependence
  being forward-referenced rather than grounded in an existing file.

OPEN QUESTION 1: `specs/features/personas-system.md` does not exist yet. This spec's
`InterviewerVoiceHook` interface is written as a stable seam that should not need to
change once that spec lands, but the exact persona-loading call (how `personaId`
resolves to voice instructions) is unverified against anything and should be
cross-checked once `personas-system.md` is written.

OPEN QUESTION 2: the numeric adaptive-depth constants (`specificity < 0.4` threshold,
deepening buffer of 2 extra questions, Cold Read ceiling of 8, Rapid Fire default of
90 seconds / ~30 chips) are this spec's proposed defaults grounded in the wireframe's
stated counts (~5 questions Cold Read, ~12-20 Deep Dive, 30 chips/90s Rapid Fire) where
the wireframe states them, and are this spec's own invention where it does not
(specificity threshold, deepening buffer). They should be treated as tunable
configuration, not fixed behavioral contracts, and revisited once M4 has real session
data to calibrate against.

OPEN QUESTION 3: whether M4 requires session persistence/resume-after-crash, or
whether "crash = start over" is acceptable for the first cut. Not addressed by
`docs/ROADMAP.md`'s M4 exit criteria; needs a decision before the M4 ticket list is
sized, since it changes whether `packages/interview` needs a serializable session-state
export at all (currently it does not, per Non-goals).
