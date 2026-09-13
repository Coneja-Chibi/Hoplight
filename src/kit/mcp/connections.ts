/**
 * Live MCP connections - the one place external server processes are spawned, spoken to, and killed.
 *
 * ONE MANAGER PER PROCESS. Sessions come and go (the window rebuilds one per boot, the terminal makes
 * its own), and a server process per session would leak children exactly the way this machine has
 * been burned before. Connections are keyed by server id and reused; a config change is noticed by
 * comparing the spawn recipe, and the old child is killed before the new one starts.
 *
 * EVERY CHILD DIES WITH US. Windows does not reap orphans, so exit/SIGINT/SIGTERM hooks kill the lot
 * (`process.once`, never `on` - re-raising inside an `on` handler loops forever, a lesson this repo
 * has already paid for). A child that outlives a kill request is beyond what stdio can promise; the
 * hooks are the honest best effort.
 *
 * TIMEOUTS EVERYWHERE, because the other end is somebody else's code. A server that never answers
 * initialize is "failed" with its stderr attached, not a hang inside session build; a tool call that
 * never returns is an error result the model can read, not a dead turn.
 */
import { APP_VERSION } from "../../version";
import {
  initializedNotification,
  initializeRequest,
  parseReplyLine,
  readToolResult,
  readToolsList,
  toolCallRequest,
  toolsListRequest,
} from "../../mcp/client-protocol";
import type { McpTool } from "../../mcp/protocol";
import type { McpServerEntry } from "./config";

const CONNECT_TIMEOUT_MS = 15_000;
const CALL_TIMEOUT_MS = 60_000;
/** Keep the last little stderr, because that is where a failing server explains itself. */
const STDERR_KEEP = 2_000;

export interface McpConnectionStatus {
  readonly id: string;
  readonly state: "connected" | "failed";
  readonly tools: number;
  /** malformed tool entries the server advertised; named so "covered" is never overstated */
  readonly dropped: number;
  readonly detail?: string;
}

interface Pending {
  resolve: (reply: { kind: "result"; result: unknown } | { kind: "error"; message: string }) => void;
  timer: ReturnType<typeof setTimeout>;
}

class Connection {
  readonly entry: McpServerEntry;
  readonly recipe: string;
  tools: McpTool[] = [];
  dropped = 0;
  private child: ReturnType<typeof Bun.spawn> | null = null;
  private sink: { write(data: string): unknown; end?(): unknown } | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private stderrTail = "";
  private dead = false;

  constructor(entry: McpServerEntry) {
    this.entry = entry;
    this.recipe = JSON.stringify([entry.command, entry.args, entry.env]);
  }

  async start(): Promise<void> {
    const child = Bun.spawn([this.entry.command, ...this.entry.args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, ...this.entry.env },
    });
    this.child = child;
    this.sink = child.stdin as unknown as { write(data: string): unknown };
    void this.readLines(child.stdout);
    void this.readStderr(child.stderr);
    void child.exited.then(() => { this.failAll("the server process exited"); });

    const init = await this.request(initializeRequest(this.nextId, "hoplight", APP_VERSION), this.nextId++, CONNECT_TIMEOUT_MS);
    if (init.kind === "error") throw new Error(`initialize failed: ${init.message}${this.stderrNote()}`);
    this.send(initializedNotification());

    const listId = this.nextId++;
    const listed = await this.request(toolsListRequest(listId), listId, CONNECT_TIMEOUT_MS);
    if (listed.kind === "error") throw new Error(`tools/list failed: ${listed.message}${this.stderrNote()}`);
    const { tools, dropped } = readToolsList(listed.result);
    this.tools = tools;
    this.dropped = dropped;
  }

  /** Run one tool. Failures come back as text for the model, never as a throw into the loop. */
  async call(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
    if (this.dead || !this.child) return { text: `${this.entry.id}: the server is not running`, isError: true };
    const id = this.nextId++;
    const reply = await this.request(toolCallRequest(id, name, args), id, CALL_TIMEOUT_MS);
    if (reply.kind === "error") return { text: `${this.entry.id}: ${reply.message}`, isError: true };
    return readToolResult(reply.result);
  }

  stop(): void {
    this.dead = true;
    this.failAll("the connection was closed");
    try {
      this.child?.kill();
    } catch {
      /* already gone */
    }
    this.child = null;
  }

  private stderrNote(): string {
    const tail = this.stderrTail.trim();
    return tail ? ` (server said: ${tail.slice(-300)})` : "";
  }

  private send(line: string): void {
    try {
      this.sink?.write(`${line}\n`);
    } catch {
      this.failAll("the server's stdin closed");
    }
  }

  private request(
    line: string,
    id: number,
    timeoutMs: number,
  ): Promise<{ kind: "result"; result: unknown } | { kind: "error"; message: string }> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ kind: "error", message: `no reply within ${Math.round(timeoutMs / 1000)}s${this.stderrNote()}` });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.send(line);
    });
  }

  private settle(id: number, reply: { kind: "result"; result: unknown } | { kind: "error"; message: string }): void {
    const waiting = this.pending.get(id);
    if (!waiting) return;
    this.pending.delete(id);
    clearTimeout(waiting.timer);
    waiting.resolve(reply);
  }

  private failAll(why: string): void {
    this.dead = true;
    for (const id of [...this.pending.keys()]) this.settle(id, { kind: "error", message: why });
  }

  private async readLines(stream: ReadableStream<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for await (const chunk of stream) {
        buffer += decoder.decode(chunk, { stream: true });
        let cut = buffer.indexOf("\n");
        while (cut >= 0) {
          const reply = parseReplyLine(buffer.slice(0, cut));
          buffer = buffer.slice(cut + 1);
          cut = buffer.indexOf("\n");
          if (!reply) continue;
          if (reply.kind === "error") this.settle(reply.id, { kind: "error", message: reply.message });
          else this.settle(reply.id, { kind: "result", result: reply.result });
        }
      }
    } catch {
      /* stream broke; the exited handler reports it */
    }
  }

  private async readStderr(stream: ReadableStream<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    try {
      for await (const chunk of stream) {
        this.stderrTail = (this.stderrTail + decoder.decode(chunk, { stream: true })).slice(-STDERR_KEEP);
      }
    } catch {
      /* fine */
    }
  }
}

const live = new Map<string, Connection>();
const failures = new Map<string, string>();
let hooked = false;

function hookExit(): void {
  if (hooked) return;
  hooked = true;
  const stop = (): void => stopAllMcp();
  process.once("exit", stop);
  process.once("SIGINT", () => { stop(); process.exit(130); });
  process.once("SIGTERM", () => { stop(); process.exit(143); });
}

/**
 * Bring connections in line with the config: start what is enabled and new, restart what changed,
 * stop what is gone or disabled. Failures are recorded per server and never throw - one broken
 * server must not cost the session its belt.
 */
export async function syncMcpConnections(entries: readonly McpServerEntry[]): Promise<void> {
  hookExit();
  const wanted = new Map(entries.filter((e) => e.enabled).map((e) => [e.id, e]));

  for (const [id, connection] of [...live]) {
    const entry = wanted.get(id);
    if (!entry || JSON.stringify([entry.command, entry.args, entry.env]) !== connection.recipe) {
      connection.stop();
      live.delete(id);
    }
  }

  for (const [id, entry] of wanted) {
    if (live.has(id)) continue;
    const connection = new Connection(entry);
    try {
      await connection.start();
      live.set(id, connection);
      failures.delete(id);
    } catch (error) {
      connection.stop();
      failures.set(id, error instanceof Error ? error.message : "could not connect");
    }
  }
}

/** The connected servers' tools, with the server id each came from. */
export function connectedMcpTools(): { serverId: string; tool: McpTool }[] {
  const out: { serverId: string; tool: McpTool }[] = [];
  for (const [id, connection] of live) {
    for (const tool of connection.tools) out.push({ serverId: id, tool });
  }
  return out;
}

/** Run one tool on one server. */
export async function callMcpTool(
  serverId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const connection = live.get(serverId);
  if (!connection) return { text: `${serverId}: not connected`, isError: true };
  return connection.call(tool, args);
}

/** Per-server state for the settings screen and for an honest session note. */
export function mcpStatus(entries: readonly McpServerEntry[]): McpConnectionStatus[] {
  return entries.map((entry) => {
    const connection = live.get(entry.id);
    if (connection) {
      return { id: entry.id, state: "connected", tools: connection.tools.length, dropped: connection.dropped };
    }
    return {
      id: entry.id,
      state: "failed",
      tools: 0,
      dropped: 0,
      detail: entry.enabled ? (failures.get(entry.id) ?? "not connected") : "disabled",
    };
  });
}

export function stopAllMcp(): void {
  for (const connection of live.values()) connection.stop();
  live.clear();
}

/**
 * Try one server without touching the live set: spawn, handshake, count tools, kill.
 *
 * The settings screen's Test button. A throwaway connection, so testing a disabled entry never
 * smuggles it into the belt, and a test that hangs is killed by its own timeout rather than parked
 * beside real connections.
 */
export async function probeMcpServer(
  entry: McpServerEntry,
): Promise<{ ok: boolean; tools: number; dropped: number; detail?: string }> {
  const connection = new Connection(entry);
  try {
    await connection.start();
    return { ok: true, tools: connection.tools.length, dropped: connection.dropped };
  } catch (error) {
    return {
      ok: false,
      tools: 0,
      dropped: 0,
      detail: error instanceof Error ? error.message : "could not connect",
    };
  } finally {
    connection.stop();
  }
}
