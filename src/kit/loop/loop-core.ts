/**
 * The pure ReAct core: drive one user turn by calling the injected model, dispatching the tool calls
 * it asks for, feeding results back, and repeating until it answers or a stop condition trips. There
 * is no I/O here, the model call and tool dispatch are injected, so this runs and is tested without a
 * network or a real model. It yields events for the render layer and returns the updated history.
 */
import type { ChatDelta, ChatFn, ModelMessage, ModelToolCall, ToolSpec } from "../providers/provider";
import type { TokenUsage } from "../providers/usage";
import type { DraftReview, ToolActivity, ToolEffect, ToolResult } from "../tools/tool";
import { scheduleToolCalls } from "./scheduler";
import { initialLoopState, transitionLoop, type LoopPhase } from "./state";
import { observationKey, stopReason } from "./stop-core";

/** The outcome of running one tool call: a one-line row for the terminal, plus the model's observation. */
export interface DispatchResult extends ToolResult {}

/** Parse-and-run one tool call. Impure (touches the studio); injected so the core stays pure. */
export type DispatchFn = (call: ModelToolCall) => Promise<DispatchResult>;

/** What the render layer paints as a turn unfolds. tool-start fires the instant a tool begins (so a
 * slow tool can be named on stage while it grinds); tool fires when it settles, with its summary. */
export type LoopEvent =
  | {
    type: "tool";
    name: string;
    summary: string;
    show?: { kind: string; id: string };
    /** Options for the person to pick from, carried as data so the shell decides how to draw them. */
    choices?: { question: string; options: readonly { value: string; note?: string }[] };
  }
  /**
   * A piece was actually written, named so a view of it can re-read it.
   *
   * The studio watcher cannot carry this: it diffs entity SUMMARIES, and a summary holds a name
   * and an accent - nothing about the body. Adding, moving or rewriting blocks changes no field
   * it looks at, so a preset edit is invisible to it and the rail went on showing what it read
   * when it opened. The apply path knows exactly what it touched, so it says so.
   */
  | { type: "wrote"; kind: string; id: string }
  | { type: "say"; text: string }
  | { type: "tool-start"; name: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "state"; phase: LoopPhase }
  | {
    type: "stopped";
    reason: string;
    budget?: "model-rounds" | "tool-calls" | "elapsed" | "no-progress" | "cancelled";
    observed?: number;
    limit?: number;
    recovery?: string;
  };

export interface LoopDeps {
  chat: ChatFn;
  /** Images to attach to this turn opening message. Already cleared by the provider that takes them. */
  images?: readonly Uint8Array[];
  dispatch: DispatchFn;
  /** Resolve immediately before each model call so discovery can change the visible tool belt. */
  toolSnapshot(): ToolSpec[];
  maxSteps: number;
  /** Explicit metadata lookup. An absent name fails toward mutation serialization. */
  effectFor?: (call: ModelToolCall) => ToolEffect | undefined;
  activityFor?: (call: ModelToolCall) => ToolActivity | undefined;
  maxToolCalls?: number;
  maxElapsedMs?: number;
  signal?: AbortSignal;
  now?: () => number;
  /** Live typing/thinking fragments, forwarded straight to the render layer. */
  onDelta?: (delta: ChatDelta) => void;
}

/** Discard one declined review through the same validated tool path as an explicit model call. */
async function* discardReviewedDraft(
  draftId: string,
  messages: ModelMessage[],
  deps: LoopDeps,
  initialLifecycle: ReturnType<typeof initialLoopState>,
): AsyncGenerator<LoopEvent, void> {
  let lifecycle = initialLifecycle;
  const discardCall: ModelToolCall = {
    id: `kit-review-discard-${draftId}`,
    name: "change_discard",
    args: { draftId },
  };
  messages.push({ role: "assistant", content: "", toolCalls: [discardCall] });
  yield { type: "tool-start", name: discardCall.name };
  const drafting = transitionLoop(lifecycle, { type: "tool-start", effect: "draft" });
  if (drafting.phase !== lifecycle.phase) yield { type: "state", phase: drafting.phase };
  lifecycle = drafting;
  const discarded = await deps.dispatch(discardCall);
  messages.push({
    role: "tool",
    content: discarded.output,
    toolCallId: discardCall.id,
    toolName: discardCall.name,
  });
  yield { type: "tool", name: discardCall.name, summary: discarded.summary };
  const terminal = transitionLoop(lifecycle, {
    type: discarded.outcome === "discarded" ? "discarded" : "failed",
  });
  if (terminal.phase !== lifecycle.phase) yield { type: "state", phase: terminal.phase };
}

/** Finish one composed draft through the application-owned Gate, never through model-authored prose. */
async function* runDraftReview(
  review: DraftReview,
  messages: ModelMessage[],
  deps: LoopDeps,
  initialLifecycle: ReturnType<typeof initialLoopState>,
): AsyncGenerator<LoopEvent, void> {
  let lifecycle = initialLifecycle;
  const applyCall: ModelToolCall = {
    id: `kit-review-apply-${review.draftId}`,
    name: "change_apply",
    args: { draftId: review.draftId },
  };
  messages.push({ role: "assistant", content: "", toolCalls: [applyCall] });
  yield { type: "tool-start", name: applyCall.name };
  const applying = transitionLoop(lifecycle, { type: "tool-start", effect: "apply" });
  if (applying.phase !== lifecycle.phase) yield { type: "state", phase: applying.phase };
  lifecycle = applying;
  const applied = await deps.dispatch(applyCall);
  messages.push({
    role: "tool",
    content: applied.output,
    toolCallId: applyCall.id,
    toolName: applyCall.name,
  });
  yield { type: "tool", name: applyCall.name, summary: applied.summary };

  if (applied.gateDecision === "denied") {
    yield* discardReviewedDraft(review.draftId, messages, deps, lifecycle);
    return;
  }

  // Allowed AND applied: name the piece so anything showing it can re-read it.
  if (review.target) yield { type: "wrote", kind: review.target.kind, id: review.target.id };

  const verifying = transitionLoop(lifecycle, { type: "verifying" });
  if (verifying.phase !== lifecycle.phase) yield { type: "state", phase: verifying.phase };
  lifecycle = verifying;
  const terminal = transitionLoop(lifecycle, {
    type: applied.outcome === "applied"
      ? "completed"
      : applied.outcome === "stale"
        ? "stale"
        : "failed",
  });
  if (terminal.phase !== lifecycle.phase) yield { type: "state", phase: terminal.phase };

  /**
   * THE RECEIPT IS PART OF THE CONVERSATION, so it is said and it is recorded.
   *
   * A turn that ended in a review used to leave nothing behind in words. The apply CALL and its raw
   * JSON result went into history, and the outcome a person actually saw - the review panel, the
   * verdict - was a live UI event and nothing else. Two things broke because of it:
   *
   *   - resuming showed the tool fold and then silence, because a replay is a pure projection of
   *     these messages and there was no sentence in them to project;
   *   - the MODEL only had the raw payload, so it had to re-derive "did that save?" from JSON it had
   *     already been handed once.
   *
   * `applied.summary` is the same phrasing the live receipt uses, so the resumed transcript reads as
   * what happened rather than as a reconstruction of it.
   */
  const receipt = applied.summary.trim();
  if (receipt) {
    messages.push({ role: "assistant", content: receipt });
    yield { type: "say", text: receipt };
  }
}

/** Run one user turn to completion, yielding events and returning the turn's full message history. */
export async function* runTurn(
  input: string,
  history: readonly ModelMessage[],
  deps: LoopDeps,
): AsyncGenerator<LoopEvent, ModelMessage[]> {
  // Images ride on the opening message when the caller attached any. The loop does not decide
  // whether they CAN be sent; the session already asked the spoke before handing them over.
  const opening: ModelMessage = deps.images && deps.images.length > 0
    ? { role: "user", content: input, images: deps.images }
    : { role: "user", content: input };
  const messages: ModelMessage[] = [...history, opening];
  const recentObservationKeys: string[] = [];
  const now = deps.now ?? Date.now;
  const startedAt = now();
  /**
   * The two runaway budgets, sized for work rather than for a demo.
   *
   * TWO MINUTES WAS THE REAL LIMIT and it was invisible, because it is not phrased as a limit on
   * anything a person recognises. One read-heavy turn measured 17 seconds on a studio whose median
   * preset is 440KB, so a job that reads two pieces, looks up their blocks, stages a draft and
   * verifies it was never going to fit - it stopped partway and reported a budget, which reads as
   * the agent giving up for no reason. Raising the step count without this would have changed
   * nothing: the clock got there first every time.
   *
   * THESE ARE STILL THE RUNAWAY GUARDS, not a formality. What actually catches a stuck loop is
   * no-progress detection, which stops after three identical calls in a row - in seconds, not
   * minutes. These two exist for the case that guard cannot see: genuine but unbounded work. Ten
   * minutes and two hundred calls is enough for any real request here and still finite.
   */
  const maxToolCalls = deps.maxToolCalls ?? 200;
  const maxElapsedMs = deps.maxElapsedMs ?? 600_000;
  let toolCalls = 0;
  let lifecycle = initialLoopState();
  let pendingReview: DraftReview | null = null;

  for (let step = 0; ; step += 1) {
    if (deps.signal?.aborted) {
      lifecycle = transitionLoop(lifecycle, { type: "cancelled" });
      yield { type: "state", phase: lifecycle.phase };
      yield {
        type: "stopped",
        reason: "Turn cancelled before more work was started.",
        budget: "cancelled",
        recovery: "Send again when you are ready.",
      };
      return messages;
    }
    const elapsed = now() - startedAt;
    if (elapsed >= maxElapsedMs) {
      lifecycle = transitionLoop(lifecycle, { type: "stopped" });
      yield { type: "state", phase: lifecycle.phase };
      yield {
        type: "stopped",
        reason: `elapsed-time budget reached (${elapsed}ms of ${maxElapsedMs}ms)`,
        budget: "elapsed",
        observed: elapsed,
        limit: maxElapsedMs,
        recovery: "Narrow the request or continue in a new turn.",
      };
      return messages;
    }
    const reason = stopReason({
      step,
      maxSteps: deps.maxSteps,
      recentObservationKeys,
    });
    if (reason) {
      const noProgress = reason.includes("same tool");
      lifecycle = transitionLoop(lifecycle, { type: "stopped" });
      yield { type: "state", phase: lifecycle.phase };
      yield {
        type: "stopped",
        reason,
        budget: noProgress ? "no-progress" : "model-rounds",
        observed: noProgress ? 3 : step,
        limit: noProgress ? 3 : deps.maxSteps,
        recovery: noProgress
          ? "Change the approach or inspect the target directly."
          : "Continue the remaining work in a new turn.",
      };
      return messages;
    }

    const reply = await deps.chat(messages, deps.toolSnapshot(), deps.onDelta);
    // Surface this call's token usage the instant it lands, so the meter/tally update per API call
    // (a tool loop makes several). The guard keeps replies without usage from yielding a noise event.
    if (reply.usage) yield { type: "usage", usage: reply.usage };

    if (reply.kind === "say") {
      if (pendingReview) {
        /**
         * THE REVIEW CLOSES A CYCLE, NOT THE TURN - the same rule as a settled apply, and the other
         * half of the same bug. A model that stages a draft and then speaks lands here, so "make me
         * three versions" ran exactly one: the first draft was reviewed, applied, and the turn went
         * home while the model still had two to make.
         *
         * The Gate is untouched by this. runDraftReview dispatches the apply, which means it meets
         * the same confirmation it always did; continuing afterwards asks for the next one exactly
         * as it asked for this one.
         */
        yield* runDraftReview(pendingReview, messages, deps, lifecycle);
        pendingReview = null;
        // A fresh lifecycle for the next cycle: terminal phases are absorbing, so carrying one
        // forward would freeze the window on "completed" while the work carried on.
        lifecycle = initialLoopState();
        continue;
      }
      messages.push({ role: "assistant", content: reply.text });
      yield { type: "say", text: reply.text };
      return messages;
    }

    /**
     * SPEECH BEFORE MOVES IS STILL SPEECH.
     *
     * A model that says "yes, that was a mistake - let me rebuild it from v3" and then calls tools
     * sends both in one message, and `ModelReply.use` has always carried that `text`. Nothing ever
     * yielded it, so the sentence was dropped and the transcript showed only the moves: the record
     * kept WHAT Kit did and lost WHY, which is the half a person actually needs to judge it.
     *
     * ONLY the event, never a second history entry: the assistant message pushed below already
     * carries this exact text alongside its tool calls, so pushing here would make the model read its
     * own sentence twice. The history was always right; it was the transcript that lost the words.
     */
    if (reply.text.trim()) yield { type: "say", text: reply.text };

    if (toolCalls + reply.calls.length > maxToolCalls) {
      lifecycle = transitionLoop(lifecycle, { type: "stopped" });
      yield { type: "state", phase: lifecycle.phase };
      yield {
        type: "stopped",
        reason: `tool-call budget reached (${toolCalls + reply.calls.length} requested, ${maxToolCalls} allowed)`,
        budget: "tool-calls",
        observed: toolCalls + reply.calls.length,
        limit: maxToolCalls,
        recovery: "Narrow the operation or continue with a fresh turn.",
      };
      return messages;
    }

    // Keep provider history valid: record tool calls only when this turn can answer all of them.
    messages.push({ role: "assistant", content: reply.text, toolCalls: reply.calls });

    const effectFor = (call: ModelToolCall): ToolEffect =>
      deps.effectFor?.(call) ?? "apply";
    const allReads = reply.calls.every((call) => effectFor(call) === "read");
    const settled: Awaited<ReturnType<typeof scheduleToolCalls>> = [];

    if (allReads) {
      for (const call of reply.calls) {
        yield { type: "tool-start", name: call.name };
        const next = deps.activityFor?.(call) === "discovering"
          ? transitionLoop(lifecycle, { type: "discovering" })
          : transitionLoop(lifecycle, { type: "tool-start", effect: "read" });
        if (next.phase !== lifecycle.phase) yield { type: "state", phase: next.phase };
        lifecycle = next;
      }
      settled.push(...await scheduleToolCalls(reply.calls, {
        dispatch: deps.dispatch,
        effectFor,
      }));
    } else {
      for (const [index, call] of reply.calls.entries()) {
        if (deps.signal?.aborted) {
          settled.push(...reply.calls.slice(index).map((pending) => ({
            call: pending,
            result: {
              summary: "cancelled",
              output: "cancelled before execution",
            },
          })));
          break;
        }
        yield { type: "tool-start", name: call.name };
        const effect = effectFor(call);
        const next = deps.activityFor?.(call) === "discovering"
          ? transitionLoop(lifecycle, { type: "discovering" })
          : transitionLoop(lifecycle, { type: "tool-start", effect });
        if (next.phase !== lifecycle.phase) yield { type: "state", phase: next.phase };
        lifecycle = next;
        settled.push(...await scheduleToolCalls([call], {
          dispatch: deps.dispatch,
          effectFor,
        }));
      }
    }

    toolCalls += settled.length;
    for (const [index, { call, result }] of settled.entries()) {
      messages.push({
        role: "tool",
        content: result.output,
        toolCallId: call.id,
        toolName: call.name,
        // Kept so a resumed session can draw the question again; see ModelMessage.choices.
        ...(result.choices ? { choices: result.choices } : {}),
      });
      recentObservationKeys.push(observationKey(call.name, call.args, result.output));
      yield {
        type: "tool",
        name: call.name,
        summary: result.summary,
        ...(result.show ? { show: result.show } : {}),
        ...(result.choices ? { choices: result.choices } : {}),
      };
      if (result.outcome === "draft") {
        const next = transitionLoop(lifecycle, { type: "preview-ready" });
        if (next.phase !== lifecycle.phase) yield { type: "state", phase: next.phase };
        lifecycle = next;
        if (result.review) pendingReview = result.review;
      }
      if (result.outcome === "discarded") {
        pendingReview = null;
        const next = transitionLoop(lifecycle, { type: "discarded" });
        if (next.phase !== lifecycle.phase) yield { type: "state", phase: next.phase };
        lifecycle = next;
      }
      if (call.name === "change_apply" && result.gateDecision === "denied") {
        const args = typeof call.args === "object" && call.args !== null
          ? call.args as { draftId?: unknown }
          : null;
        if (typeof args?.draftId === "string") {
          pendingReview = null;
          yield* discardReviewedDraft(args.draftId, messages, deps, lifecycle);
          return messages;
        }
      }
      if (effectFor(call) === "apply" && result.outcome) {
        /**
         * A WRITE CLOSES A CYCLE, IT DOES NOT END THE TURN.
         *
         * This used to `return` here, so "make me three versions" made one: the model drafted three,
         * the first apply landed, and the turn went home with two drafts stranded. The rule read as a
         * safety boundary and was not one. Approval is the Gate's job and the Gate already does it
         * PER CALL, holding the loop on `requestConfirm` until a person answers - so continuing asks
         * exactly as many times as stopping did. Nor was it protecting the studio: an apply whose
         * piece moved underneath comes back `stale` and writes nothing (see changes/apply.ts).
         *
         * What did the work instead: the budgets. A turn is still bounded by rounds, tool calls and
         * elapsed time, which is where "how much may happen before you get a say" belongs.
         */
        const verifying = transitionLoop(lifecycle, { type: "verifying" });
        if (verifying.phase !== lifecycle.phase) {
          yield { type: "state", phase: verifying.phase };
        }
        lifecycle = verifying;
        const terminal = result.outcome === "applied"
          ? "completed"
          : result.outcome === "stale"
            ? "stale"
            : result.outcome === "discarded"
              ? "discarded"
              : "failed";
        const next = transitionLoop(lifecycle, { type: terminal });
        if (next.phase !== lifecycle.phase) yield { type: "state", phase: next.phase };
        /**
         * A FRESH LIFECYCLE FOR THE NEXT CYCLE, and this is why the reset is here rather than a
         * looser state machine. Terminal phases are ABSORBING on purpose - once a cycle ends stale
         * or failed, nothing may repaint it as completed. Carrying that state into the next draft
         * would freeze the phase forever and leave the window showing "completed" while real work
         * carried on. So the lifecycle describes ONE draft-to-apply cycle, and a turn may hold
         * several; the absorbing rule keeps its full force inside each one.
         */
        lifecycle = initialLoopState();
        /**
         * The applied draft's review is spent - but ONLY that one. A turn may now hold several
         * cycles, so a review still waiting on a different draft has to survive; dropping it would
         * silently skip the confirmation for a change nobody has seen yet. When the call names no
         * draft, the pending one is assumed to be the one that just landed, which is the safe way to
         * be wrong: an extra confirmation costs a click, a skipped one costs a write.
         */
        const applied = typeof call.args === "object" && call.args !== null
          ? (call.args as { draftId?: unknown }).draftId
          : undefined;
        if (pendingReview && (typeof applied !== "string" || pendingReview.draftId === applied)) {
          pendingReview = null;
        }
      }
    }
  }
}
