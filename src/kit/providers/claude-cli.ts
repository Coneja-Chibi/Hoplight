/**
 * Claude on the subscription already signed in on this machine, driven through the Claude Code CLI.
 *
 * NOT A DEPENDENCY, AND THAT IS THE POINT. The Agent SDK npm package is proprietary (its LICENSE.md
 * reserves all rights to Anthropic PBC), and Hoplight is AGPL-3.0 shipping a compiled binary, so bundling it
 * would be a licence conflict. Anthropic's own Agent SDK overview names the way out: to drive the
 * same agent loop from another language, run the CLI as a subprocess with `-p` and
 * `--output-format json`. The SDK spawns that CLI internally regardless, so this is the same
 * architecture with one fewer package and no proprietary code in our artefact.
 *
 * It also matches a pattern this repo already proved: src/core/preset/render/runner.ts spawns a
 * process, speaks a JSON contract over stdio, and returns every failure as a value rather than a
 * throw. The three preset renderers run on it.
 *
 * WHAT THIS COSTS, MEASURED, because it must not be a surprise on a bill. Even with the system
 * prompt replaced and the CLI's own tools disallowed, a single turn carries roughly 18,000
 * cache-creation tokens of harness framing that nobody typed. That is the CLI defining its
 * scaffolding, it cannot be switched off, and it is charged against the plan on every turn.
 */
import { rmSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatDelta, ChatFn, ModelMessage, ModelReply } from "./provider";
import { readUsage, type TokenUsage } from "./usage";

/** Long enough for a real reply on a slow model, finite so a wedged subprocess cannot hang Kit. */
const TURN_TIMEOUT_MS = 300_000;

/** Stdout is bounded: a runaway subprocess must not be able to exhaust memory. */
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

/**
 * The CLI's own tools, refused.
 *
 * Kit drives its own loop and owns its own permission gate. Letting the CLI read and write files
 * under its own rules would put a second authority inside a Kit turn, with none of Kit's review
 * surface in front of it.
 */
/** How the CLI namespaces a tool from our server. The allowlist is built from it. */
export const MCP_TOOL_PREFIX = "mcp__hoplight__";

const REFUSED_TOOLS = [
  "Bash", "Read", "Write", "Edit", "NotebookEdit", "Glob", "Grep",
  "WebFetch", "WebSearch", "Task", "TodoWrite",
].join(",");

/**
 * Fold Kit's history into one prompt.
 *
 * The CLI is one-shot per invocation, so prior turns have to arrive as text. Kit's loop hands the
 * whole history every turn and expects the provider to be stateless, which this matches exactly:
 * no session id to track, nothing to reconcile if a turn is abandoned.
 *
 * The cost is that the CLI's prompt cache cannot hold across turns. Resuming a real session would
 * fix that and would mean owning session state that Kit already owns, so it is deliberately not done
 * here; the note exists so a later reader knows it was a choice.
 */
export function foldHistory(messages: readonly ModelMessage[]): string {
  const turns: string[] = [];
  for (const message of messages) {
    const text = message.content.trim();
    if (message.role === "tool") {
      // A tool result is evidence the model asked for, so it is labelled as such rather than
      // impersonating the user, who did not say it.
      turns.push(`Tool result (${message.toolName ?? "tool"}): ${text}`);
      continue;
    }
    if (!text) continue;
    turns.push(`${message.role === "user" ? "User" : "Assistant"}: ${text}`);
  }
  // The CLI refuses an empty prompt; a probe with only a system prompt would otherwise fail here.
  return turns.length > 0 ? turns.join("\n\n") : "User: [start]";
}

/**
 * Where Kit writes the MCP config that points the CLI back at Kit's own tools.
 *
 * Per process, not per turn: the CLI reads it at spawn and a stable path keeps the file count from
 * growing with the conversation. It holds no secret, only paths.
 */
/**
 * Write the config and answer with its path, or null when the tool bridge cannot be offered.
 *
 * THIS FILE NAMES A PROGRAM THE CLI WILL EXECUTE, so where it lives is a security decision rather
 * than housekeeping. A predictable name in the shared temp directory (a pid is guessable, and tmpdir
 * is world-writable on a multi-user machine) lets somebody else pre-place a symlink for our write to
 * follow, or replace the file between our write and the CLI's read. Either way the `command` field
 * becomes theirs, and it is run.
 *
 * So: a fresh directory from mkdtemp, whose name nobody can predict and which is owner-only, then the
 * file created with `wx` so an existing entry is a hard failure rather than something to follow, and
 * mode 0600. Removed when the process exits.
 *
 * Null is a real outcome rather than a failure: without the bridge the provider still answers in
 * text, and losing the turn over a temp file would be the poorer trade.
 */
export async function writeMcpConfig(serverCommand: string, serverArgs: readonly string[]): Promise<string | null> {
  try {
    const dir = await mkdtemp(join(tmpdir(), "hoplight-mcp-"));
    const path = join(dir, "config.json");
    await writeFile(
      path,
      JSON.stringify({ mcpServers: { hoplight: { command: serverCommand, args: serverArgs } } }),
      { mode: 0o600, flag: "wx" },
    );
    cleanUpAtExit(dir);
    return path;
  } catch {
    return null;
  }
}

const scratchDirs = new Set<string>();
let exitHooked = false;

/** Remove the scratch directories on the way out; a leftover config naming an executable is litter. */
function cleanUpAtExit(dir: string): void {
  scratchDirs.add(dir);
  if (exitHooked) return;
  exitHooked = true;
  const sweep = (): void => {
    for (const path of scratchDirs) {
      try { rmSync(path, { recursive: true, force: true }); } catch { /* best effort */ }
    }
    scratchDirs.clear();
  };
  process.once("exit", sweep);
  process.once("SIGINT", sweep);
  process.once("SIGTERM", sweep);
}

/** The argument list, built in one place so a test can assert what would actually be run. */
export function cliArgs(model: string, system: string, mcpConfig?: string | null): string[] {
  /**
   * The tool bridge, when there is one.
   *
   * `--strict-mcp-config` is not optional politeness: without it the CLI would also load whatever MCP
   * servers the person has configured for their own work, and those would appear inside a Kit turn as
   * if Kit had offered them.
   *
   * `bypassPermissions` turns OFF the CLI's prompting, which is correct and load-bearing. Kit owns the
   * gate, and two gates asking about the same call would be one too many; but it does mean Kit's gate
   * is now the only one, with no CLI backstop behind it.
   */
  const bridge = mcpConfig
    ? [
      "--mcp-config", mcpConfig,
      // An ALLOWLIST, not a denylist, and the distinction is load-bearing. bypassPermissions turns
      // the CLI's own prompting off because Kit owns the gate, so whatever remains reachable runs
      // unasked. A denylist of the CLI's built-ins would let any tool a future release adds through
      // by default; naming only Kit's own server means the reachable set cannot grow underneath us.
      "--allowedTools", `${MCP_TOOL_PREFIX}*`,
      "--permission-mode", "bypassPermissions",
    ]
    : [];
  return [
    ...bridge,
    "-p",
    "--output-format", "json",
    "--model", model,
    // Replaces the default agent framing rather than appending to it. Measured: this roughly halves
    // the per-turn overhead, from about 36k tokens to about 18k.
    "--system-prompt", system,
    // Do not inherit the user's settings, CLAUDE.md, project config or MCP servers. A Kit turn must
    // carry what Kit sent, not whatever happens to be configured for their coding work.
    "--setting-sources", "",
    // Always, bridge or no bridge. Without it the CLI loads whatever MCP servers the person has set
    // up for their own work, and those would appear inside a Kit turn as if Kit had offered them.
    "--strict-mcp-config",
    "--disallowedTools", REFUSED_TOOLS,
  ];
}

export type CliFailure = "not-installed" | "not-logged-in" | "timeout" | "engine-error" | "bad-output";

export interface CliRefusal {
  readonly ok: false;
  readonly reason: CliFailure;
  readonly detail: string;
}

export interface CliReply {
  readonly ok: true;
  readonly text: string;
  readonly usage: TokenUsage;
  /** What the CLI says this turn cost in dollars, when it says. Reported, never computed by us. */
  readonly costUsd?: number;
}

const refuse = (reason: CliFailure, detail: string): CliRefusal => ({ ok: false, reason, detail });

/**
 * Read the CLI's result object.
 *
 * Strict about `result` being a string for the same reason the render contract is strict about
 * `unresolved`: an absent field and an empty reply are different answers, and collapsing them would
 * let a failed turn read as a model that said nothing.
 */
export function parseCliResult(stdout: string): CliReply | CliRefusal {
  const start = stdout.indexOf("{");
  if (start === -1) return refuse("bad-output", "the CLI produced no JSON result");
  let raw: unknown;
  try {
    raw = JSON.parse(stdout.slice(start));
  } catch {
    return refuse("bad-output", `the CLI's reply was not JSON: ${stdout.slice(0, 120)}`);
  }
  if (raw === null || typeof raw !== "object") {
    return refuse("bad-output", "the CLI's reply was not an object");
  }
  const record = raw as Record<string, unknown>;
  if (record["is_error"] === true) {
    const detail = typeof record["result"] === "string" ? record["result"] : "the CLI reported an error";
    return refuse("engine-error", detail);
  }
  if (typeof record["result"] !== "string") {
    return refuse("bad-output", "the CLI's reply carried no result text");
  }
  const u = (record["usage"] ?? {}) as Record<string, unknown>;
  const num = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  return {
    ok: true,
    text: record["result"],
    usage: readUsage({
      input: num(u["input_tokens"]),
      output: num(u["output_tokens"]),
      cacheRead: num(u["cache_read_input_tokens"]),
      cacheWrite: num(u["cache_creation_input_tokens"]),
    }),
    ...(num(record["total_cost_usd"]) !== undefined ? { costUsd: num(record["total_cost_usd"])! } : {}),
  };
}

/** Turn a spawn failure into the sentence a reader can act on, rather than a Node errno. */
function explainSpawn(error: Error): CliRefusal {
  // Bun reports a missing binary as `code: "ENOENT"` with a message that says "not found in $PATH",
  // so the code is checked as well as the text. Matching only the message missed this entirely.
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || /ENOENT|not found in \$PATH/i.test(error.message)) {
    return refuse(
      "not-installed",
      "Claude Code is not on this machine. Install it (npm i -g @anthropic-ai/claude-code) and run `claude login`.",
    );
  }
  return refuse("engine-error", `could not start Claude Code: ${error.message}`);
}

/** Recognise the CLI's own way of saying nobody is signed in, so the advice names the fix. */
function explainExit(code: number, stderr: string): CliRefusal {
  if (/not logged in|authentication|unauthor|login/i.test(stderr)) {
    return refuse("not-logged-in", "Claude Code is installed but not signed in. Run `claude login`.");
  }
  const detail = stderr.trim().split("\n").slice(-3).join(" ").slice(0, 300);
  return refuse("engine-error", `Claude Code exited ${code}${detail ? `: ${detail}` : ""}`);
}

export interface CliOptions {
  readonly command?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** Path to the MCP config that bridges Kit's tools. Absent means a text-only turn. */
  readonly mcpConfig?: string | null;
}

/** One turn through the CLI. Every failure is a value; nothing here throws. */
export async function runClaudeCli(
  model: string,
  system: string,
  messages: readonly ModelMessage[],
  options: CliOptions = {},
): Promise<CliReply | CliRefusal> {
  const timeoutMs = options.timeoutMs ?? TURN_TIMEOUT_MS;
  let child: ReturnType<typeof Bun.spawn>;
  try {
    child = Bun.spawn([options.command ?? "claude", ...cliArgs(model, system, options.mcpConfig)], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      // The CLI is asked for text, not filesystem work, and it must not inherit a project it can act on.
      env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "hoplight-kit" },
    });
  } catch (error) {
    return explainSpawn(error as Error);
  }

  const kill = (): void => { try { child.kill(); } catch { /* already gone */ } };
  // A killed subprocess exits non-zero, so without this flag a timeout would be reported as whatever
  // the CLI happened to print on its way out rather than as the timeout it was.
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
  const onAbort = (): void => kill();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    // Same narrowing runner.ts uses: Bun types these as `number | FileSink`, and a subprocess that
    // exits before reading closes the pipe under us, which is not the failure worth reporting.
    const stdin = child.stdin;
    if (stdin && typeof stdin !== "number") {
      stdin.write(foldHistory(messages));
      await stdin.end();
    }
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout as ReadableStream<Uint8Array>).text(),
      new Response(child.stderr as ReadableStream<Uint8Array>).text(),
      child.exited,
    ]);
    if (stdout.length > MAX_OUTPUT_BYTES) {
      return refuse("bad-output", "the CLI produced more output than Kit will read");
    }
    if (timedOut) return refuse("timeout", `Claude Code did not answer within ${Math.round(timeoutMs / 1000)}s`);
    if (options.signal?.aborted) return refuse("engine-error", "the turn was cancelled");
    if (code !== 0) return explainExit(code, stderr);
    return parseCliResult(stdout);
  } catch (error) {
    return refuse("engine-error", (error as Error).message);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * The ChatFn Kit's loop calls.
 *
 * TOOLS ARE NOT OFFERED, and a caller must know that rather than discover it. The CLI runs its own
 * agent loop and its own tools; it has no way to hand a tool call back unrun, which is exactly what
 * Kit's loop needs. So this provider answers in text only, and a turn that would have needed a tool
 * simply comes back as a reply saying so. That is a real limitation, stated here and surfaced in the
 * spoke's setup copy.
 */
export function makeClaudeCliChat(model: string, system: string, options: CliOptions = {}): ChatFn {
  return async (messages, _tools, onDelta): Promise<ModelReply> => {
    const outcome = await runClaudeCli(model, system, messages, options);
    if (!outcome.ok) throw new Error(outcome.detail);
    // The CLI's json output arrives whole, so there is nothing to stream; the reply is delivered as
    // one delta so the transcript still paints rather than sitting blank until it lands.
    const delta: ChatDelta = { kind: "text", text: outcome.text };
    onDelta?.(delta);
    return { kind: "say", text: outcome.text, usage: outcome.usage };
  };
}
