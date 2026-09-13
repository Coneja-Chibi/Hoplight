/**
 * The client side of the MCP wire, as shapes and parsing only.
 *
 * protocol.ts owns the SERVER side of the same conversation: parse a request, build a reply. This is
 * its mirror - build a request, read a reply - and it exists for the same reason in the same style:
 * over stdio, MCP is newline-delimited JSON-RPC 2.0 with a handful of methods, and the official SDK's
 * seventeen transitive dependencies buy nothing here but HTTP transport and OAuth this repo will not
 * use. One pure module, exhaustively testable without a process.
 *
 * TOLERANT READS, for the same reason the server echoes the client's protocol version: the servers on
 * the other end are other people's code at every quality level, and a reply that is shaped wrong in a
 * survivable way should degrade to "no tools" or "error text", never to a crash inside Kit.
 */
import { PROTOCOL_VERSION, type McpTool } from "./protocol";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Build the `initialize` request. The id scheme is the caller's; ids only need to be unique per connection. */
export const initializeRequest = (id: number, clientName: string, clientVersion: string): string =>
  JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: clientName, version: clientVersion },
    },
  });

/** The spec requires this notification after a successful initialize; some servers wait for it. */
export const initializedNotification = (): string =>
  JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" });

export const toolsListRequest = (id: number): string =>
  JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list", params: {} });

export const toolCallRequest = (id: number, name: string, args: Record<string, unknown>): string =>
  JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });

/** A parsed reply: matched by id, carrying either a result or an error message. */
export type ClientReply =
  | { readonly kind: "result"; readonly id: number; readonly result: unknown }
  | { readonly kind: "error"; readonly id: number; readonly message: string };

/**
 * Parse one stdout line from a server. Null for anything that is not a reply to us - blank lines,
 * malformed JSON, notifications, server-to-client requests. Silence is the correct response to all
 * of those in v1; a server that needs its pings answered will surface as a timeout with its name on
 * it rather than a mystery hang.
 */
export function parseReplyLine(line: string): ClientReply | null {
  const text = line.trim();
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRec(raw)) return null;
  const id = raw["id"];
  if (typeof id !== "number") return null; // our ids are numbers; anything else is not for us
  if ("method" in raw) return null; // a server-to-client REQUEST, not a reply
  const error = raw["error"];
  if (isRec(error)) {
    const message = typeof error["message"] === "string" ? error["message"] : "unknown error";
    return { kind: "error", id, message };
  }
  return { kind: "result", id, result: raw["result"] };
}

/**
 * Read a `tools/list` result into tools this side can use.
 *
 * Entries missing a usable name are dropped and COUNTED, never silently: a server advertising ten
 * tools of which three are unusable should read as "7 tools (3 malformed)", not as seven.
 */
export function readToolsList(result: unknown): { tools: McpTool[]; dropped: number } {
  const list = isRec(result) && Array.isArray(result["tools"]) ? result["tools"] : [];
  const tools: McpTool[] = [];
  let dropped = 0;
  for (const entry of list) {
    if (!isRec(entry) || typeof entry["name"] !== "string" || entry["name"] === "") {
      dropped += 1;
      continue;
    }
    tools.push({
      name: entry["name"],
      description: typeof entry["description"] === "string" ? entry["description"] : "",
      inputSchema: isRec(entry["inputSchema"])
        ? entry["inputSchema"]
        : { type: "object", properties: {} },
    });
  }
  return { tools, dropped };
}

/**
 * Read a `tools/call` result into text for the model.
 *
 * MCP's `isError: true` is a TOOL failure travelling as a result, exactly as our own server sends it
 * (see protocol.ts toolResult) - it must come back as failed text the model can react to, never as a
 * connection problem. Non-text content blocks are named rather than dropped, so a server that
 * answers with an image does not read as having answered with nothing.
 */
export function readToolResult(result: unknown): { text: string; isError: boolean } {
  if (!isRec(result)) return { text: "(no result)", isError: true };
  const parts: string[] = [];
  const content = Array.isArray(result["content"]) ? result["content"] : [];
  for (const block of content) {
    if (!isRec(block)) continue;
    if (block["type"] === "text" && typeof block["text"] === "string") parts.push(block["text"]);
    else if (typeof block["type"] === "string") parts.push(`(${block["type"]} content omitted)`);
  }
  return {
    text: parts.join("\n") || "(empty result)",
    isError: result["isError"] === true,
  };
}
