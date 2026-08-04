/**
 * Where plan usage actually comes from: one credential read and one request for Claude, and nothing
 * at all for Codex.
 *
 * The impure half of plan-usage.ts. Kept separate so the parsing can be tested exhaustively without
 * a home directory or a network, which is the same split contract.ts and runner.ts already use.
 *
 * HOPLIGHT IDENTIFIES ITSELF HONESTLY HERE, and that is a measured claim rather than a hope. Every
 * community write-up on Anthropic's usage endpoint says `User-Agent: claude-code/<version>` is
 * required or you are rate-limited into persistent 429s. Tested against the live endpoint from this
 * repo: `Hoplight/<version>` returns 200, no user agent at all returns 200, and `claude-code/...`
 * returns 200. The advice is about rate-limit bucketing under frequent polling, not about access. So
 * Kit asks under its own name, and polls politely instead.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_VERSION } from "../../version";
import { guardedFetch } from "./egress";
import {
  readClaudeUsage,
  readCodexUsage,
  refuseUsage,
  type PlanUsage,
  type UsageOutcome,
} from "./plan-usage";

const CLAUDE_HOST = "api.anthropic.com";
const CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

/** The politeness budget. Community guidance for this endpoint, and Kit has no reason to beat it. */
const CLAUDE_MIN_INTERVAL_MS = 180_000;

// ---- Claude -------------------------------------------------------------------------------------

/** Where Claude Code keeps its login on Linux and Windows. macOS puts it in the Keychain instead. */
export const claudeCredentialsPath = (): string =>
  join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), ".credentials.json");

interface ClaudeLogin {
  readonly accessToken: string;
  readonly plan?: string;
}

/**
 * The Claude Code login, if there is one.
 *
 * Returns null rather than throwing on every absence, because "no login" is the ordinary state on a
 * machine that has never run Claude Code and is not an error worth a stack trace. The token is never
 * logged, returned to a caller outside this module, or put anywhere a transcript could reach.
 */
export async function readClaudeLogin(): Promise<ClaudeLogin | null> {
  const file = Bun.file(claudeCredentialsPath());
  if (!(await file.exists())) return null;
  try {
    const raw = (await file.json()) as Record<string, unknown>;
    const oauth = raw["claudeAiOauth"];
    if (oauth === null || typeof oauth !== "object") return null;
    const o = oauth as Record<string, unknown>;
    const accessToken = typeof o["accessToken"] === "string" ? o["accessToken"] : "";
    if (!accessToken) return null;
    const plan = typeof o["subscriptionType"] === "string" ? o["subscriptionType"] : undefined;
    return { accessToken, plan };
  } catch {
    return null;
  }
}

let claudeCache: { usage: PlanUsage; at: number } | null = null;

/**
 * Claude's plan state.
 *
 * Cached to the politeness interval. A cached answer is returned WITH its original `observedAt`
 * rather than restamped, so a reader is never told a three-minute-old figure is current.
 */
export async function claudeUsage(now: number = Date.now()): Promise<UsageOutcome> {
  if (claudeCache && now - claudeCache.at < CLAUDE_MIN_INTERVAL_MS) {
    return { ok: true, ...claudeCache.usage };
  }
  const login = await readClaudeLogin();
  if (!login) {
    return refuseUsage(
      "claude",
      "no-credentials",
      "no Claude login on this machine. Run `claude login`, then ask again.",
    );
  }
  let response: Response;
  try {
    response = await guardedFetch(CLAUDE_HOST)(CLAUDE_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${login.accessToken}`,
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": `Hoplight/${APP_VERSION}`,
      },
    });
  } catch (error) {
    return refuseUsage("claude", "unreachable", `could not reach Anthropic: ${(error as Error).message}`);
  }
  if (response.status === 401 || response.status === 403) {
    return refuseUsage("claude", "no-credentials", "the Claude login has expired. Run `claude login` again.");
  }
  if (!response.ok) {
    return refuseUsage("claude", "unreachable", `Anthropic answered ${response.status}.`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return refuseUsage("claude", "unreadable", "Anthropic's reply was not readable JSON.");
  }
  const usage = readClaudeUsage(body, now, login.plan);
  if (!usage) {
    return refuseUsage("claude", "unreadable", "Anthropic reported no usage windows for this plan.");
  }
  claudeCache = { usage, at: now };
  return { ok: true, ...usage };
}

// ---- Codex --------------------------------------------------------------------------------------

let codexLatest: PlanUsage | null = null;

/**
 * Record the quota headers riding on a Codex response.
 *
 * Called from the Codex spoke's fetch on every turn, which is why this provider costs nothing to
 * report: the numbers arrive with work the user already asked for. A response carrying no quota
 * headers leaves the previous reading alone rather than erasing it, since a missing header set means
 * "this reply did not say", not "your plan is empty".
 */
export function noteCodexHeaders(headers: Headers, now: number = Date.now()): void {
  const usage = readCodexUsage(headers, now);
  if (usage) codexLatest = usage;
}

/** Codex's plan state, as of the last turn. Never fetches: this provider reports what it was told. */
export function codexUsage(): UsageOutcome {
  if (!codexLatest) {
    return refuseUsage(
      "codex",
      "not-supported",
      "nothing sent yet this session, and ChatGPT only reports your plan alongside a reply. Send a message, then ask again.",
    );
  }
  return { ok: true, ...codexLatest };
}

/** Test seam: drop both caches so a test cannot pass on a reading another test left behind. */
export function resetUsageCaches(): void {
  claudeCache = null;
  codexLatest = null;
}
