/** Coverage for the ReAct loop: plain answers, the tool cycle, and both stop conditions. */
import { expect, test } from "bun:test";
import type { ChatFn, ModelToolCall } from "../providers/provider";
import { runTurn } from "./loop-core";
import { deps, drain, scripted } from "./_shared/test-harness";

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
