/**
 * Kit's tools, served over MCP on stdio.
 *
 * WHAT THIS IS FOR, and it is two things at once. A client like Claude Code can be pointed at this
 * and use Hoplight's library, macro catalogs and preset renderers directly. And Kit's own Claude
 * provider points the Claude Code CLI back at Kit through it, which is the only way to get tool calls
 * out of a CLI that runs its own agent loop: it cannot hand a call back unrun, so instead the call
 * comes home here and executes under Kit's rules.
 *
 * THE DISPATCHER IS KIT'S, NOT A SECOND ONE. Every call routes through the same DispatchFn the loop
 * uses, so a tool reaches `execute` only after its zod schema has parsed the arguments and whatever
 * gate the caller wrapped around the dispatcher has allowed it. This module adds no authority of its
 * own; it is a wire, and the moment it starts making its own decisions about what may run, the
 * security story has two owners instead of one.
 *
 * STDOUT IS THE PROTOCOL. Nothing else may be written there, ever. A stray console.log becomes a
 * malformed frame and the client drops the connection, so diagnostics go to stderr.
 */
import { createInterface } from "node:readline";
import { APP_VERSION } from "../version";
import type { DispatchFn } from "../kit/loop/loop-core";
import type { ToolSpec } from "../kit/providers/provider";
import {
  fail,
  initializeResult,
  ok,
  parseLine,
  readToolCall,
  RPC,
  toolResult,
  type JsonRpcReply,
  type McpTool,
} from "./protocol";

export const SERVER_NAME = "hoplight";

/**
 * Kit's tool specs are already JSON Schema, so this is nearly a rename.
 *
 * The one edit: `$schema` is dropped. Zod stamps a draft-2020-12 URL into every schema it emits, and
 * a client that validates the tool list against its own dialect rejects the whole reply over it. That
 * failure is silent and looks nothing like its cause: the real Claude Code CLI answered by RETRYING
 * tools/list three times and then reporting the server as having no tools at all, while every reply
 * it received was a well-formed list of sixteen.
 */
export const toMcpTools = (specs: readonly ToolSpec[]): McpTool[] =>
  specs.map((spec) => ({
    name: spec.name,
    description: spec.description,
    inputSchema: asObjectSchema(spec.schema),
  }));

/**
 * Make a schema legal as an MCP `inputSchema`, which must be an OBJECT schema.
 *
 * Zod emits a bare top-level `oneOf` for a discriminated union, with no `type` beside it. That is
 * valid JSON Schema and invalid MCP, and the failure is brutally disproportionate: a client rejects
 * the ENTIRE tools/list over one such tool. Measured against the real Claude Code CLI, two tools
 * served fine and adding `docs_query` (a union) made all of them vanish, with the client silently
 * retrying tools/list three times and then reporting the server as having no tools.
 *
 * `$schema` goes too. Zod stamps a draft-2020-12 URL into everything it emits and a validator held to
 * a different dialect can refuse it.
 */
export function asObjectSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _dialect, ...rest } = schema;
  // A union at the root keeps its branches; it just gains the object type MCP insists on, so a client
  // sees an object schema whose shape happens to be one of several.
  return rest["type"] === "object" ? rest : { type: "object", ...rest };
}

export interface ServerDeps {
  /** The belt to advertise. Resolved once at start: a client caches tools/list after initialize. */
  tools: readonly ToolSpec[];
  /** Kit's own dispatcher, gate and all. */
  dispatch: DispatchFn;
  /** Diagnostics. Never stdout, which belongs to the protocol. */
  log?: (message: string) => void;
}

/**
 * Answer one request.
 *
 * Returns null when there is nothing to send, which covers notifications and unknown methods that
 * arrived without an id. Exported separately from the stdio loop so every branch can be tested
 * without a process.
 */
export async function handle(
  request: { id?: string | number; method: string; params?: Record<string, unknown> },
  deps: ServerDeps,
): Promise<JsonRpcReply | null> {
  const { id, method, params } = request;
  const answerable = id !== undefined;

  if (method === "initialize") {
    return answerable ? ok(id, initializeResult(params, SERVER_NAME, APP_VERSION)) : null;
  }
  // Handshake and keepalive notifications carry no id and want no reply.
  if (method === "notifications/initialized" || method === "notifications/cancelled") return null;
  if (method === "ping") return answerable ? ok(id, {}) : null;

  if (method === "tools/list") {
    return answerable ? ok(id, { tools: toMcpTools(deps.tools) }) : null;
  }

  /**
   * Discovery probes for capabilities this server does not have, answered with EMPTY LISTS.
   *
   * Measured against the real Claude Code CLI: it asks for resources/list and prompts/list after
   * initialize regardless of what the handshake advertised, and a methodNotFound error there makes it
   * treat the whole server as unavailable. The tools were being served correctly and the client still
   * reported no tools at all, because discovery had already failed.
   *
   * "I have none of those" is both true and survivable; "that method does not exist" is neither.
   */
  if (method === "resources/list") return answerable ? ok(id, { resources: [] }) : null;
  if (method === "resources/templates/list") return answerable ? ok(id, { resourceTemplates: [] }) : null;
  if (method === "prompts/list") return answerable ? ok(id, { prompts: [] }) : null;

  if (method === "tools/call") {
    if (!answerable) return null;
    const call = readToolCall(params);
    if (!call) return fail(id, RPC.invalidParams, "tools/call needs a tool name");
    try {
      const result = await deps.dispatch({ id: String(id), name: call.name, args: call.args });
      // An unknown tool or bad arguments already come back as ordinary output from the dispatcher,
      // which is the right shape: the model should read the problem and correct itself.
      return ok(id, toolResult(result.output));
    } catch (error) {
      // A thrown tool is reported to the MODEL as a failed tool, not to the client as a broken
      // server. A client told the server is broken disconnects, which would cost the whole belt.
      deps.log?.(`tool ${call.name} threw: ${(error as Error).message}`);
      return ok(id, toolResult(`${call.name} failed: ${(error as Error).message}`, true));
    }
  }

  // Methods for capabilities this server does not advertise. Answered honestly rather than ignored,
  // so a client sees a clean refusal instead of a timeout.
  if (!answerable) return null;
  return fail(id, RPC.methodNotFound, `this server does not implement ${method}`);
}

/**
 * Run the server until stdin closes.
 *
 * Requests are handled one at a time, in arrival order. MCP permits concurrency, but Kit's tools
 * touch a shared studio and its change session, and serialising here means the server can never be
 * the reason two writes interleave.
 */
export function serve(deps: ServerDeps, input: NodeJS.ReadableStream = process.stdin): Promise<void> {
  return new Promise((resolve) => {
    const write = (reply: JsonRpcReply): void => {
      process.stdout.write(`${JSON.stringify(reply)}\n`);
    };
    let queue: Promise<void> = Promise.resolve();
    const lines = createInterface({ input });
    lines.on("line", (line) => {
      const request = parseLine(line);
      if (!request) {
        // Unparseable input with no recoverable id: the spec's null-id parse error is the only
        // honest answer, and silence would leave a client waiting forever.
        if (line.trim()) write(fail(null, RPC.parseError, "could not parse that frame"));
        return;
      }
      queue = queue.then(async () => {
        const reply = await handle(request, deps);
        if (reply) write(reply);
      }).catch((error: Error) => {
        deps.log?.(`handler failed: ${error.message}`);
        if (request.id !== undefined) write(fail(request.id, RPC.internalError, error.message));
      });
    });
    lines.on("close", () => {
      void queue.then(resolve);
    });
  });
}
