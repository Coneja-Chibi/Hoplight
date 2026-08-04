/**
 * The Codex login reader.
 *
 * Every test here is about a way this can go wrong quietly. Reading a token is easy; the risks are
 * spending the wrong credential, sending a stale one, letting a refresh reach somewhere it should
 * not, and telling somebody "it failed" without telling them what to do. Those are what is pinned.
 */
import { describe, expect, test } from "bun:test";
import {
  codexHeaders,
  needsRefresh,
  parseCodexAuth,
  pickClientVersion,
  refreshCodexAuth,
  type CodexAuth,
} from "./codex-auth";
import { readCodexModels } from "./spokes/codex";
import { EgressBlocked, guardedFetch } from "./egress";
import { APP_VERSION } from "../../version";

/** A JWT with only the claim this code reads. Unsigned: nothing here verifies one, by design. */
const tokenExpiring = (atMs: number): string => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(atMs / 1000) })).toString("base64url");
  return `header.${payload}.signature`;
};

const NOW = 1_800_000_000_000;

describe("parseCodexAuth", () => {
  test("reads the token, refresh token and account id Codex wrote", () => {
    const auth = parseCodexAuth({
      tokens: { access_token: "at", refresh_token: "rt", account_id: "acc" },
    }, "auth.json");
    expect(auth.accessToken).toBe("at");
    expect(auth.refreshToken).toBe("rt");
    expect(auth.accountId).toBe("acc");
  });

  test("an API-key-only file is REFUSED rather than spent", () => {
    // The substitution this guards against costs money and is invisible: someone picking this
    // provider asked to spend a subscription, and quietly billing their API key instead would
    // surface on an invoice rather than on screen.
    const attempt = () => parseCodexAuth(
      { auth_mode: "apikey", OPENAI_API_KEY: "sk-ant-not-a-subscription" },
      "auth.json",
    );
    expect(attempt).toThrow(EgressBlocked);
    expect(attempt).toThrow(/codex login/);
  });

  test("an API key sitting beside a valid login is ignored, never substituted", () => {
    // The file holds both shapes. Reading the key when a subscription token is right there would
    // bill the wrong account while appearing to work, so only `tokens` is ever consulted.
    const auth = parseCodexAuth({
      auth_mode: "chatgpt",
      OPENAI_API_KEY: "sk-proj-should-never-be-spent",
      tokens: { access_token: "subscription-token", refresh_token: "rt" },
    }, "auth.json");
    expect(auth.accessToken).toBe("subscription-token");
    expect(JSON.stringify(auth)).not.toContain("sk-proj");
  });

  test("every refusal names the file and the command that fixes it", () => {
    for (const raw of [null, "nonsense", {}, { tokens: {} }, { tokens: { refresh_token: "rt" } }]) {
      let message = "";
      try {
        parseCodexAuth(raw, "C:/somewhere/auth.json");
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain("C:/somewhere/auth.json");
      expect(message).toContain("codex login");
    }
  });

  test("an unreadable token is treated as having no expiry, not as expired", () => {
    // The safe direction: the request proceeds and a genuinely dead token comes back as a 401 the
    // caller can explain. Guessing "expired" would force a refresh on every single call.
    const auth = parseCodexAuth({ tokens: { access_token: "not-a-jwt" } }, "auth.json");
    expect(auth.expiresAt).toBeUndefined();
    expect(needsRefresh(auth, NOW)).toBe(false);
  });

  test("a readable expiry is carried through", () => {
    const auth = parseCodexAuth(
      { tokens: { access_token: tokenExpiring(NOW + 3_600_000) } },
      "auth.json",
    );
    expect(auth.expiresAt).toBe(Math.floor((NOW + 3_600_000) / 1000) * 1000);
  });
});

describe("needsRefresh", () => {
  const at = (expiresAt: number): CodexAuth => ({ accessToken: "at", expiresAt });

  test("a token expiring inside the margin is refreshed before the turn starts", () => {
    // A token with two minutes left would die halfway through a long reply.
    expect(needsRefresh(at(NOW + 2 * 60_000), NOW)).toBe(true);
  });

  test("a token with an hour left is left alone", () => {
    expect(needsRefresh(at(NOW + 3_600_000), NOW)).toBe(false);
  });

  test("an already-expired token is refreshed", () => {
    expect(needsRefresh(at(NOW - 1), NOW)).toBe(true);
  });
});

describe("codexHeaders", () => {
  test("names Hoplight, not the application this was modelled on", () => {
    const headers = codexHeaders({ accessToken: "at" }, "0.146.0");
    expect(headers["originator"]).toBe("hoplight");
    expect(headers["User-Agent"]).toMatch(/^Hoplight\//);
    expect(JSON.stringify(headers)).not.toMatch(/marinara/i);
  });

  test("the version header is Codex's, not Hoplight's", () => {
    // The service gates on this field and refuses a value it does not recognise, so sending
    // Hoplight's own version here is a 400 on every call. Proven against the live endpoint.
    const headers = codexHeaders({ accessToken: "at" }, "0.146.0");
    expect(headers["version"]).toBe("0.146.0");
    expect(headers["version"]).not.toBe(APP_VERSION);
  });

  test("carries the account id only when there is one", () => {
    expect(codexHeaders({ accessToken: "at" }, "1.0.0")["ChatGPT-Account-ID"]).toBeUndefined();
    expect(codexHeaders({ accessToken: "at", accountId: "acc" }, "1.0.0")["ChatGPT-Account-ID"]).toBe("acc");
  });

  test("never carries the token itself", () => {
    // The bearer belongs on the Authorization header the SDK builds, and these headers are the ones
    // most likely to be logged or shown during setup.
    expect(JSON.stringify(codexHeaders({ accessToken: "secret-token", accountId: "acc" }, "1.0.0")))
      .not.toContain("secret-token");
  });
});

describe("pickClientVersion", () => {
  test("prefers the version the installed CLI actually sent", () => {
    // models_cache records a version the endpoint already accepted; version.json only records the
    // newest release Codex has heard about, which may not be the one installed.
    expect(pickClientVersion({ client_version: "0.146.0" }, { latest_version: "0.200.0" }))
      .toBe("0.146.0");
  });

  test("falls back to the known release, then to a constant", () => {
    expect(pickClientVersion(null, { latest_version: "0.150.0" })).toBe("0.150.0");
    expect(pickClientVersion(null, null)).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pickClientVersion({ client_version: "" }, {})).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("readCodexModels", () => {
  test("reads the endpoint's own slug-keyed shape, with context windows", () => {
    expect(readCodexModels({ models: [{ slug: "gpt-5.6-sol", context_window: 272000 }] }))
      .toEqual([{ id: "gpt-5.6-sol", context: 272000 }]);
  });

  test("an unrecognised payload is an empty list, never a throw", () => {
    // The setup form reads an empty list as "type the model id yourself", which is a working
    // fallback; a throw during setup is not.
    for (const body of [null, {}, { models: "no" }, { data: [{ id: "x" }] }, { models: [null, 3] }]) {
      expect(readCodexModels(body)).toEqual([]);
    }
  });
});

describe("refreshCodexAuth", () => {
  test("a login with no refresh token refuses instead of hanging on a dead credential", async () => {
    await expect(refreshCodexAuth({ accessToken: "at" })).rejects.toThrow(/codex login/);
  });

  test("the refresh host is gated exactly like every other destination", () => {
    // The refresh is the one call that does not go to the chat host, so it gets its own single-host
    // gate rather than a wider one. Proven here against the gate itself: chatgpt.com must be refused
    // by an auth-host fetch, which is what stops this second destination widening into a hole.
    const fetch = guardedFetch("auth.openai.com");
    expect(fetch("https://chatgpt.com/backend-api/codex/models")).rejects.toThrow(EgressBlocked);
    expect(fetch("https://evil.example/oauth/token")).rejects.toThrow(EgressBlocked);
  });
});
