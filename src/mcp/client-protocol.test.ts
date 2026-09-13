/**
 * The client half of the MCP wire, pure.
 *
 * The failure family under test is other people's servers: replies shaped almost right must degrade
 * to "no tools" or error text, never to a crash inside Kit's session build.
 */
import { describe, expect, test } from "bun:test";
import {
  initializeRequest,
  initializedNotification,
  parseReplyLine,
  readToolResult,
  readToolsList,
  toolCallRequest,
} from "./client-protocol";

describe("requests", () => {
  test("initialize carries the protocol version and who is asking", () => {
    const parsed = JSON.parse(initializeRequest(1, "hoplight", "1.2.3")) as Record<string, unknown>;
    expect(parsed["method"]).toBe("initialize");
    expect(parsed["params"]).toMatchObject({ clientInfo: { name: "hoplight", version: "1.2.3" } });
  });

  test("the initialized notification has no id, because it must never be answered", () => {
    expect("id" in (JSON.parse(initializedNotification()) as object)).toBe(false);
  });

  test("a tool call names the tool and carries the arguments verbatim", () => {
    const parsed = JSON.parse(toolCallRequest(7, "echo", { text: "hi" })) as Record<string, unknown>;
    expect(parsed["params"]).toEqual({ name: "echo", arguments: { text: "hi" } });
  });
});

describe("parseReplyLine", () => {
  test("reads a result and an error, matched by numeric id", () => {
    expect(parseReplyLine('{"jsonrpc":"2.0","id":3,"result":{"x":1}}'))
      .toEqual({ kind: "result", id: 3, result: { x: 1 } });
    expect(parseReplyLine('{"jsonrpc":"2.0","id":4,"error":{"code":-1,"message":"nope"}}'))
      .toEqual({ kind: "error", id: 4, message: "nope" });
  });

  test("silence for everything that is not a reply to us", () => {
    // Blank, malformed, a notification, a server-to-client request, a string id we never issue.
    for (const line of [
      "",
      "   ",
      "not json",
      '{"jsonrpc":"2.0","method":"notifications/progress"}',
      '{"jsonrpc":"2.0","id":9,"method":"sampling/createMessage"}',
      '{"jsonrpc":"2.0","id":"srv-1","result":{}}',
    ]) {
      expect(parseReplyLine(line)).toBeNull();
    }
  });

  test("an error without a usable message still reads as an error", () => {
    expect(parseReplyLine('{"jsonrpc":"2.0","id":1,"error":{}}'))
      .toEqual({ kind: "error", id: 1, message: "unknown error" });
  });
});

describe("readToolsList", () => {
  test("drops malformed entries and COUNTS them, never silently", () => {
    const { tools, dropped } = readToolsList({
      tools: [
        { name: "good", description: "fine", inputSchema: { type: "object" } },
        { description: "nameless" },
        { name: "" },
        { name: "bare" },
      ],
    });
    expect(tools.map((t) => t.name)).toEqual(["good", "bare"]);
    expect(dropped).toBe(2);
    // A tool without a schema still gets a legal empty object schema, not undefined.
    expect(tools[1]!.inputSchema).toEqual({ type: "object", properties: {} });
  });

  test("a result that is not a list at all is no tools, not a crash", () => {
    for (const raw of [null, 42, "x", {}, { tools: "nope" }]) {
      expect(readToolsList(raw)).toEqual({ tools: [], dropped: 0 });
    }
  });
});

describe("readToolResult", () => {
  test("joins text blocks and carries isError through", () => {
    expect(readToolResult({ content: [{ type: "text", text: "a" }, { type: "text", text: "b" }], isError: true }))
      .toEqual({ text: "a\nb", isError: true });
  });

  test("a non-text block is named rather than dropped", () => {
    const out = readToolResult({ content: [{ type: "image", data: "..." }] });
    expect(out.text).toContain("image content omitted");
    expect(out.isError).toBe(false);
  });

  test("nothing usable reads as an error the model can see", () => {
    expect(readToolResult(null)).toEqual({ text: "(no result)", isError: true });
    expect(readToolResult({ content: [] })).toEqual({ text: "(empty result)", isError: false });
  });
});
