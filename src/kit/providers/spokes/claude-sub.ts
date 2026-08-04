/**
 * Claude on the subscription already signed in on this machine.
 *
 * NOT AN HTTP PROVIDER, which is why this spoke supplies `chat` instead of `model`. It drives the
 * Claude Code CLI as a local subprocess, so there is no request for the egress gate to inspect and no
 * LanguageModel to build. Pretending otherwise would imply the gate is watching something it cannot.
 *
 * EGRESS, STATED PLAINLY because our usual proof does not apply. The CLI talks to Anthropic itself;
 * `guardedFetch` is not in that path and cannot vouch for it. What Kit can report honestly is what
 * the CLI tells it afterwards, which is a real per-turn token and cost accounting, so the ledger is
 * fed from the subprocess's own numbers rather than from a request we observed. `/usage` is unaffected
 * and still reads the plan directly.
 *
 * TOOLS WORK, through Kit serving them back. The CLI runs its own agent loop and cannot hand a call
 * back unrun, so Kit points it at Kit: an MCP server over stdio exposing Kit's tools, dispatched
 * through the same zod validation.
 *
 * READ-ONLY BY DEFAULT, AND THE REASON IS NOT CAUTION. Kit's permission gate is per-turn state in
 * Kit's process and the server is a separate one, so it cannot reach across. The CLI is also started
 * with bypassPermissions, because two gates asking about one call is worse than one, which turns off
 * the client prompt that would otherwise stand in. Nothing would ask, so by default nothing may write.
 *
 * GATE MODE 1 lifts that WITHOUT inventing a channel: the setup screen asks "let Kit make changes this
 * session", and the answer decides a flag on the server's spawn. Answering once, in advance, knowingly
 * is a real authorisation - it is simply given at connect rather than per call. Read-only remains what
 * happens if nobody answers, so the careless path is the careful one.
 *
 * Mode 2 - asked per call, mid-turn - still needs the gate's decision to cross a process boundary, and
 * the CLI's own MCP call timeout is the constraint to measure before designing it: if that timeout is
 * short, somebody reading a diff blows through it and the call fails rather than waits.
 *
 * The standalone server a person registers with their own client keeps the full belt regardless,
 * because there the client's own prompt is the gate.
 *
 * The other consequence worth knowing: the CLI drives the ReAct cycle here, not loop-core.
 */
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProviderSpoke } from "../spoke";
import { makeClaudeCliChat, writeMcpConfig } from "../claude-cli";

/** Kit's own guidance still leads; the CLI is told to be Kit rather than a coding agent. */
const SYSTEM = "You are Kit, the Hoplight Studio agent. Use the hoplight tools for Studio facts and"
  + " changes. Answer the user directly and never claim a write succeeded without a receipt.";

/**
 * How the tool server is started: `hoplight mcp`, this same program.
 *
 * A COMPILED BINARY HAS NO SOURCE FILES, which is what makes the subcommand necessary rather than
 * tidy. Pointing at src/mcp/main.ts worked from a checkout and would have failed silently for anyone
 * who installed Hoplight instead of cloning it: the server would not start, the bridge would be
 * absent, and the turn would quietly answer without tools. That failure looks like a model choosing
 * not to use them.
 *
 * Decided from the EXECUTABLE, not from whatever entry happened to start this process. A first
 * attempt keyed on `Bun.main` and broke the moment the process was started some other way, because
 * "the entry looks like source" is a guess and "the executable is the Hoplight binary" is a fact.
 * When it is not our binary we are running under a runtime from source, and cli.ts is resolved from
 * this module rather than assumed.
 */
export function serverCommand(writes = false): { command: string; args: string[] } {
  /**
   * GATE MODE 1: pre-authorised at connect, decided here on the spawn.
   *
   * The tool server is a GRANDCHILD - Kit spawns the CLI, the CLI spawns `hoplight mcp` - so Kit has
   * no channel to it and cannot answer a permission question mid-call. That is why this provider ran
   * read-only: not caution about writes, but the absence of anywhere to ask.
   *
   * A flag on the spawn needs no channel. Somebody who has said "let Kit make changes this session"
   * has answered the question once, in advance, for the whole session - which is a real answer, given
   * knowingly, rather than a silent widening. It is the mode this file could always have had.
   *
   * READ-ONLY STAYS THE DEFAULT, and `writes` defaults to false at the parameter, so a caller that
   * forgets to pass anything gets the safe posture rather than the convenient one.
   */
  const args = ["mcp", ...(writes ? [] : ["--read-only"])];
  const exe = basename(process.execPath).toLowerCase();
  if (exe.startsWith("hoplight")) return { command: process.execPath, args };
  const cli = fileURLToPath(new URL("../../../cli.ts", import.meta.url));
  return { command: process.execPath, args: [cli, ...args] };
}

const claudeSub: ProviderSpoke = {
  id: "claude-sub",
  label: "Claude (subscription)",
  brand: "#D97757",
  defaultModel: "sonnet",
  // There is no key to give: the credential is whatever `claude login` already left on the machine.
  keyless: true,
  /**
   * The one choice this provider offers, and it is the gate posture.
   *
   * Asked plainly at setup rather than buried, because it is the difference between Kit being able to
   * change a piece on this provider and not. Defaults to read-only: somebody who never reads this
   * screen gets the careful answer, and the careless direction is the one that requires a decision.
   */
  options: [{
    key: "writes",
    label: "Let Kit make changes this session",
    choices: [
      { value: "off", label: "Read only (default)" },
      { value: "on", label: "Allow changes" },
    ],
    defaultValue: "off",
  }],
  async chat(config, signal) {
    // The posture comes from the CONFIG, so it is whatever the person chose at setup - never a
    // default decided here, and never inferred from anything the model said.
    const server = serverCommand(config.options?.writes === "on");
    // Handed to the SDK directly. There is no longer a temp config file naming an executable, so the
    // whole class of "somebody replaces that file between our write and the CLI's read" is gone.
    const mcpServers = { hoplight: { command: server.command, args: server.args } };
    return makeClaudeCliChat(config.model || "sonnet", SYSTEM, { signal, mcpServers });
  },
  /**
   * The aliases the CLI resolves itself, rather than a live catalog.
   *
   * There is no models endpoint to ask: a subscription's available models are decided by the plan and
   * the CLI picks the current build behind each alias, which is what makes an alias the right thing
   * to store. A pinned id would rot on the next release.
   */
  async listModels() {
    return [
      { id: "sonnet", label: "Sonnet (latest)" },
      { id: "opus", label: "Opus (latest)" },
      { id: "haiku", label: "Haiku (latest)" },
    ];
  },
};

export default claudeSub;
