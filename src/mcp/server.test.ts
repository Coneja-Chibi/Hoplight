/**
 * The MCP wire and the request handler.
 *
 * The risks worth pinning are all about the connection surviving. A client that receives a malformed
 * frame, an unmatched reply, or a JSON-RPC error where it expected a tool result will drop the
 * session, and a dropped session costs the whole tool belt for the rest of the turn. So: notifications
 * are never answered, tool failures come back as results rather than errors, and nothing but protocol
 * reaches the caller.
 */
import { describe, expect, test } from "bun:test";
import { fail, ok, parseLine, readToolCall, RPC, toolResult } from "./protocol";
import { asObjectSchema, handle, toMcpTools, type ServerDeps } from "./server";
import type { ToolSpec } from "../kit/providers/provider";

const SPECS: ToolSpec[] = [
  { name: "studio_list", description: "List the studio.", schema: { type: "object", properties: {} } },
];

const deps = (over: Partial<ServerDeps> = {}): ServerDeps => ({
  tools: SPECS,
  dispatch: async (call) => ({ summary: `${call.name}: ok`, output: `ran ${call.name}` }),
  ...over,
});

describe("parseLine", () => {
  test("reads a request with its id and params", () => {
    const parsed = parseLine('{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"x"}}');
    expect(parsed).toEqual({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "x" } });
  });

  test("a notification parses with no id, so the caller cannot answer it by accident", () => {
    const parsed = parseLine('{"jsonrpc":"2.0","method":"notifications/initialized"}');
    expect(parsed?.id).toBeUndefined();
  });

  test("junk is null rather than a throw", () => {
    for (const line of ["", "   ", "not json", "[1,2]", "null", '{"no":"method"}']) {
      expect(parseLine(line)).toBeNull();
    }
  });
});

describe("handle", () => {
  test("initialize echoes the client's protocol version rather than asserting ours", async () => {
    // A client told a newer revision than it speaks may simply disconnect.
    const reply = await handle(
      { id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } },
      deps(),
    );
    expect((reply as { result: { protocolVersion: string } }).result.protocolVersion).toBe("2024-11-05");
  });

  test("tools/list advertises Kit's belt", async () => {
    const reply = await handle({ id: 2, method: "tools/list" }, deps());
    const tools = (reply as { result: { tools: unknown[] } }).result.tools;
    expect(tools).toHaveLength(1);
    expect(tools[0]).toEqual({
      name: "studio_list",
      description: "List the studio.",
      inputSchema: { type: "object", properties: {} },
    });
  });

  test("a notification is answered with SILENCE", async () => {
    // Replying would put an unmatched frame on the wire that the client cannot interpret.
    for (const method of ["notifications/initialized", "notifications/cancelled"]) {
      expect(await handle({ method }, deps())).toBeNull();
    }
  });

  test("tools/call routes through Kit's dispatcher and returns its output", async () => {
    const seen: string[] = [];
    const reply = await handle(
      { id: 3, method: "tools/call", params: { name: "studio_list", arguments: { kind: "preset" } } },
      deps({
        dispatch: async (call) => {
          seen.push(`${call.name}:${JSON.stringify(call.args)}`);
          return { summary: "ok", output: "four presets" };
        },
      }),
    );
    expect(seen).toEqual(['studio_list:{"kind":"preset"}']);
    expect(reply).toEqual(ok(3, toolResult("four presets")));
  });

  test("a THROWN tool is a failed result, not a broken server", async () => {
    // The distinction that keeps the belt alive: a JSON-RPC error tells the client the server is
    // broken and clients respond by disconnecting, which would cost every remaining tool this turn.
    const reply = await handle(
      { id: 4, method: "tools/call", params: { name: "studio_list" } },
      deps({ dispatch: async () => { throw new Error("disk on fire"); } }),
    ) as { result: { isError: boolean; content: { text: string }[] } };
    expect(reply.result.isError).toBe(true);
    expect(reply.result.content[0]!.text).toContain("disk on fire");
    expect((reply as unknown as { error?: unknown }).error).toBeUndefined();
  });

  test("tools/call with no name is an invalid-params error", async () => {
    const reply = await handle({ id: 5, method: "tools/call", params: {} }, deps());
    expect(reply).toEqual(fail(5, RPC.invalidParams, "tools/call needs a tool name"));
  });

  test("discovery probes answer EMPTY rather than erroring", async () => {
    // Measured against the real CLI: it asks for these after initialize whatever the handshake
    // advertised, and a methodNotFound there makes it treat the whole server as unavailable. The
    // tools were being served correctly and the client still reported none, because discovery had
    // already failed. "I have none of those" is survivable; "no such method" is not.
    const probes: [string, string][] = [
      ["resources/list", "resources"],
      ["resources/templates/list", "resourceTemplates"],
      ["prompts/list", "prompts"],
    ];
    for (const [method, key] of probes) {
      const reply = await handle({ id: 6, method }, deps()) as { result: Record<string, unknown[]>; error?: unknown };
      expect(reply.error).toBeUndefined();
      expect(reply.result[key]).toEqual([]);
    }
  });

  test("a genuinely unknown method still refuses cleanly instead of timing out", async () => {
    const reply = await handle({ id: 6, method: "sampling/createMessage" }, deps()) as { error: { code: number } };
    expect(reply.error.code).toBe(RPC.methodNotFound);
  });

  test("ping is answered, because a client uses it to decide we are alive", async () => {
    expect(await handle({ id: 7, method: "ping" }, deps())).toEqual(ok(7, {}));
  });
});

describe("readToolCall", () => {
  test("missing arguments become an empty object, not a refusal", () => {
    // A zero-argument tool is legitimate and some clients omit the key entirely.
    expect(readToolCall({ name: "x" })).toEqual({ name: "x", args: {} });
  });

  test("a call with no usable name is null", () => {
    for (const params of [undefined, {}, { name: "" }, { name: 3 }]) {
      expect(readToolCall(params as Record<string, unknown>)).toBeNull();
    }
  });
});

describe("toMcpTools", () => {
  test("Kit's specs are already JSON Schema, so this is a rename", () => {
    expect(toMcpTools(SPECS)[0]!.inputSchema).toEqual(SPECS[0]!.schema);
  });
});

describe("asObjectSchema", () => {
  test("a union schema gains the object type MCP requires", () => {
    // Zod emits a bare top-level oneOf for a discriminated union. Measured against the real CLI: one
    // such tool made ALL sixteen vanish, because a client rejects the whole tools/list over it.
    const union = { $schema: "https://json-schema.org/draft/2020-12/schema", oneOf: [{ type: "object" }] };
    const out = asObjectSchema(union);
    expect(out["type"]).toBe("object");
    expect(out["oneOf"]).toEqual([{ type: "object" }]);
  });

  test("the dialect stamp is dropped, since a validator on another dialect refuses it", () => {
    const out = asObjectSchema({ $schema: "https://json-schema.org/draft/2020-12/schema", type: "object" });
    expect(out["$schema"]).toBeUndefined();
    expect(out["type"]).toBe("object");
  });

  test("an ordinary object schema keeps its shape", () => {
    const plain = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };
    expect(asObjectSchema({ ...plain })).toEqual(plain);
  });
});
