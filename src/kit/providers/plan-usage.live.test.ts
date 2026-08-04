/**
 * Plan usage against the real services.
 *
 * Skipped without a login, since this reads somebody's own subscription state. The parsing is
 * covered exhaustively in plan-usage.test.ts; what only a live run can establish is that the shapes
 * this repo parses are still the shapes the services send, and that Hoplight is still allowed to ask
 * under its own name.
 *
 * That last one is the point. Every community write-up on Anthropic's usage endpoint insists on
 * `User-Agent: claude-code/<version>`. This suite asserts the opposite, because it was measured: an
 * honest agent is accepted. If Anthropic ever changes that, this fails and the choice becomes a real
 * decision again instead of a silent regression into impersonation.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { APP_VERSION } from "../../version";
import { guardedFetch } from "./egress";
import { claudeCredentialsPath, claudeUsage, readClaudeLogin, resetUsageCaches } from "./plan-usage-sources";

const HAVE_CLAUDE = existsSync(claudeCredentialsPath());

describe.skipIf(!HAVE_CLAUDE)("Claude plan usage, live", () => {
  test("reports real windows for the plan on this machine", async () => {
    resetUsageCaches();
    const outcome = await claudeUsage();
    if (!outcome.ok) throw new Error(`${outcome.reason}: ${outcome.detail}`);
    expect(outcome.windows.length).toBeGreaterThan(0);
    for (const w of outcome.windows) {
      expect(w.percentUsed).toBeGreaterThanOrEqual(0);
      expect(w.percentUsed).toBeLessThanOrEqual(100);
      // A window that resets in the past is a parsing error wearing a plausible number.
      if (w.resetsAt !== undefined) expect(w.resetsAt).toBeGreaterThan(Date.now());
    }
    expect(outcome.source).toBe("endpoint");
  }, 60_000);

  test("Hoplight may ask under its OWN name; impersonation is not required", async () => {
    const login = await readClaudeLogin();
    if (!login) return;
    const response = await guardedFetch("api.anthropic.com")(
      "https://api.anthropic.com/api/oauth/usage",
      {
        headers: {
          Authorization: `Bearer ${login.accessToken}`,
          "anthropic-beta": "oauth-2025-04-20",
          "User-Agent": `Hoplight/${APP_VERSION}`,
        },
      },
    );
    expect(response.status).toBe(200);
  }, 60_000);

  test("the cached answer keeps its original timestamp rather than being restamped", async () => {
    // A three-minute-old figure presented as current is exactly the dishonesty this record exists to
    // prevent, and a cache that restamps on read produces it silently.
    resetUsageCaches();
    const first = await claudeUsage();
    const second = await claudeUsage();
    if (!first.ok || !second.ok) throw new Error("expected both reads to succeed");
    expect(second.observedAt).toBe(first.observedAt);
  }, 90_000);
});
