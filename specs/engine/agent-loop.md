# Spec: The Agent Loop

**Package:** `packages/agent` · **Milestone:** M2 · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/engine/prompt-assembly.md (OPEN: not yet written, referenced conceptually for
the assembly package the agent hands to test-stage/interview flows),
specs/engine/provider-adapters.md (OPEN: not yet written, this spec assumes its
`ChatRequest`/`ChatResponse`/streaming contract from ADR-006 and consumes it as a
black box), specs/engine/key-vault.md (OPEN: not yet written, this spec assumes
provider credentials are resolved before a `ChatRequest` reaches the loop and never
handles key material itself)
**VAUDEVILLE reference:** `apps/rc/src/lib/ai/btw/` (loop.ts, spill.ts, registry.ts,
tool-approval.ts, tool-contract.ts, tools/meta-tools.ts, tools/domains.ts,
tools/creator-draft-tools.ts, context/eviction.ts): reference reading only, conceptual
lessons from RoleCall's Orison program. Nothing is ported; VAUDEVILLE is a Next.js/
Supabase server product with a browser client, a per-thread Postgres-backed spill
table, and a panel UI with confirm modals. Vaudeville Studios is a local CLI/desktop
tool with no server, no Postgres, no browser. Every mechanism below is reconceived for
a local filesystem and a terminal/REPL front end.

## Purpose

The agent loop is the turn driver that runs `vaud`'s bare-invocation REPL and any
agent-backed feature (Script Doctor's AI treatment, Table Read's interview engine,
Archives distillation, World Forge). It takes a user message plus session state, calls
a configured model through the provider adapter, dispatches any tool calls the model
makes, and yields events until the model produces a final answer or the turn is
paused for user input. It is designed to survive weak/local models, not just frontier
ones: a tiny always-on tool surface, resource verbs instead of dozens of noun-tools,
a spill store so large tool results never bloat context, and staged edits so the agent
never mutates a user's production files without a review step. This package has zero
UI: it exposes an event stream that `apps/cli` renders to a terminal and that
`apps/studio` (M6) will render to a panel, per the Faces rule in
`docs/02-ARCHITECTURE.md`.

## Behavior

### Actors and scope

- **Turn**: one call from a user message to the loop reaching a terminal state
  (`done`, `paused_for_input`, or `error`). A turn may involve many model calls and
  tool dispatches internally (the iteration loop below).
- **Session**: the CLI/studio-owned conversation state across turns: message history,
  active production (if any), model-role bindings (interview/treatment/test/audit,
  ADR-006 §4), approval policy, and the spill directory. The agent package does not
  persist sessions; the caller (CLI REPL, or a studio IPC handler) owns persistence
  and passes session state in, gets updated session state out.
- **Production** (specs/engine/productions-and-history.md, not yet written): the
  workspace the agent's resource verbs and staged edits operate against. Outside a
  production the agent still runs (e.g. answering questions, converting a bare file)
  but write tools that need a production target return a `no_production` error.

### State machine

```
                 ┌───────────────────────────────────────────┐
                 │                 idle                       │
                 └───────────────┬───────────────────────────┘
                                  │ runTurn(input)
                                  ▼
                 ┌───────────────────────────────────────────┐
            ┌───▶│           assembling_context               │
            │    └───────────────┬───────────────────────────┘
            │                    │ system prompt + history + persona built
            │                    ▼
            │    ┌───────────────────────────────────────────┐
            │    │            calling_model                    │
            │    └───────────────┬───────────────────────────┘
            │                    │ ChatResponse (native tool_calls,
            │                    │ prompted-XML tool block, or plain text)
            │                    ▼
            │    ┌───────────────────────────────────────────┐
            │    │        no tool calls? ──yes──▶ done         │
            │    │        (final text answer)                  │
            │    └───────────────┬───────────────────────────┘
            │                    │ no (tool_calls present)
            │                    ▼
            │    ┌───────────────────────────────────────────┐
            │    │          dispatching_tools                  │
            │    │  for each call: resolve name/alias, check   │
            │    │  approval class, execute or request approval│
            │    └───────────────┬───────────────────────────┘
            │           ┌────────┴─────────┐
            │           │                   │
            │  approval required     all auto-approved
            │           │                   │
            │           ▼                   │
            │  ┌──────────────────┐         │
            │  │ paused_for_input  │         │
            │  │ (approval prompt) │         │
            │  └──────────────────┘         │
            │           │ user approves/denies (resumeTurn)
            │           ▼                   │
            │    ┌───────────────────────────────────────────┐
            │    │      results appended to history            │
            └────┤      (spilled if oversized, deferred        │
                 │       tools revealed if a meta-tool fired)   │
                 └───────────────┬───────────────────────────┘
                                  │ iteration count < cap, no loop-detector trip
                                  └──────────────▶ back to calling_model
                                  │ iteration cap reached, or loop detected,
                                  │ or model emits empty content + no tool_calls
                                  ▼
                       ┌───────────────────┐
                       │   error / paused    │
                       └───────────────────┘
```

Terminal states surfaced to the caller: `done` (final assistant text, optionally with
a staged-edit summary), `paused_for_input` (either a clarifying question from the
model, or an approval gate: the event carries which), `error` (loop cap hit, loop
detector trip, provider error surfaced after retries exhausted: see
provider-adapters.md for retry policy, OPEN pending that spec).

### Always-on tool surface

The loop starts every turn with a small fixed set of tools visible to the model. VAUD
reference used four `consult_<domain>` meta-tools plus a catch-all search
(`tools/meta-tools.ts:1-17`) because Berkeley Function-Calling Leaderboard data shows
tool-selection accuracy collapses past roughly 50 concurrently loaded tool schemas
(cited in that file's header). Vaudeville Studios adopts the same shape with a
studio-appropriate domain list:

- `consult_files`: reveals the `vaud://` resource-verb tools (ls/read/write/search).
- `consult_editing`: reveals staged-edit tools (draft/validate/approve/commit) scoped
  to the canonical content types (character/lorebook/preset/persona/regex).
- `consult_doctor`: reveals Script Doctor audit/treatment tools (M3+; registered but
  inert until that package exists).
- `consult_conversion`: reveals convert/inspect/validate tool wrappers around the
  CLI's own commands, so the agent can drive `vaud convert` semantics without shelling
  out.
- `tool_search`: free-text catch-all across every registered tool, for anything the
  four domains don't cover or when the model doesn't know which domain to ask.

Calling a `consult_*` or `tool_search` tool does two things in one round trip: it
returns a text tool list to the model (readable, so a prompted-XML weak model can
parse it), and it signals the loop to inject the matching tool schemas as callable on
the NEXT iteration. This mirrors the reveal mechanic in
`tools/meta-tools.ts:1-17,47-65` and `tool-contract.ts:1-40`, reconceived without the
`AgentRole`/`BTWEnabledFeatures` product concepts VAUD's build carries (Vaudeville
Studios has no accounts or feature flags). A reveal is scoped to the rest of the
current turn; the next turn starts back at the tiny surface. Calling a `consult_*`
tool twice in the same turn is a no-op after the first call (the reveal already
stuck): the loop returns the same tool list without a second provider round trip.

### Resource model: `vaud://` URIs

Instead of one bespoke tool per file kind, the agent exposes four verbs over a URI
space, per `docs/02-ARCHITECTURE.md`'s "Resource model over noun-tools" line:

- `vaud://production/<relative-path>`: files inside the active production.
- `vaud://fixtures/<relative-path>`: read-only, the fixture corpus (useful when the
  agent is asked to explain format behavior; write verbs reject this scheme).
- `vaud://settings/<key>`: read-only session/config surface (model-role bindings,
  approval policy) excluding any secret material: the vault never surfaces through
  this URI space (ADR-006 §1, "never-log-keys").

Verbs:

- `ls(uri, opts?)`: list directory entries or, for a single canonical file, its
  addressable sub-paths (e.g. a character's `alternateGreetings[2]`) if the codec
  supports structural addressing. Returns names + kind (`file`/`dir`/`field`), no
  content.
- `read(uri, opts?)`: returns file content or a canonical-field slice. Text over the
  inline cap (see Spill store) spills automatically; `read` itself never returns a
  handle-only stub, `ls`/`search` do for oversized listings.
- `write(uri, payload, opts?)`: the fourth verb named in `docs/02-ARCHITECTURE.md`
  line 60. It never mutates the target file directly. A `write` against
  `vaud://production/<path>` is sugar over the staged-edit envelope: it opens (or
  updates, if one is already open for that target) a `draft` envelope for the
  content type implied by the path and returns the draft id, exactly as if the
  model had called the matching `draft_*` tool from `consult_editing`. `write`
  against `vaud://fixtures/...` or `vaud://settings/...` is rejected (read-only
  schemes). This keeps the four-verb resource model intact while preserving the
  never-mutate-directly invariant by construction: there is no code path from
  `write` to a file on disk that skips validate/approve/commit, because `write`
  IS the draft-creation front door, not a bypass of it.
- `search(uri_prefix, query, opts?)`: grep-shaped search scoped to a URI prefix;
  returns matches with enough context to decide whether to `read` further, spills the
  full match list if it exceeds the inline cap.

Weak models drive four verbs instead of memorizing which of fifty named tools reads a
lorebook entry versus a preset prompt; this is the same argument VAUD's
`docs/02-ARCHITECTURE.md:59-60` makes and the same one `tools/domains.ts` implements
by grouping VAUD's many concrete tools under discoverable domains (VAUD's own concrete
tools remain noun-shaped internally: `read-character.ts`, `read-preset.ts`, etc.,
and the resource model here folds that pattern one level further, to actual verbs, since
Vaudeville Studios' canonical model gives every content type a uniform shape to
address).

### Spill store

Any tool result whose content exceeds the inline cap is written to a per-session spill
directory instead of returned inline, mirroring VAUD's `spill.ts:1-22` design (there,
Postgres-backed with a 24h TTL and pg_cron sweep; here, filesystem-backed since there
is no server):

- Location: `<production>/.vaud/spill/<session-id>/<handle>` when a production is
  active; `<os-tmp>/vaud-agent/<session-id>/<handle>` otherwise. Never inside
  `.vaud/history/` (history is content-addressed snapshots of user content, not
  scratch tool output).
- Inline caps: same order of magnitude as VAUD's constants (`INLINE_CHAR_CAP = 4096`,
  `INLINE_TOKEN_CAP = 1024`, `spill.ts:21-22`): adopted as the starting default,
  tunable per session. OPEN QUESTION: whether Vaudeville Studios ships the identical
  numeric constants or retunes them once the eval harness (M2, ADR-006 §5) has data;
  this spec does not invent a different default without that evidence.
- Handle naming: stable per (tool name, dedup key) within a session so a tool re-run
  with the same effective query overwrites its own spill file rather than
  accumulating garbage: same intent as VAUD's upsert-on-`(thread_id, name)` in
  `spill.ts:49-61`, reimplemented as a delete-then-write against the filesystem path
  (no concurrent-writer race to guard since the local loop is single-process and
  single-threaded per session).
- Peek: the inline result returned to the model is a short peek (first N lines/chars)
  plus the handle name and total size/line count, never a bare "see handle X" with
  zero content: the model needs enough to decide whether to navigate further.
- Navigation tools (revealed under `consult_files` once a spill exists in-session):
  `spill_grep(handle, pattern)`, `spill_read(handle, opts?: {offset, limit})`,
  `spill_stat(handle)`. These are the local equivalents of VAUD's `tmp_grep`/
  `tmp_read`/`tmp_stat` (`spill.ts:6-9`).
- TTL: spill files are session-scoped and deleted when the session ends normally.
  Orphans (crashed process) are swept on next CLI startup by mtime, default 24h,
  the same TTL VAUD uses, reused here because it is a reasonable default rather than a
  literal constraint, since there is no cron; the CLI's own startup does the sweep.

### Context eviction (compaction is OPEN QUESTION)

This section covers eviction only: stubbing out stale tool results in place. Full
history summarization/compaction (rewriting old turns into a condensed narrative
rather than stubbing them) is OPEN QUESTION for M2; it is not designed here and this
spec does not assume it exists. If a caller needs it before M2 ships, treat it as a
follow-up spec, not an extension of this section.

Long sessions accumulate tool-result bulk in message history even after spilling
(the inline peeks add up). Once a real user turn has passed `keepTurns` more times,
older tool results are replaced with a short stub naming the tool and inviting a
re-call, mirroring VAUD's `context/eviction.ts:1-17`:

- A "real user turn" = a user-role message that is not itself a tool-result envelope.
  VAUD detects this by checking whether prompted-mode content starts with
  `<tool_result` (`context/eviction.ts:10-11,41-47`); this spec keeps that detection
  rule for the prompted-XML fallback path (see provider-adapters.md, OPEN) and uses
  the provider adapter's own `role: "tool"` messages for the native tool-calling path.
- Default `keepTurns = 4`, default `maxResultChars = 12000` before tail-truncation
  kicks in for a result that's recent-but-oversized rather than evicted outright,
  the same defaults as `context/eviction.ts:26-27`, carried over as a starting point
  pending eval-harness tuning (ADR-006 §5).
- Eviction is pure and idempotent: given the same history twice, evicting produces
  the same result both times, and an already-evicted stub is left untouched (matches
  `context/eviction.ts:15-16`). This is a hard requirement, not a nice-to-have: the
  loop may re-run eviction on every iteration rather than tracking what it already
  evicted, and idempotency is what makes that cheap and safe.

### Staged-edit envelope

The agent never writes a user's production file directly (ADR-006 §3, "Staged edits
with validate-before-commit"). Every content mutation goes through an envelope with
this lifecycle:

```
draft ──validate──▶ validated ──approve──▶ approved ──commit──▶ committed
  │                     │                                          
  └──dismiss──────────────────────────────────────────────▶ dismissed
```

- **draft**: the agent calls a draft tool (e.g. `draft_character`,
  `draft_lorebook_entry`) with a canonical-shaped payload (or a patch against an
  existing entity). The tool writes a draft envelope, does NOT touch the target file.
  Conceptually this is VAUD's `creator_draft` envelope
  (`tools/creator-draft-tools.ts:26-39`: `kind`, `content_type`, `payload`,
  `updated_at`, `status: open|committed|dismissed`) reused with a `validated` status
  inserted before `approved`, because Vaudeville Studios' canonical model has a real
  zod schema to validate against (`specs/formats/canonical-model.md`) where VAUD's
  in-chat drafts validate against looser, panel-specific shapes.
  content_type set is the canonical content types this spec's suite covers:
  character, lorebook (+ entry-level drafts), preset, persona, regex_script: matching
  VAUD's `CREATOR_DRAFT_TYPES` list (`tools/creator-draft-tools.ts:23`) minus `series`
  (a RoleCall-only concept with no Vaudeville Studios canonical home) plus none added.
- **validate**: runs the zod schema for the content type plus, where relevant, the
  Round-Trip Law's format-specific checks if the draft targets a specific export
  format. Produces a `ValidationReport` (errors block promotion to `approved`,
  warnings do not). This step has no VAUD analogue as a distinct phase: VAUD's
  draft tools validate inline at draft time via `validateCreateCharacter` et al.
  (`tools/creator-draft-tools.ts:14-21`); this spec splits validate out as its own
  envelope state because canonical-model.md's zod schemas are meant to be run
  standalone (e.g. by `vaud validate`) and staged edits should get identical
  guarantees rather than a parallel check.
- **approve**: gate controlled by the approval policy (see below). Auto-approved
  drafts skip straight from `validated` to `approved` in the same tool call; drafts
  requiring approval pause the turn (`paused_for_input`) until the caller resumes with
  an explicit approve/deny.
- **commit**: writes the target file (or creates it), and records a new entry in the
  production's `.vaud/history/` content-addressed snapshot store
  (specs/engine/productions-and-history.md, not yet written: this spec assumes
  commit always produces exactly one history entry per committed envelope, so an
  agent-made edit is indistinguishable from a manually-saved one in the history log).
  Envelope status becomes `committed`.
- **dismiss**: available from `draft` or `validated`; discards the envelope, no file
  touched. A dismiss reason is recorded on the envelope for session transcript
  purposes (mirrors `dismiss_reason` in `tools/creator-draft-tools.ts:34`).

Envelope storage: one JSON file per open envelope under
`<production>/.vaud/drafts/<content_type>/<draft-id>.json`, not inside spill (spill is
scratch, drafts are meaningful in-progress work a user should be able to resume
across CLI invocations) and not inside `.vaud/history/` (history is committed
snapshots only). Committed/dismissed envelopes are deleted from `.vaud/drafts/` once
their terminal state is reached; the outcome lives in `.vaud/history/` (for commits)
or the session transcript (for dismissals), not as a lingering drafts-folder file.

### Approval policy

CLI-appropriate reimplementation of VAUD's class-based gate
(`tool-approval.ts:1-29`). Every tool declares (or the registry derives) an
`ApprovalClass`:

| Class | Derivation | Default |
|---|---|---|
| `read` | tool is read-only (resource `ls/read/search`, `consult_*`, inspection tools) | auto |
| `write` | staged-edit `draft`/`validate` tools (no file touched yet) | auto |
| `approve_commit` | staged-edit `approve`/`commit` tools (the step that touches a real file) | ask |
| `destructive` | anything that deletes or overwrites without a staged envelope (e.g. a bulk `vaud import --overwrite` invoked by the agent) | ask |

This table is a deliberate reshaping of VAUD's four classes (`read`/`ui`/`write`/
`destructive`, `tool-approval.ts:35,43-48`) for a filesystem tool where there is no
`ui_control` class (no panel to open/close) and where VAUD's blanket "write: auto"
default is not safe here: VAUD's writes land behind product-level UNDO surfaces in the
RoleCall panel (`tool-approval.ts:23`); Vaudeville Studios has no such UNDO UI at M2,
so the point at which an envelope actually touches disk (`approve`/`commit`) is its
own class and defaults to `ask`, while drafting/validating (no disk write yet) stays
`auto`. `--yes`/`--auto-approve` CLI flags and a session-level "auto-approve
approve_commit for this session" toggle both map to flipping that one policy entry;
neither the CLI flag nor the toggle is a bypass of the state machine, they only skip
the confirmation prompt.

### Persona injection point

A persona (specs/features/personas-system.md, not yet written) supplies the system
prompt's voice/working-style/proactivity layer. Injection order for a turn's system
prompt: (1) fixed agent-loop preamble describing the always-on tool surface and
resource model in terms the model needs to use them correctly, (2) the active
persona's system-prompt block (voice + working style + proactivity dials +
persona-declared sample lines, per the personas-system spec once written), (3)
session/production context (active production name, model-role binding in effect for
this turn), (4) the notes/memory block if the session has one (mirrors VAUD's
`formatNotesBlock`, `loop.ts:42`, conceptually: a running note the agent keeps about
this session, not ported). No persona means step (2) is empty and the loop falls back
to a minimal neutral voice; personas are optional exactly like AI itself is optional
(ADR-006 §2).

### Model capability profile and iteration loop

Every provider adapter call carries a capability profile (native tool-calling vs.
prompted-XML fallback, from provider-adapters.md, OPEN: assumed here per ADR-006 §3).
The loop branches on it:

- **Native tool-calling**: standard OpenAI-shaped `tool_calls` array on the response;
  the loop may dispatch multiple calls returned in one response before calling the
  model again.
- **Prompted-XML fallback**: the model's tool grammar is rendered into the system
  prompt as text (VAUD's `renderToolCatalog`, `prompted-tools.ts`, referenced only;
  exact grammar is provider-adapters.md's job, OPEN QUESTION until that spec exists);
  the loop parses one tool-call block per response and dispatches exactly one tool per
  iteration in this mode (ADR-006 §3, "one tool call per turn on weak models").
  Multiple tool-call blocks in a single prompted-mode response are dispatched in the
  order they appear but only the first is executed before the model is re-prompted.
  OPEN QUESTION: whether later blocks in the same response are discarded or queued for
  the next iteration; VAUD's `parseToolCallBlocks` (`loop.ts:58`) is referenced
  reading only and this spec does not assume its exact queuing behavior without
  reading its body, which is out of scope for this file's brief.

Loop guards:

1. **Iteration cap**: default 5 model calls per turn (VAUD's default, `loop.ts:17`),
   configurable per session. Hitting the cap yields `error` with a distinct
   `LOOP_ITERATION_CAP` code so the caller can offer "continue?" rather than treating
   it as a hard failure.
2. **Loop detector**: trips on (a) the same tool called with byte-identical
   arguments twice in a row (strict-key repeat), (b) the same tool name called
   repeatedly regardless of arguments past a threshold (name-only repeat), or (c)
   consecutive tool-execution failures past a threshold. Trip yields
   `paused_for_input` (not `error`) so the user can redirect rather than losing the
   turn outright: conceptually matching VAUD's three trip conditions
   (`loop.ts:15`, `detector` module referenced by name only).
3. **Empty output guard**: a model response with empty text content AND no tool
   calls is NOT treated as a valid `done`: it yields `error` with code
   `MODEL_STALLED`, distinguishing "model produced nothing" from "model intentionally
   answered with empty content" (VAUD's distinction, `loop.ts:14-16`). A model that
   deliberately returns whitespace-only prose as its final answer is a `done` with
   that content, not stalled; the guard is specifically empty-string-or-null content.

### Turn resumption

`paused_for_input` carries enough state (pending tool calls awaiting approval, or a
clarifying question with no pending tool call) for the caller to resume with
`resumeTurn(sessionState, resolution)` where `resolution` is either
`{approve: true|false, comment?: string}` for an approval gate or
`{answer: string}` for a clarifying question. Resuming an approval gate re-enters
`dispatching_tools` with that one call resolved; resuming a clarifying question
re-enters `calling_model` with the answer appended as a user turn. A session may be
closed with an open `paused_for_input` turn: that pause state is caller-persisted
(the agent package is stateless between calls) and the caller resumes it in a later
process invocation using the same session id, which is why draft envelopes live on
disk rather than in memory.

## Public API sketch

```ts
// packages/agent/src/types.ts

export type ContentType =
  | "character" | "lorebook" | "preset" | "persona" | "regex_script";

export interface AgentSession {
  id: string;
  productionPath: string | null;       // null = no active production
  history: AgentMessage[];
  modelRoles: Record<ModelRole, ProviderModelRef>; // interview/treatment/test/audit
  approvalPolicy: ApprovalPolicy;
  activePersonaId: string | null;
  spillDir: string;                    // resolved per Behavior > Spill store
}

export type ModelRole = "interview" | "treatment" | "test" | "audit";

export interface ApprovalPolicy {
  read: "auto" | "ask";
  write: "auto" | "ask";
  approve_commit: "auto" | "ask";
  destructive: "auto" | "ask";
}

export interface AgentMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

// Discriminated union of everything the loop can yield during a turn.
export type AgentEvent =
  | { type: "assistant_text_delta"; text: string }
  | { type: "tool_call_started"; toolName: string; args: unknown; callId: string }
  | { type: "tool_call_result"; callId: string; result: ToolResult }
  | { type: "spilled"; callId: string; handle: string; peek: string; totalChars: number }
  | { type: "approval_required"; callId: string; toolName: string; args: unknown; class: ApprovalClass }
  | { type: "draft_created"; draftId: string; contentType: ContentType }
  | { type: "draft_validated"; draftId: string; report: ValidationReport }
  | { type: "draft_committed"; draftId: string; historyEntryId: string }
  | { type: "done"; finalText: string }
  | { type: "paused_for_input"; reason: "approval" | "clarification"; prompt?: string; pendingCallId?: string }
  | { type: "error"; code: AgentErrorCode; message: string };

export type AgentErrorCode =
  | "LOOP_ITERATION_CAP"
  | "MODEL_STALLED"
  | "PROVIDER_ERROR"
  | "NO_PRODUCTION"
  | "VALIDATION_FAILED";

export interface ToolResult {
  ok: boolean;
  content: string;      // inline content, or a peek if spilled
  spilled: boolean;
  handle?: string;
}

export type ApprovalClass = "read" | "write" | "approve_commit" | "destructive";

export interface ValidationReport {
  ok: boolean;
  errors: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
}

export interface Resolution {
  approve?: { callId: string; granted: boolean; comment?: string };
  clarification?: { answer: string };
}
```

```ts
// packages/agent/src/loop.ts

/**
 * Runs one full turn: model calls, tool dispatch, spill, staged-edit
 * envelope transitions, until a terminal AgentEvent (done/paused_for_input/
 * error). Async generator so callers (CLI REPL, studio IPC) can stream
 * events to their own UI without the package knowing about either.
 */
export function runTurn(
  session: AgentSession,
  userInput: string,
): AsyncGenerator<AgentEvent, AgentSession>;

/** Resumes a session left in `paused_for_input` after runTurn returned. */
export function resumeTurn(
  session: AgentSession,
  resolution: Resolution,
): AsyncGenerator<AgentEvent, AgentSession>;
```

```ts
// packages/agent/src/registry.ts

export interface ToolDef {
  name: string;
  description: string;
  parametersSchema: unknown;    // JSON Schema, zod-derived
  approvalClass: ApprovalClass;
  isDeferred: boolean;          // hidden until a matching consult_* reveal fires
  domain: ToolDomain;
  execute: (args: unknown, ctx: ToolExecutionContext) => Promise<ToolResult>;
}

export type ToolDomain = "files" | "editing" | "doctor" | "conversion" | "meta";

export interface ToolExecutionContext {
  session: AgentSession;
  productionRoot: string | null;
}

export function listAlwaysOn(): ToolDef[];
export function listDomain(domain: ToolDomain): ToolDef[];
export function searchTools(query: string): ToolDef[];
export function getTool(name: string): ToolDef | undefined;
```

```ts
// packages/agent/src/spill.ts

export interface SpillHandle {
  write(name: string, content: string): { handle: string; totalChars: number };
  read(handle: string, opts?: { offset?: number; limit?: number }): string | null;
  grep(handle: string, pattern: string): Array<{ line: number; text: string }>;
  stat(handle: string): { totalChars: number; totalLines: number; createdAt: string } | null;
}

export const INLINE_CHAR_CAP = 4096;
export const INLINE_TOKEN_CAP = 1024;

export function createSpill(sessionDir: string): SpillHandle;
```

```ts
// packages/agent/src/staged-edit.ts

export interface DraftEnvelope {
  id: string;
  contentType: ContentType;
  status: "draft" | "validated" | "approved" | "committed" | "dismissed";
  payload: Record<string, unknown>;   // canonical-shaped, may be a partial patch
  createdAt: string;
  updatedAt: string;
  committedHistoryEntryId?: string;
  dismissReason?: string;
}

export function draft(productionRoot: string, contentType: ContentType, payload: unknown): DraftEnvelope;
export function validate(productionRoot: string, draftId: string): ValidationReport;
export function approve(productionRoot: string, draftId: string): DraftEnvelope;
export function commit(productionRoot: string, draftId: string): { historyEntryId: string };
export function dismiss(productionRoot: string, draftId: string, reason?: string): void;
export function listOpenDrafts(productionRoot: string): DraftEnvelope[];
```

## Edge cases & failure modes

1. **No active production, agent asked to edit something.** Resource `read`/`ls`/
   `search` against `vaud://production/...` and any `draft`/`approve`/`commit` call
   return `NO_PRODUCTION`. The loop does not silently fall back to a bare-file
   guess; the caller (CLI) is responsible for prompting the user to `vaud init` or
   pass an explicit file path, per the bare-file operation note in
   productions-and-history.md's brief (not yet written).
2. **Model calls a tool name that was never revealed.** The registry returns a
   "no exact tool named X" tool-result error (mirrors `tool-contract.ts:28-40`)
   rather than executing nothing silently, and nudges the model toward
   `tool_search`/`consult_*` instead of inventing snake_case names. This does not
   count as a tool-execution failure for the loop-detector's failure-streak trip
   unless it repeats.
3. **`consult_*` called twice in the same turn.** Second call returns the same
   reveal payload without a new provider round trip cost beyond the one tool
   response (no schemas re-injected a second time, no duplicate domain listing
   appended to context).
4. **Spill handle collision across concurrent tool calls in the same turn.**
   Handle naming is `(toolName, dedupKey)`-stable within a session; the write is a
   delete-then-write against a single path per Behavior > Spill store. Since the
   loop dispatches native-mode tool calls to completion sequentially within one
   iteration (no true parallelism inside a single Node/Bun process for this
   workload), this is a non-issue in practice; documented anyway as the reason
   there is no lock file.
5. **Draft envelope references a canonical field that fails zod validation at the
   `validate` step.** Envelope stays at `draft` status (validate does not silently
   promote), `ValidationReport.ok = false` is returned to the model as a tool
   result so it can revise and re-draft. `approve`/`commit` on a non-`validated`
   envelope is rejected with `VALIDATION_FAILED`.
6. **User denies an approval-gated `approve`/`commit` call.** `resumeTurn` with
   `{granted: false}` leaves the draft envelope at `validated` (not deleted); the
   loop resumes `calling_model` with a tool-result telling the model the user
   declined, optionally with `comment`. The model may revise and re-submit a new
   `approve` call, or move to `dismiss`.
7. **Session closed (process exit) with an open `paused_for_input`.** No special
   handling needed: the pause state and any open draft envelopes are on disk
   (`.vaud/drafts/`) or in caller-persisted session state; a later `vaud` invocation
   against the same session id resumes cleanly. Spill files for that session are
   still subject to the TTL sweep independent of whether the turn was resumed.
8. **Prompted-XML model emits multiple tool-call blocks in one response.** OPEN
   QUESTION (see Behavior > Model capability profile): whether later blocks are
   discarded or queued. Must be resolved before provider-adapters.md and this spec
   are both marked `reviewed`, since it changes the iteration-cap accounting.
9. **Tool result is exactly at the inline cap boundary.** Spill triggers at
   STRICTLY GREATER THAN `INLINE_CHAR_CAP`/`INLINE_TOKEN_CAP`; a result exactly at
   the cap is returned inline. (Chosen for determinism; VAUD's source comment does
   not state its boundary operator explicitly: OPEN QUESTION whether VAUD in
   production actually treats it as `>=`; if a later ground-truth read of
   `spill.ts` body settles it, align this spec, but do not block M2 on it since the
   two behaviors differ by at most one cap-sized result per session.)
10. **Loop detector strict-key repeat on a legitimately idempotent read tool**
    (e.g. re-reading the same file after the model forgot it already had the
    content). This still trips the detector: the fix is a `paused_for_input`
    redirect, not a special-case exemption, because distinguishing "legitimately
    re-reading" from "stuck in a loop" from tool arguments alone is not reliable.
11. **Persona declares a proactivity dial that conflicts with the approval
    policy** (e.g. a "just do it" persona voice paired with `approve_commit: ask`).
    Persona voice affects system-prompt tone and how the model explains itself; it
    never changes the approval policy's gating decision. Policy always wins.
12. **Destructive class tool invoked without a corresponding staged envelope**
    (e.g. an agent-driven `vaud import --overwrite` wrapper). Always `ask` by
    default per the approval table regardless of session-level auto-approve
    settings for `write`/`approve_commit`: the two policy entries are independent
    and a blanket auto-approve toggle in the CLI must set `destructive`
    explicitly, never implicitly, to avoid a single `--yes` flag silently
    authorizing deletes. OPEN QUESTION: exact CLI flag name and whether `--yes`
    is scoped to expand later once cli-ux.md (specs/features/cli-ux.md, not yet
    written) defines global flag conventions.

## Test plan

- Fixtures required:
  - `fixtures/agent-loop/native-single-tool-call.json`: one native tool_calls
    round trip, exercises the happy path through `calling_model` →
    `dispatching_tools` → `done`.
  - `fixtures/agent-loop/prompted-single-tool-call.json`: same shape via the
    prompted-XML path, exercises the one-tool-per-iteration constraint.
  - `fixtures/agent-loop/spill-trigger.json`: a tool result sized just over
    `INLINE_CHAR_CAP`, asserts a `spilled` event with correct peek length and that
    `spill_read`/`spill_grep` against the handle return the full content.
  - `fixtures/agent-loop/spill-boundary.json`: a tool result sized exactly at
    `INLINE_CHAR_CAP`, asserts NO spill event (edge case 9).
  - `fixtures/agent-loop/consult-reveal.json`: a `consult_files` call followed by
    a resource-verb call in the next iteration, asserts the tool was not callable
    before the reveal and is callable after.
  - `fixtures/agent-loop/loop-detector-strict-key.json`,
    `-name-only.json`, `-consecutive-failures.json`: one fixture per trip
    condition, asserts `paused_for_input` not `error`.
  - `fixtures/agent-loop/empty-output-stall.json`: model returns empty content
    with no tool_calls, asserts `error` with `MODEL_STALLED`.
  - `fixtures/agent-loop/iteration-cap.json`: a model that keeps calling tools
    past the cap, asserts `error` with `LOOP_ITERATION_CAP` at exactly the
    configured cap, not one before or after.
  - `fixtures/agent-loop/staged-edit-full-lifecycle.json`: draft → validate →
    approve (auto) → commit for a character, asserts exactly one
    `.vaud/history/` entry and the drafts-folder file removed after commit.
  - `fixtures/agent-loop/staged-edit-validation-failure.json`: draft with a
    schema-invalid payload, asserts `approve` is rejected with
    `VALIDATION_FAILED` and the envelope remains at `draft`.
  - `fixtures/agent-loop/staged-edit-denied-approval.json`: `approve_commit`
    class tool denied via `resumeTurn`, asserts envelope stays `validated` and
    turn resumes into `calling_model` with the denial as a tool result.
  - `fixtures/agent-loop/eviction-idempotent.json`: run eviction twice over the
    same history, assert byte-identical output both times (Behavior > Context
    compaction, idempotency requirement).
  - `fixtures/agent-loop/no-production-write-attempt.json`: draft/approve/commit
    attempted with `productionPath: null`, asserts `NO_PRODUCTION` and no file
    written anywhere.
- Round-Trip Law applicability: none directly (this package has no serialize/parse
  pair of its own), but every `draft`/`commit` path must round-trip through
  canonical-model.md's zod schemas: a fixture whose payload fails that schema is
  exactly `staged-edit-validation-failure.json` above, and the commit fixture's
  resulting file must itself pass the relevant codec's Round-Trip Law fixture suite
  (cross-check against specs/formats/*.md test plans, not duplicated here).
- Property/unit tests beyond fixtures:
  - Spill handle stability: writing the same `(toolName, dedupKey)` twice
    overwrites rather than accumulating a second file on disk.
  - Approval class derivation is a pure function of tool metadata (table in
    Behavior > Approval policy): property test over the full registered tool list
    asserting every tool has exactly one class and no tool is unclassified.
  - `resumeTurn` on a session with no matching pending call/question is a no-op
    error, not a crash.

## Non-goals

- This spec does not define the exact prompted-XML tool-call grammar (provider-
  adapters.md's job) or the `ChatRequest`/`ChatResponse` shape (same). It treats
  the provider adapter as a black box that already handles retries, timeouts, and
  streaming.
- This spec does not define what personas contain (specs/features/personas-
  system.md) beyond the injection point and ordering.
- This spec does not define the production/`.vaud/history/` snapshot format itself
  (specs/engine/productions-and-history.md) beyond assuming `commit` produces
  exactly one history entry.
- No multi-agent orchestration, no sub-agent spawning, no background/async turns
  running without an active caller polling the generator. One session, one turn at
  a time.
- No telemetry, no transcript upload, no cross-session memory beyond what the
  caller explicitly persists and re-passes as session state (consistent with the
  no-telemetry invariant in `docs/02-ARCHITECTURE.md`'s Security & privacy
  section).
- No UI rendering of any kind lives in this package: not even a plain-text
  formatter. `apps/cli` owns turning `AgentEvent` into terminal output.
- Does not decide the exact CLI flag names for approval bypass (`--yes` etc.):
  that is specs/features/cli-ux.md's job; this spec only fixes the policy model
  those flags must map onto.

## Sources consulted

- `C:/Users/chiev/Documents/vaudeville-studios/docs/00-MASTER-PLAN.md`: layer
  definitions (Engine/Faces/Brain), M2 milestone scope.
- `C:/Users/chiev/Documents/vaudeville-studios/docs/02-ARCHITECTURE.md:26-30,54-70,
  78-83,85-91`: package layout (`packages/agent`), the agent bullet list (tiny
  tool surface, resource model, spill store, staged edits, model capability
  profiles, eval harness), Faces rule (CLI before studio, studio has no private
  engine capabilities), security/privacy invariants (no telemetry, keys never
  logged).
- `C:/Users/chiev/Documents/vaudeville-studios/docs/decisions/ADR-006-ai-and-
  agent.md`: full text: BYOK provider list, AI-optional, the five weak-model
  design constraints, model-role mapping (interview/treatment/test/audit), eval
  harness at M2.
- `C:/Users/chiev/Documents/vaudeville-studios/specs/formats/canonical-model.md`:
  content types, shared `Entity<T>` envelope, escrow reference.
- `C:/Users/chiev/Documents/vaudeville-studios/specs/formats/escrow-and-
  roundtrip.md`: Round-Trip Law definition, used in Test plan's cross-reference.
- `C:/Users/chiev/Documents/vaudeville-studios/templates/SPEC-TEMPLATE.md`:
  section shape followed here.
- `C:/Users/chiev/Documents/vaudeville-studios/docs/06-PRODUCTION-BIBLE.md:66`:
  this file's brief.
- VAUDEVILLE (reference reading only, no code ported, conceptual lessons only):
  - `apps/rc/src/lib/ai/btw/spill.ts:1-22,43-76`: spill store rationale, inline
    caps (`INLINE_CHAR_CAP = 4096`, `INLINE_TOKEN_CAP = 1024`), upsert-on-
    `(thread_id, name)` pattern, TTL/sweep note.
  - `apps/rc/src/lib/ai/btw/tools/meta-tools.ts:1-17,47-65`: meta-tool reveal
    pattern, Berkeley FCL ~50-tool accuracy-collapse citation, consult-tool usage
    rules (call in same turn as the revealed tool, don't call twice per turn).
  - `apps/rc/src/lib/ai/btw/loop.ts:1-60`: turn driver responsibilities list
    (system prompt build, message compose, dispatch, loop-detector trip conditions,
    empty-output guard, default iteration cap of 5, streaming-later note).
  - `apps/rc/src/lib/ai/btw/tool-approval.ts:1-60`: class-based approval gate
    (read/ui/write/destructive), derivation rules, default policy.
  - `apps/rc/src/lib/ai/btw/tool-contract.ts:1-40`: unknown-tool-name handling,
    "no exact tool named X" notice pattern.
  - `apps/rc/src/lib/ai/btw/context/eviction.ts:1-50`: stale tool-result
    eviction: real-user-turn detection, `keepTurns=4`, `maxResultChars=12000`,
    idempotency requirement, evicted/truncation markers.
  - `apps/rc/src/lib/ai/btw/tools/creator-draft-tools.ts:1-56`: `creator_draft`
    envelope shape (`kind`, `content_type`, `payload`, `status: open|committed|
    dismissed`, `dismiss_reason`), `CREATOR_DRAFT_TYPES` list.
  - Directory listing of `apps/rc/src/lib/ai/btw/**/*.ts` (141 files): used only
    to confirm which files exist and their apparent purpose from filenames; bodies
    not read beyond the files cited above, per the brief's "reference reading
    ONLY" instruction.
- No web sources: this file is a conceptual/design spec, not a public-format codec
  spec, so the brief's web-research allowance does not apply here.
