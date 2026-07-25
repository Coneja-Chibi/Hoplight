/** Session replay tests that project stored model messages into render lines. */
import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "../../providers/provider";
import { messagesToLines } from "./replay";

const user = (content: string): ModelMessage => ({ role: "user", content });
const asst = (content: string, toolCalls?: ModelMessage["toolCalls"]): ModelMessage => ({
  role: "assistant",
  content,
  ...(toolCalls ? { toolCalls } : {}),
});
const tool = (content: string, toolName: string): ModelMessage => ({ role: "tool", content, toolName });

describe("messagesToLines", () => {
  test("a plain exchange maps user->you and assistant->say", () => {
    expect(messagesToLines([user("hello"), asst("hi there")])).toEqual([
      { role: "you", text: "hello" },
      { role: "say", text: "hi there" },
    ]);
  });

  test("tool results between two assistant messages fold into one backstage row", () => {
    const lines = messagesToLines([
      user("do the thing"),
      asst("on it", [{ id: "1", name: "grep", args: {} }]),
      tool("3 hits", "grep"),
      tool("read file", "read"),
      asst("done"),
    ]);
    expect(lines).toEqual([
      { role: "you", text: "do the thing" },
      { role: "say", text: "on it" },
      { role: "backstage", moves: ["grep · 3 hits", "read · read file"], seconds: 0, open: false },
      { role: "say", text: "done" },
    ]);
  });

  test("a trailing tool cluster with no closing assistant is still sealed", () => {
    const lines = messagesToLines([user("go"), asst(""), tool("ok", "run")]);
    expect(lines).toEqual([
      { role: "you", text: "go" },
      { role: "backstage", moves: ["run · ok"], seconds: 0, open: false },
    ]);
  });

  test("empty assistant text produces no say line", () => {
    expect(messagesToLines([user("hi"), asst("")])).toEqual([{ role: "you", text: "hi" }]);
  });

  test("malformed messages are dropped, never thrown", () => {
    const dirty = [
      user("keep"),
      { role: "bogus", content: "x" },
      { role: "assistant" },
      null,
      "nope",
      asst("kept too"),
    ] as unknown as ModelMessage[];
    expect(messagesToLines(dirty)).toEqual([
      { role: "you", text: "keep" },
      { role: "say", text: "kept too" },
    ]);
  });
});
