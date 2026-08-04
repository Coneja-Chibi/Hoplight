/** Coverage for the ReAct loop: plain answers, the tool cycle, and both stop conditions. */
import { expect, test } from "bun:test";
import type { ChatFn, ModelReply, ModelToolCall } from "../providers/provider";
import { runTurn, type DispatchFn, type LoopDeps, type LoopEvent } from "./loop-core";

const drain = async <R>(gen: AsyncGenerator<LoopEvent, R>) => {
  const events: LoopEvent[] = [];
  let next = await gen.next();
  while (!next.done) {
    events.push(next.value);
    next = await gen.next();
  }
  return { events, history: next.value };
};

const okDispatch: DispatchFn = async (call) => ({
  summary: `${call.name} ok`,
  output: `result of ${call.name}`,
});

const deps = (chat: ChatFn, over?: Partial<LoopDeps>): LoopDeps => ({
  chat,
  dispatch: okDispatch,
  toolSnapshot: () => [],
  effectFor: () => "read",
  maxSteps: 8,
  ...over,
});

const scripted = (replies: ModelReply[]): ChatFn => {
  let index = 0;
  return async () => replies[Math.min(index++, replies.length - 1)] as ModelReply;
};

test("a plain answer yields one say and records the exchange", async () => {
  const { events, history } = await drain(
    runTurn("hi", [], deps(async () => ({ kind: "say", text: "hello" }))),
  );
  expect(events).toEqual([{ type: "say", text: "hello" }]);
  expect(history).toEqual([
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
  ]);
});

test("ReAct: calls a tool, observes the result, then answers", async () => {
  const call: ModelToolCall = { id: "c1", name: "list", args: { kind: "character" } };
  const chat = scripted([
    { kind: "use", text: "let me look", calls: [call] },
    { kind: "say", text: "you have three" },
  ]);
  const { events, history } = await drain(runTurn("how many?", [], deps(chat)));
  // "let me look" is said BEFORE the tool runs, and it must survive. This expectation used to omit
  // it, which is how the drop went unnoticed: a model's stated reason for acting was thrown away and
  // the transcript kept only the moves.
  expect(events).toEqual([
    { type: "say", text: "let me look" },
    { type: "tool-start", name: "list" },
    { type: "state", phase: "reading" },
    { type: "tool", name: "list", summary: "list ok" },
    { type: "say", text: "you have three" },
  ]);
  // The history always held it (the assistant message carries text + toolCalls together); it was
  // the transcript that dropped it, so this asserts no DUPLICATE entry was introduced either.
  expect(history[1]).toMatchObject({ role: "assistant", content: "let me look" });
  expect(history.map((message) => message.role)).toEqual(["user", "assistant", "tool", "assistant"]);
  expect(history[1]?.toolCalls).toEqual([call]);
  expect(history[2]).toMatchObject({ role: "tool", toolCallId: "c1", toolName: "list" });
});

test("resolves a fresh tool snapshot before every model round trip", async () => {
  const seen: string[][] = [];
  let snapshot = 0;
  const chat: ChatFn = async (_messages, tools) => {
    seen.push(tools.map((tool) => tool.name));
    return seen.length === 1
      ? { kind: "use", text: "", calls: [{ id: "find", name: "capability_find", args: {} }] }
      : { kind: "say", text: "found it" };
  };
  await drain(runTurn("find a tool", [], deps(chat, {
    toolSnapshot: () => snapshot++ === 0
      ? []
      : [{ name: "lorebook_entries_update", description: "Update lore.", schema: {} }],
  })));
  expect(seen).toEqual([[], ["lorebook_entries_update"]]);
});

test("explicit discovery activity emits discovering instead of a generic read phase", async () => {
  const chat = scripted([
    {
      kind: "use",
      text: "",
      calls: [{ id: "find", name: "capability_find", args: {} }],
    },
    { kind: "say", text: "found" },
  ]);
  const { events } = await drain(runTurn("find", [], deps(chat, {
    activityFor: () => "discovering",
  })));
  expect(events).toContainEqual({ type: "state", phase: "discovering" });
  expect(events).not.toContainEqual({ type: "state", phase: "reading" });
});

test("a discarded draft emits a discarded terminal receipt", async () => {
  const chat = scripted([
    { kind: "use", text: "", calls: [{ id: "discard", name: "change_discard", args: {} }] },
    { kind: "say", text: "discarded" },
  ]);
  const { events } = await drain(runTurn("discard it", [], deps(chat, {
    effectFor: () => "draft",
    dispatch: async () => ({
      summary: "discard draft-1: discarded",
      output: "{}",
      outcome: "discarded",
    }),
  })));
  expect(events).toContainEqual({ type: "state", phase: "discarded" });
  expect(events.at(-1)).toEqual({ type: "say", text: "discarded" });
});

test("a reviewable draft turns final model prose into application-owned review", async () => {
  let chatCalls = 0;
  const calls: ModelToolCall[] = [];
  const chat: ChatFn = async () => {
    chatCalls += 1;
    return chatCalls === 1
      ? {
          kind: "use",
          text: "",
          calls: [{ id: "rename", name: "character_identity_update", args: {} }],
        }
      : { kind: "say", text: "Would you like me to apply this change?" };
  };
  const { events, history } = await drain(runTurn("rename her", [], deps(chat, {
    effectFor: (call) => call.name === "change_apply" ? "apply" : "draft",
    dispatch: async (call) => {
      calls.push(call);
      if (call.name === "change_apply") {
        return {
          summary: "apply draft-1: applied",
          output: '{"status":"applied"}',
          outcome: "applied",
        };
      }
      return {
        summary: "draft character.identity.update: 1 change",
        output: '{"draftId":"draft-1"}',
        outcome: "draft",
        review: {
          draftId: "draft-1",
          target: { kind: "character", id: "aphrodite" },
          changes: [{ label: "name", before: "Aphrodite", after: "Dite" }],
          warningCount: 0,
        },
      };
    },
  })));

  expect(chatCalls).toBe(2);
  expect(calls.map((call) => call.name)).toEqual([
    "character_identity_update",
    "change_apply",
  ]);
  expect(calls[1]?.args).toEqual({ draftId: "draft-1" });
  expect(events).toContainEqual({ type: "tool-start", name: "change_apply" });
  expect(events).toContainEqual({ type: "state", phase: "completed" });
  expect(events).not.toContainEqual({
    type: "say",
    text: "Would you like me to apply this change?",
  });
  // The apply call is recorded. Found by its CALL rather than by position, because the receipt now
  // lands after it and "the last assistant message" was never what this was really asserting.
  expect(
    history.filter((m) => m.role === "assistant" && m.toolCalls?.length).at(-1)?.toolCalls,
  ).toMatchObject([{ name: "change_apply", args: { draftId: "draft-1" } }]);

  // And the RECEIPT is in history as words, not only as raw JSON.
  //
  // Without it a resumed session showed the tool fold and then silence: a replay is a pure
  // projection of these messages, and the outcome the person saw lived only in a live UI event. The
  // model was in the same position - handed the payload twice and never told what it meant.
  const spoken = history.filter((m) => m.role === "assistant" && !m.toolCalls?.length);
  expect(spoken.at(-1)?.content).toContain("applied");
  expect(events.at(-1)).toEqual({ type: "say", text: "apply draft-1: applied" });
});

test("denying an automatic draft review discards it without a verbal follow-up", async () => {
  let chatCalls = 0;
  const calls: string[] = [];
  const { events } = await drain(runTurn("rename her", [], deps(async () => {
    chatCalls += 1;
    return chatCalls === 1
      ? {
          kind: "use",
          text: "",
          calls: [{ id: "rename", name: "character_identity_update", args: {} }],
        }
      : { kind: "say", text: "Would you like me to save or discard it?" };
  }, {
    effectFor: (call) => call.name === "change_apply"
      ? "apply"
      : call.name === "change_discard"
        ? "draft"
        : "draft",
    dispatch: async (call) => {
      calls.push(call.name);
      if (call.name === "change_apply") {
        return {
          summary: "change_apply: blocked",
          output: "Denied by the user.",
          gateDecision: "denied",
        };
      }
      if (call.name === "change_discard") {
        return {
          summary: "discard draft-1: discarded",
          output: '{"status":"discarded"}',
          outcome: "discarded",
        };
      }
      return {
        summary: "draft character.identity.update: 1 change",
        output: '{"draftId":"draft-1"}',
        outcome: "draft",
        review: {
          draftId: "draft-1",
          target: { kind: "character", id: "aphrodite" },
          changes: [{ label: "name", before: "Aphrodite", after: "Dite" }],
          warningCount: 0,
        },
      };
    },
  })));

  expect(chatCalls).toBe(2);
  expect(calls).toEqual([
    "character_identity_update",
    "change_apply",
    "change_discard",
  ]);
  expect(events).toContainEqual({ type: "state", phase: "discarded" });
});

test("multiple draft operations compose before the single review handoff", async () => {
  const chat = scripted([
    {
      kind: "use",
      text: "",
      calls: [{ id: "identity", name: "character_identity_update", args: {} }],
    },
    {
      kind: "use",
      text: "",
      calls: [{ id: "prompt", name: "character_prompts_update", args: {} }],
    },
    { kind: "say", text: "Ready to save both changes." },
  ]);
  const calls: string[] = [];
  await drain(runTurn("rename her and change the prompt", [], deps(chat, {
    effectFor: (call) => call.name === "change_apply" ? "apply" : "draft",
    dispatch: async (call) => {
      calls.push(call.name);
      if (call.name === "change_apply") {
        return {
          summary: "apply draft-1: applied",
          output: '{"status":"applied"}',
          outcome: "applied",
        };
      }
      const composed = call.name === "character_prompts_update";
      return {
        summary: `draft ${call.name}`,
        output: '{"draftId":"draft-1"}',
        outcome: "draft",
        review: {
          draftId: "draft-1",
          target: { kind: "character", id: "aphrodite" },
          changes: composed
            ? [
                { label: "name", before: "Aphrodite", after: "Dite" },
                { label: "system prompt", before: "Old", after: "New" },
              ]
            : [{ label: "name", before: "Aphrodite", after: "Dite" }],
          warningCount: 0,
        },
      };
    },
  })));

  expect(calls).toEqual([
    "character_identity_update",
    "character_prompts_update",
    "change_apply",
  ]);
});

test("denying a model-requested apply discards once instead of prompting again", async () => {
  const chat = scripted([
    {
      kind: "use",
      text: "",
      calls: [{ id: "rename", name: "character_identity_update", args: {} }],
    },
    {
      kind: "use",
      text: "",
      calls: [{ id: "apply", name: "change_apply", args: { draftId: "draft-1" } }],
    },
    { kind: "say", text: "Should I try that again?" },
  ]);
  const calls: string[] = [];
  const { events } = await drain(runTurn("rename her", [], deps(chat, {
    effectFor: (call) => call.name === "change_apply"
      ? "apply"
      : call.name === "change_discard"
        ? "draft"
        : "draft",
    dispatch: async (call) => {
      calls.push(call.name);
      if (call.name === "change_apply") {
        return {
          summary: "change_apply: blocked",
          output: "Denied by the user.",
          gateDecision: "denied",
        };
      }
      if (call.name === "change_discard") {
        return {
          summary: "discard draft-1: discarded",
          output: '{"status":"discarded"}',
          outcome: "discarded",
        };
      }
      return {
        summary: "draft character.identity.update: 1 change",
        output: '{"draftId":"draft-1"}',
        outcome: "draft",
        review: {
          draftId: "draft-1",
          target: { kind: "character", id: "aphrodite" },
          changes: [{ label: "name", before: "Aphrodite", after: "Dite" }],
          warningCount: 0,
        },
      };
    },
  })));

  expect(calls).toEqual([
    "character_identity_update",
    "change_apply",
    "change_discard",
  ]);
  expect(events).toContainEqual({ type: "state", phase: "discarded" });
  expect(events).not.toContainEqual({ type: "say", text: "Should I try that again?" });
});

test("stops when the model calls the same tool three times", async () => {
  const call: ModelToolCall = { id: "x", name: "list", args: {} };
  const chat: ChatFn = async () => ({ kind: "use", text: "", calls: [call] });
  const { events } = await drain(runTurn("go", [], deps(chat, { maxSteps: 20 })));
  const last = events.at(-1);
  expect(last?.type).toBe("stopped");
  expect(last?.type === "stopped" && last.reason).toContain("same tool");
});

test("stops at the step cap when tools never settle the question", async () => {
  let n = 0;
  const chat: ChatFn = async () => ({
    kind: "use",
    text: "",
    calls: [{ id: `c${n}`, name: "search", args: { q: n++ } }],
  });
  const { events } = await drain(runTurn("go", [], deps(chat, { maxSteps: 3 })));
  const last = events.at(-1);
  expect(last?.type).toBe("stopped");
  expect(last?.type === "stopped" && last.reason).toContain("3-step limit");
});

test("read batches overlap while tool observations remain in provider order", async () => {
  const calls = [
    { id: "slow", name: "studio_read", args: { id: "a" } },
    { id: "fast", name: "studio_read", args: { id: "b" } },
  ];
  const releases = new Map<string, () => void>();
  let chatRound = 0;
  const chat: ChatFn = async () => chatRound++ === 0
    ? { kind: "use", text: "", calls }
    : { kind: "say", text: "done" };
  const running = drain(runTurn("read both", [], deps(chat, {
    effectFor: () => "read",
    dispatch: async (call) => {
      await new Promise<void>((resolve) => releases.set(call.id, resolve));
      return { summary: call.id, output: call.id };
    },
  })));
  await Bun.sleep(0);
  expect([...releases.keys()]).toEqual(["slow", "fast"]);
  releases.get("fast")?.();
  releases.get("slow")?.();
  const { history } = await running;
  expect(history.filter((message) => message.role === "tool").map((message) => message.toolCallId))
    .toEqual(["slow", "fast"]);
});

test("changed observations reset repeated-call detection", async () => {
  let round = 0;
  const chat: ChatFn = async () => round++ < 3
    ? { kind: "use", text: "", calls: [{ id: `c${round}`, name: "studio_read", args: {} }] }
    : { kind: "say", text: "fresh enough" };
  let result = 0;
  const { events } = await drain(runTurn("watch it change", [], deps(chat, {
    dispatch: async () => ({
      summary: "read",
      output: `revision ${result++}`,
    }),
    effectFor: () => "read",
  })));
  expect(events.at(-1)).toEqual({ type: "say", text: "fresh enough" });
});

test("tool-call, elapsed, and cancellation budgets stop with recovery guidance", async () => {
  const call: ModelToolCall = { id: "x", name: "studio_read", args: {} };
  const toolBudget = await drain(runTurn("go", [], deps(
    async () => ({ kind: "use", text: "", calls: [call, { ...call, id: "y" }] }),
    { maxToolCalls: 1, effectFor: () => "read" },
  )));
  expect(toolBudget.events.at(-1)).toMatchObject({ type: "stopped", budget: "tool-calls" });
  expect(toolBudget.history.some((message) => message.toolCalls?.length)).toBe(false);

  let tick = 0;
  const elapsed = await drain(runTurn("go", [], deps(
    async () => ({ kind: "use", text: "", calls: [call] }),
    { maxElapsedMs: 5, now: () => tick += 10, effectFor: () => "read" },
  )));
  expect(elapsed.events.at(-1)).toMatchObject({ type: "stopped", budget: "elapsed" });

  const controller = new AbortController();
  controller.abort();
  const cancelled = await drain(runTurn("go", [], deps(
    async () => ({ kind: "say", text: "must not run" }),
    { signal: controller.signal },
  )));
  expect(cancelled.events.at(-1)).toMatchObject({ type: "stopped", budget: "cancelled" });
});

test("cancellation pairs every declared tool call without running later mutations", async () => {
  const controller = new AbortController();
  let dispatches = 0;
  const calls: ModelToolCall[] = [
    { id: "first", name: "change_apply", args: {} },
    { id: "second", name: "change_apply", args: {} },
  ];
  const result = await drain(runTurn("apply", [], deps(
    async () => ({ kind: "use", text: "", calls }),
    {
      signal: controller.signal,
      effectFor: () => "apply",
      dispatch: async () => {
        dispatches += 1;
        controller.abort();
        return { summary: "checked", output: "checked" };
      },
    },
  )));

  expect(dispatches).toBe(1);
  expect(result.history.filter((message) => message.role === "tool").map((message) => message.toolCallId))
    .toEqual(["first", "second"]);
  expect(result.history.at(-1)?.content).toContain("cancelled");
});

test("a stale apply state cannot later become completed", async () => {
  let round = 0;
  const chat: ChatFn = async () => round++ === 0
    ? { kind: "use", text: "", calls: [{ id: "apply", name: "change_apply", args: {} }] }
    : { kind: "say", text: "I am done" };
  const { events } = await drain(runTurn("apply", [], deps(chat, {
    effectFor: () => "apply",
    dispatch: async () => ({ summary: "stale", output: "stale", outcome: "stale" }),
  })));
  const phases = events.filter((event) => event.type === "state").map((event) => event.phase);
  expect(phases).toContain("stale");
  expect(phases).not.toContain("completed");
});
