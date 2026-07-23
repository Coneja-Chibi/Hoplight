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
  tools: [],
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
  expect(events).toEqual([
    { type: "say", text: "let me look" },
    { type: "tool-start", name: "list" },
    { type: "tool", name: "list", summary: "list ok" },
    { type: "say", text: "you have three" },
  ]);
  expect(history.map((message) => message.role)).toEqual(["user", "assistant", "tool", "assistant"]);
  expect(history[1]?.toolCalls).toEqual([call]);
  expect(history[2]).toMatchObject({ role: "tool", toolCallId: "c1", toolName: "list" });
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
