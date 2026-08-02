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
 * back unrun, so Kit points it at Kit: an MCP server over stdio exposing the same tools, dispatched
 * through the same validator and gate. The consequence worth knowing is that the CLI drives the ReAct
 * cycle for this provider, not loop-core.
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
export function serverCommand(): { command: string; args: string[] } {
  const exe = basename(process.execPath).toLowerCase();
  if (exe.startsWith("hoplight")) return { command: process.execPath, args: ["mcp"] };
  const cli = fileURLToPath(new URL("../../../cli.ts", import.meta.url));
  return { command: process.execPath, args: [cli, "mcp"] };
}

const claudeSub: ProviderSpoke = {
  id: "claude-sub",
  label: "Claude (subscription)",
  brand: "#D97757",
  defaultModel: "sonnet",
  // There is no key to give: the credential is whatever `claude login` already left on the machine.
  keyless: true,
  async chat(config, signal) {
    const server = serverCommand();
    // A config that cannot be written costs the tools, not the turn: the provider still answers.
    const mcpConfig = await writeMcpConfig(server.command, server.args);
    return makeClaudeCliChat(config.model || "sonnet", SYSTEM, { signal, mcpConfig });
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
