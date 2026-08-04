/**
 * The MCP wire, as shapes and parsing only.
 *
 * WHY NOT THE OFFICIAL SDK. `@modelcontextprotocol/sdk` is MIT, which would be fine, but it carries
 * seventeen transitive dependencies including express, hono, cors and jose, and nearly all of that
 * serves HTTP transport and OAuth. Over stdio, MCP is newline-delimited JSON-RPC 2.0 with a handful
 * of methods, and this repository already speaks exactly that shape in
 * src/core/preset/render/runner.ts. Seventeen packages into a project that ships a compiled binary
 * and runs a licence audit is a poor trade for framing we can write in one file.
 *
 * This module is PURE. It owns the message shapes and the parsing; server.ts owns stdin, stdout and
 * the tool dispatch. Same split as contract.ts and runner.ts, for the same reason: the part most
 * worth testing exhaustively should not need a process to test.
 */

/** The version this server speaks. A client asking for another is echoed its own back, per spec. */
export const PROTOCOL_VERSION = "2025-06-18";

export interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  /** Absent on a notification, which must never be answered. */
  readonly id?: string | number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export interface JsonRpcSuccess {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly result: unknown;
}

export interface JsonRpcFailure {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly error: { readonly code: number; readonly message: string };
}

export type JsonRpcReply = JsonRpcSuccess | JsonRpcFailure;

/** The JSON-RPC codes this server can produce. Anything else would be inventing a dialect. */
export const RPC = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

export const ok = (id: string | number, result: unknown): JsonRpcSuccess =>
  ({ jsonrpc: "2.0", id, result });

export const fail = (id: string | number | null, code: number, message: string): JsonRpcFailure =>
  ({ jsonrpc: "2.0", id, error: { code, message } });

/**
 * Parse one line into a request.
 *
 * Returns null for anything unusable, INCLUDING a well-formed notification, because the caller's only
 * correct response to both is silence. A notification carries no id, and answering one would put an
 * unmatched reply on the wire that the client has no way to interpret.
 */
export function parseLine(line: string): JsonRpcRequest | null {
  const text = line.trim();
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record["method"] !== "string") return null;
  const id = record["id"];
  const hasId = typeof id === "string" || typeof id === "number";
  const params = record["params"];
  return {
    jsonrpc: "2.0",
    ...(hasId ? { id: id as string | number } : {}),
    method: record["method"],
    ...(params !== null && typeof params === "object" && !Array.isArray(params)
      ? { params: params as Record<string, unknown> }
      : {}),
  };
}

/** One tool as MCP describes it. `inputSchema` is JSON Schema, which Kit's tools already produce. */
export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/**
 * The `initialize` result.
 *
 * The client's requested version is echoed rather than ours asserted: a client on an older revision
 * that is told a newer number may simply disconnect, and every method this server implements has been
 * stable across the revisions in question.
 */
export function initializeResult(params: Record<string, unknown> | undefined, name: string, version: string): unknown {
  const asked = params?.["protocolVersion"];
  return {
    protocolVersion: typeof asked === "string" && asked ? asked : PROTOCOL_VERSION,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name, version },
  };
}

/**
 * A tool result, in the shape MCP expects.
 *
 * A FAILED TOOL IS NOT A PROTOCOL ERROR. It comes back as a normal result carrying `isError: true`,
 * so the model reads the failure and can react to it. Returning a JSON-RPC error instead would tell
 * the client the SERVER is broken, and clients respond to that by dropping the connection, which
 * would turn one bad argument into a dead tool belt for the rest of the turn.
 */
export const toolResult = (text: string, isError = false): unknown =>
  ({ content: [{ type: "text", text }], isError });

/** Read a `tools/call` request's name and arguments, tolerating a client that omits arguments. */
export function readToolCall(
  params: Record<string, unknown> | undefined,
): { name: string; args: Record<string, unknown> } | null {
  const name = params?.["name"];
  if (typeof name !== "string" || !name) return null;
  const args = params?.["arguments"];
  return {
    name,
    args: args !== null && typeof args === "object" && !Array.isArray(args)
      ? args as Record<string, unknown>
      : {},
  };
}
