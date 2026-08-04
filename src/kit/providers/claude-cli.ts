/**
 * Claude on the subscription already signed in on this machine, driven through the Claude Code CLI.
 *
 * DRIVEN THROUGH `@anthropic-ai/claude-agent-sdk`, the way Marinara's provider does it
 * (`packages/server/src/services/llm/providers/claude-subscription.provider.ts`). An earlier version
 * spawned `claude` by name to keep the SDK out of the dependency tree. That failed in the field:
 * spawning by name trusts PATH, PATH belongs to whichever shell or launcher started Kit, and on
 * Windows the CLI exists only as `%APPDATA%\npm\claude.cmd`. A session that could not see that shim
 * was indistinguishable from a machine without Claude Code, so Kit told people to install what they
 * already had. The SDK resolves its own CLI, which removes the failure rather than describing it
 * better.
 *
 * ONE THING A RELEASE HAS TO SETTLE, stated as fact rather than argument: the SDK package's
 * LICENSE.md reserves all rights to Anthropic PBC, and Hoplight is AGPL-3.0 shipping a compiled
 * binary. It is a runtime dependency now, so `license:audit` and the packaging lane both need to say
 * what happens to it - bundled, peer, or optional-at-runtime.
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
 * How many SDK turns one Kit turn may take when the tool belt is bridged. A tool-using answer is
 * call, result, then reply, and a real question chains several - so this is a runaway stop, not a
 * budget. Text-only turns are capped at 1 instead, where more than one turn means nothing.
 */
const MAX_TOOL_TURNS = 24;

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

/** A bridged tool server: the program the SDK will run to reach Kit's own tools. */
export type McpServers = Record<string, { command: string; args: string[] }>;

/**
 * The SDK options, built in one place so a test can assert what would actually run - the job the old
 * `cliArgs` did for the flag list. The isolation properties asserted against it are not cosmetic:
 * each one is the reason a Kit turn cannot quietly acquire an authority Kit never offered.
 */
export function sdkOptions(model: string, system: string, bridge: McpServers | null): Record<string, unknown> {
  return {
    model,
    // Replaces the default agent framing rather than appending to it. Measured: roughly halves the
    // per-turn overhead, from about 36k tokens to about 18k.
    systemPrompt: system,
    // A tool-using turn is several SDK turns: call, result, answer. Capping at 1 is only correct
    // when nothing is bridged - with the belt attached it fails every turn that uses a tool.
    maxTurns: bridge ? MAX_TOOL_TURNS : 1,
    // Do not inherit the user's settings, CLAUDE.md, project config or MCP servers. A Kit turn
    // carries what Kit sent, not whatever is configured for their coding work.
    settingSources: [],
    // An ALLOWLIST, not a denylist. bypassPermissions turns the CLI's own prompting off because Kit
    // owns the gate, so whatever stays reachable runs unasked; naming only Kit's own server means
    // the reachable set cannot grow underneath us when the CLI adds built-ins.
    ...(bridge
      ? { mcpServers: bridge, allowedTools: [`${MCP_TOOL_PREFIX}*`], permissionMode: "bypassPermissions" }
      : { tools: [], skills: [] }),
    disallowedTools: REFUSED_TOOLS.split(","),
    // Opt out of the signed-in account's claude.ai connectors (Notion/Gmail/Calendar). They ride the
    // `claudeai` MCP scope, which `settingSources: []` does not gate, and they would otherwise appear
    // inside a Kit turn as if Kit had offered them.
    env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "hoplight-kit", ENABLE_CLAUDEAI_MCP_SERVERS: "false" },
  };
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

/**
 * Turn an SDK failure into the sentence a reader can act on.
 *
 * "Not installed" is now claimed ONLY when the SDK itself could not be loaded, because that is the
 * one case where something really is missing. The previous version inferred it from a spawn errno,
 * which meant a PATH that merely did not carry the shim was reported as absent software - advice to
 * install what was already there. A wrong diagnosis is worse than a vague one, so anything the SDK
 * does not clearly identify is reported as what it is, with its own words kept.
 */
export function explainSdkFailure(detail: string): CliRefusal {
  if (/Failed to load @anthropic-ai\/claude-agent-sdk|Cannot find module/i.test(detail)) {
    return refuse(
      "not-installed",
      "Claude Code is not on this machine. Install it (npm i -g @anthropic-ai/claude-code) and run `claude login`.",
    );
  }
  if (/not logged in|authentication|unauthor|invalid api key|credential/i.test(detail)) {
    return refuse("not-logged-in", "Claude Code is installed but not signed in. Run `claude login`.");
  }
  return refuse("engine-error", detail.trim().slice(0, 300) || "Claude Code failed without saying why");
}

export interface CliOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** The tool bridge, passed to the SDK directly. Absent means a text-only turn. */
  readonly mcpServers?: Record<string, { command: string; args: string[] }> | null;
}

/**
 * One turn, through the Agent SDK rather than a bare `claude` spawn.
 *
 * WHY THE SDK AND NOT THE BINARY. Spawning `claude` by name means trusting PATH, and PATH is not a
 * property of the machine - it is a property of whichever shell or launcher started Kit. On Windows
 * the CLI exists only as `%APPDATA%\npm\claude.cmd`, so a session started before that shim was
 * written, or from a shortcut, cannot see it. Kit could not tell that apart from "not installed" and
 * told people to install software they already had. The SDK resolves its own CLI, so the failure
 * mode disappears rather than being papered over. Marinara's provider does the same, for the same
 * reason (`claude-subscription.provider.ts`).
 *
 * Every failure is a value; nothing here throws.
 */
export async function runClaudeCli(
  model: string,
  system: string,
  messages: readonly ModelMessage[],
  options: CliOptions = {},
): Promise<CliReply | CliRefusal> {
  const timeoutMs = options.timeoutMs ?? TURN_TIMEOUT_MS;
  const abort = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; abort.abort(); }, timeoutMs);
  const onAbort = (): void => abort.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const q = query({
      prompt: foldHistory(messages),
      options: { abortController: abort, ...sdkOptions(model, system, options.mcpServers ?? null) },
    });

    let text = "";
    let usage: TokenUsage | null = null;
    let costUsd: number | undefined;
    let failure: string | null = null;

    for await (const message of q) {
      if (message.type === "assistant") {
        for (const part of message.message.content) {
          if (part.type === "text") text += part.text;
        }
        if (text.length > MAX_OUTPUT_BYTES) {
          return refuse("bad-output", "the CLI produced more output than Kit will read");
        }
      } else if (message.type === "result") {
        const record = message as unknown as Record<string, unknown>;
        const u = (record["usage"] ?? {}) as Record<string, unknown>;
        const num = (value: unknown): number | undefined =>
          typeof value === "number" && Number.isFinite(value) ? value : undefined;
        usage = readUsage({
          input: num(u["input_tokens"]),
          output: num(u["output_tokens"]),
          cacheRead: num(u["cache_read_input_tokens"]),
          cacheWrite: num(u["cache_creation_input_tokens"]),
        });
        costUsd = num(record["total_cost_usd"]);
        if (message.subtype !== "success") {
          const detail = typeof record["result"] === "string" ? record["result"] : message.subtype;
          failure = detail;
        }
      }
    }

    if (timedOut) return refuse("timeout", `Claude Code did not answer within ${Math.round(timeoutMs / 1000)}s`);
    if (options.signal?.aborted) return refuse("engine-error", "the turn was cancelled");
    if (failure !== null) return explainSdkFailure(failure);
    if (!usage) return refuse("bad-output", "the CLI ended without a result");
    return { ok: true, text, usage, ...(costUsd !== undefined ? { costUsd } : {}) };
  } catch (error) {
    if (timedOut) return refuse("timeout", `Claude Code did not answer within ${Math.round(timeoutMs / 1000)}s`);
    if (options.signal?.aborted) return refuse("engine-error", "the turn was cancelled");
    return explainSdkFailure((error as Error).message);
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
