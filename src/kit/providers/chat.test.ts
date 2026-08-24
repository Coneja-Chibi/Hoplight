/**
 * The two wire mappers in the chat hub: thinking attaches only when the spoke declared it must
 * echo, and the reply keeps the thought beside its answer so the loop can store it. These are the
 * pure functions; the live stream is the same shape exercised end to end in a real run.
 */
import { expect, test } from "bun:test";
import type { ModelMessage } from "./provider";
import type { TokenUsage } from "./usage";
import { toAiMessage, toReply } from "./chat";

const usage: TokenUsage = {
  input: 1,
  output: 1,
  total: 2,
  cacheRead: 0,
  cacheWrite: 0,
  reasoning: 0,
};

test("toAiMessage attaches thinking only for a spoke that declared the echo", () => {
  const reasoned: ModelMessage = {
    role: "assistant",
    content: "the answer",
    reasoning: "the thought",
  };
  const echoed = toAiMessage(reasoned, true);
  expect(echoed).toMatchObject({
    role: "assistant",
    content: [
      { type: "reasoning", text: "the thought" },
      { type: "text", text: "the answer" },
    ],
  });
  // The safe default: a spoke that did NOT declare the echo gets the message exactly as before.
  expect(toAiMessage(reasoned, false)).toMatchObject({
    role: "assistant",
    content: "the answer",
  });
});

test("toAiMessage keeps thinking beside tool calls, ahead of them", () => {
  const reasoned: ModelMessage = {
    role: "assistant",
    content: "let me look",
    reasoning: "search first",
    toolCalls: [{ id: "c1", name: "list", args: {} }],
  };
  const echoed = toAiMessage(reasoned, true);
  expect(echoed.content).toEqual([
    { type: "reasoning", text: "search first" },
    { type: "text", text: "let me look" },
    { type: "tool-call", toolCallId: "c1", toolName: "list", input: {} },
  ]);
});

test("a message without thinking maps to its existing string shape", () => {
  const plain: ModelMessage = { role: "assistant", content: "hi" };
  expect(toAiMessage(plain, true)).toMatchObject({ role: "assistant", content: "hi" });
});

test("toReply carries the thought into both reply kinds", () => {
  expect(toReply("hi", [], usage, "thought")).toEqual({
    kind: "say",
    text: "hi",
    usage,
    reasoning: "thought",
  });
  const calls = [{ toolCallId: "c1", toolName: "list", input: {} }];
  expect(toReply("go", calls, usage, "thought")).toEqual({
    kind: "use",
    text: "go",
    calls: [{ id: "c1", name: "list", args: {} }],
    usage,
    reasoning: "thought",
  });
});

test("toReply without thinking keeps the prior exact shape", () => {
  expect(toReply("hi", [], usage)).toEqual({
    kind: "say",
    text: "hi",
    usage,
  });
});