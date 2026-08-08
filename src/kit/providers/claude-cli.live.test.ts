/**
 * The Claude Code CLI provider against the real CLI.
 *
 * Opt-in only, via HOPLIGHT_LIVE_CLI=1: run `HOPLIGHT_LIVE_CLI=1 bun test src/kit/providers/claude-cli.live.test.ts`.
 * A live run spends somebody's subscription and writes a real, titled Claude Code session into this
 * project's own session history - it must never fire just because `bun test` found the binary on
 * PATH. The parsing is covered in claude-cli.test.ts; what only a live run establishes is that the
 * flags still mean what they meant and that the harness overhead has not silently grown.
 *
 * That last test is the important one. The per-turn framing cost is not something a reader can see,
 * it is charged against their plan on every message, and it can change under us with a CLI update.
 * A number that drifts should fail here rather than on a bill.
 */
import { describe, expect, test } from "bun:test";
import { explainSdkFailure, runClaudeCli } from "./claude-cli";

const HAVE = Bun.which("claude") !== null;
const RUN_LIVE = process.env.HOPLIGHT_LIVE_CLI === "1";

describe.skipIf(!HAVE || !RUN_LIVE)("Claude Code CLI provider, live", () => {
  test("a turn comes back with text, token counts and a reported cost", async () => {
    const out = await runClaudeCli("sonnet", "You are a terse assistant.", [
      { role: "user", content: "Reply with exactly: OK" },
    ]);
    if (!out.ok) throw new Error(`${out.reason}: ${out.detail}`);
    expect(out.text.trim()).toContain("OK");
    expect(out.usage.output).toBeGreaterThan(0);
    expect(out.costUsd).toBeGreaterThan(0);
    // NOT asserted here any more, and the reason is a real behaviour change rather than a flake:
    // under the Agent SDK a TEXT-ONLY turn can legitimately report zero cache, while a turn with the
    // tool belt bridged reports plenty (measured: 52,460 read / 3,528 write). The old spawn path
    // always had a large enough prefix to cache, so this assertion used to hold by accident. The
    // property it guards - that the ledger is not fed zeros - belongs on a bridged turn, which is
    // where cache actually applies.
  }, 300_000);

  test("CONTROL: folded history actually reaches the model", async () => {
    // Without this the suite would pass on a provider that silently dropped every prior turn, which
    // would look like a working chat right up until the model forgot everything.
    const out = await runClaudeCli("sonnet", "You are a terse assistant. Answer from the conversation.", [
      { role: "user", content: "My name is Chi." },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "What is my name? Reply with just the name." },
    ]);
    if (!out.ok) throw new Error(`${out.reason}: ${out.detail}`);
    expect(out.text).toMatch(/chi/i);
  }, 300_000);

  test("the per-turn framing overhead has not grown", async () => {
    // Measured at roughly 18k cache-creation tokens with the system prompt replaced and the CLI's own
    // tools disallowed. It is the cost of the harness, it cannot be switched off, and every Kit turn
    // on this provider pays it. The ceiling is generous; the point is to notice a step change.
    const out = await runClaudeCli("sonnet", "You are a terse assistant.", [
      { role: "user", content: "Reply with exactly: OK" },
    ]);
    if (!out.ok) throw new Error(`${out.reason}: ${out.detail}`);
    const framing = out.usage.cacheRead + out.usage.cacheWrite;
    expect(framing).toBeLessThan(60_000);
  }, 300_000);

  /**
   * There is no longer a command to point at a missing binary: the SDK resolves its own CLI, which
   * is the whole reason this provider stopped spawning `claude` by name. So the classification is
   * tested directly instead, including the case that used to be got WRONG - a PATH that simply does
   * not carry the shim must never be reported as absent software.
   */
  test("a failure is classified by what it says, and only a missing SDK reads as not-installed", () => {
    const missing = explainSdkFailure("Failed to load @anthropic-ai/claude-agent-sdk. Cannot find module");
    expect(missing.reason).toBe("not-installed");
    expect(missing.detail).toContain("claude login");

    expect(explainSdkFailure("Error: not logged in").reason).toBe("not-logged-in");

    // The old spawn path turned any ENOENT into "install Claude Code", which is how a PATH gap
    // became advice to install software that was already there.
    const enoent = explainSdkFailure("spawn ENOENT: claude not found in $PATH");
    expect(enoent.reason).toBe("engine-error");
    expect(enoent.detail).toContain("ENOENT");
  });
});
