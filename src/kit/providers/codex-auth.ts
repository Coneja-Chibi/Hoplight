/**
 * The ChatGPT login Codex already created on this machine, read so Kit can send on a subscription
 * instead of an API key.
 *
 * WHAT THIS IS AND IS NOT. It reads `~/.codex/auth.json`, the file `codex login` writes. Kit does not
 * run a login flow, does not open a browser, and never sees a password: it uses a credential that is
 * already on the machine because the person put it there. If the file is absent the answer is a
 * refusal naming the command to run, not a prompt.
 *
 * TWO HOSTS, WHICH IS ONE MORE THAN A NORMAL PROVIDER. Chat goes to `chatgpt.com`; refreshing an
 * expired token goes to `auth.openai.com`. Both are reached through the same guarded fetch the rest
 * of the provider layer uses, each locked to its own single host, so neither becomes a hole in the
 * egress gate. That second destination is stated here because a reader auditing where Kit talks
 * should not have to infer it from a function name.
 *
 * The decisions are pure and the I/O is a thin edge, so the parsing, the staleness rule and the
 * refusal wording can be tested without a network or a home directory.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_VERSION } from "../../version";
import { EgressBlocked, guardedFetch } from "./egress";

export const CODEX_CHAT_HOST = "chatgpt.com";
export const CODEX_CHAT_BASE = "https://chatgpt.com/backend-api/codex";
const REFRESH_HOST = "auth.openai.com";
const REFRESH_URL = "https://auth.openai.com/oauth/token";

/**
 * The Codex client version presented to the endpoint, which is NOT a claim about who is calling.
 *
 * The service gates on it: an unrecognised value is refused with "requires a newer version of Codex",
 * verified against the live endpoint. So it is read from the Codex install on this machine, which
 * makes it true rather than invented. `originator` and the user agent are where Hoplight identifies
 * itself, and those say Hoplight.
 *
 * The fallback only applies when Codex is installed but has not cached a version yet. It will go
 * stale eventually, and the failure is loud and self-describing when it does.
 */
const FALLBACK_CLIENT_VERSION = "0.146.0";

/**
 * The public client id Codex itself uses for this OAuth app. Not a secret: it identifies the
 * application to the token endpoint and is the same value in every Codex install. A refresh presented
 * under a different id is simply rejected.
 */
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

/** Refresh once a token is within this of its expiry, so a long turn does not die halfway. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface CodexAuth {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly accountId?: string;
  /** Epoch ms from the token's own `exp` claim, when it carries a readable one. */
  readonly expiresAt?: number;
}

/** Codex's own home; CODEX_HOME matches the override Codex itself honours, so a portable install works. */
export const codexHome = (): string => process.env.CODEX_HOME ?? join(homedir(), ".codex");

/** Where Codex keeps its login. */
export const codexAuthPath = (): string => join(codexHome(), "auth.json");

/**
 * Pick the client version out of what Codex has written locally.
 *
 * `models_cache.json` records the version the installed CLI actually sent, which is the value the
 * endpoint already accepted; `version.json` records the newest release Codex knows about, which is
 * only a good guess. Preferring the first means Kit presents a version that has demonstrably worked
 * on this machine.
 */
export function pickClientVersion(cache: unknown, version: unknown): string {
  const fromCache = str((cache as Record<string, unknown> | null)?.["client_version"]);
  if (fromCache) return fromCache;
  const fromVersion = str((version as Record<string, unknown> | null)?.["latest_version"]);
  return fromVersion ?? FALLBACK_CLIENT_VERSION;
}

const readJson = async (path: string): Promise<unknown> => {
  try {
    return await Bun.file(path).json();
  } catch {
    return null;
  }
};

/** The client version to present, read from the Codex install beside the login. */
export async function codexClientVersion(): Promise<string> {
  const home = codexHome();
  const [cache, version] = await Promise.all([
    readJson(join(home, "models_cache.json")),
    readJson(join(home, "version.json")),
  ]);
  return pickClientVersion(cache, version);
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/**
 * The `exp` claim out of a JWT, without verifying it.
 *
 * Deliberately unverified, and that is safe here because the claim is used for ONE thing: deciding
 * whether to refresh early. A forged expiry can only make Kit refresh sooner or later than ideal; the
 * token's actual authority is decided by the server that receives it. Treating an unreadable token as
 * having no expiry is the safe direction, since the request then simply proceeds and a genuinely dead
 * token comes back as a 401 the caller can explain.
 */
function expiryOf(token: string): number | undefined {
  const parts = token.split(".");
  if (parts.length < 2) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as unknown;
    if (payload === null || typeof payload !== "object") return undefined;
    const exp = (payload as Record<string, unknown>)["exp"];
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse the file into an auth, or refuse with the sentence a reader can act on.
 *
 * `auth.json` also holds an API-key mode. That mode is REFUSED rather than quietly used: someone
 * choosing this provider asked to spend a subscription, and silently billing an API key instead is
 * the kind of substitution that shows up on an invoice rather than on screen.
 */
export function parseCodexAuth(raw: unknown, path: string): CodexAuth {
  if (raw === null || typeof raw !== "object") {
    throw new EgressBlocked(`${path} is not a Codex login file. Run \`codex login\` on this machine.`);
  }
  const record = raw as Record<string, unknown>;
  const tokens = record["tokens"];
  if (tokens === null || typeof tokens !== "object") {
    throw new EgressBlocked(
      `${path} holds no ChatGPT login. Run \`codex login\` on this machine, then set this provider up again.`,
    );
  }
  const t = tokens as Record<string, unknown>;
  const accessToken = str(t["access_token"]);
  if (!accessToken) {
    throw new EgressBlocked(
      `${path} carries no ChatGPT access token. Run \`codex login\` on this machine.`,
    );
  }
  const auth: CodexAuth = {
    accessToken,
    refreshToken: str(t["refresh_token"]),
    accountId: str(t["account_id"]),
    expiresAt: expiryOf(accessToken),
  };
  return auth;
}

/** True when the token is expired or close enough that a long turn could outlive it. */
export const needsRefresh = (auth: CodexAuth, now: number): boolean =>
  auth.expiresAt !== undefined && auth.expiresAt - REFRESH_MARGIN_MS <= now;

/**
 * The headers ChatGPT's Codex endpoint expects alongside the bearer token.
 *
 * `originator` and the user agent name HOPLIGHT. They identify the client to the service, so
 * borrowing another application's name would file this traffic under software that did not send it.
 */
export function codexHeaders(auth: CodexAuth, clientVersion: string): Record<string, string> {
  const headers: Record<string, string> = {
    version: clientVersion,
    originator: "hoplight",
    "User-Agent": `Hoplight/${APP_VERSION}`,
  };
  if (auth.accountId) headers["ChatGPT-Account-ID"] = auth.accountId;
  return headers;
}

/** The refresh exchange, over a fetch locked to the auth host alone. */
export async function refreshCodexAuth(auth: CodexAuth): Promise<CodexAuth> {
  if (!auth.refreshToken) {
    throw new EgressBlocked(
      "the ChatGPT login has expired and carries no refresh token. Run `codex login` again.",
    );
  }
  const fetch = guardedFetch(REFRESH_HOST);
  const response = await fetch(REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CODEX_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: auth.refreshToken,
      scope: "openid profile email",
    }),
  });
  if (!response.ok) {
    throw new EgressBlocked(
      `refreshing the ChatGPT login failed (${response.status}). Run \`codex login\` again.`,
    );
  }
  const body = (await response.json()) as Record<string, unknown>;
  const accessToken = str(body["access_token"]) ?? auth.accessToken;
  return {
    accessToken,
    refreshToken: str(body["refresh_token"]) ?? auth.refreshToken,
    accountId: auth.accountId,
    expiresAt: expiryOf(accessToken),
  };
}

/**
 * The login as it stands right now: read from disk, refreshed if it is at or near expiry.
 *
 * The refreshed token is NOT written back to `auth.json`. That file belongs to Codex, and a second
 * writer racing its own refresh is how a working login gets corrupted. The cost is that Kit may
 * refresh again next run, which is a wasted round trip rather than a lost credential.
 */
export async function readCodexAuth(now: number = Date.now()): Promise<CodexAuth> {
  const path = codexAuthPath();
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new EgressBlocked(
      `no ChatGPT login found at ${path}. Run \`codex login\` on this machine, then try again.`,
    );
  }
  let raw: unknown;
  try {
    raw = await file.json();
  } catch {
    throw new EgressBlocked(`${path} is not readable JSON. Run \`codex login\` on this machine.`);
  }
  const auth = parseCodexAuth(raw, path);
  return needsRefresh(auth, now) ? refreshCodexAuth(auth) : auth;
}
