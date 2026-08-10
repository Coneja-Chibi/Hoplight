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

/**
 * How long the model list may take before the picker gives up.
 *
 * Bounded because this spawns a subprocess on a settings screen somebody is looking at: a CLI that
 * hangs must cost a few seconds of no suggestions, not a stuck form.
 */
const LIST_MODELS_TIMEOUT_MS = 20_000;

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
   * ASKED, NOT ASSUMED. The CLI knows exactly which models this subscription may run, and the SDK
   * exposes it: `query(...).supportedModels()` answers over the control channel without starting a
   * turn, so this costs a subprocess and no tokens.
   *
   * THE HAND-WRITTEN LIST THAT WAS HERE WAS WRONG, which is the argument for asking. It offered
   * sonnet, opus and haiku. The real answer on a current plan is five rows including Fable, and the
   * opus row's value is `opus[1m]` rather than the bare `opus` this file invented - so the list was
   * simultaneously missing a model the person was paying for and naming one the CLI does not
   * advertise. A list maintained by hand is a list that is wrong between releases, silently, and the
   * only symptom is a model you cannot pick.
   *
   * EMPTY ON FAILURE, NEVER A FABRICATED FALLBACK. If the CLI is absent or nobody has logged in,
   * there is no honest answer to give, and inventing three aliases would put names in the picker
   * that may not run. The model field is free text with the list as suggestions - the form says so
   * in its own comment - so no suggestions degrades to typing, while wrong suggestions degrade to a
   * turn that fails later with a worse message.
   */
  async listModels() {
    try {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");
      const abort = new AbortController();
      const timer = setTimeout(() => { abort.abort(); }, LIST_MODELS_TIMEOUT_MS);
      try {
        const q = query({
          // Never yields: only the control channel is wanted, so no turn is ever started.
          prompt: (async function* () { /* no messages */ })(),
          // The same isolation the chat path takes: none of the person's own config comes with us.
          options: { abortController: abort, settingSources: [], tools: [], skills: [] },
        });
        const models = await q.supportedModels();
        return models.map((m) => ({ id: m.value, label: m.displayName }));
      } finally {
        clearTimeout(timer);
        abort.abort();
      }
    } catch {
      return [];
    }
  },
};

export default claudeSub;
