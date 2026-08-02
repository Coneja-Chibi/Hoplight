/**
 * The Claude Code CLI provider against the real CLI.
 *
 * Skipped without an install, because this spends somebody's subscription and needs a program CI
 * cannot have. The parsing is covered in claude-cli.test.ts; what only a live run establishes is that
 * the flags still mean what they meant and that the harness overhead has not silently grown.
 *
 * That last test is the important one. The per-turn framing cost is not something a reader can see,
 * it is charged against their plan on every message, and it can change under us with a CLI update.
 * A number that drifts should fail here rather than on a bill.
 */
import { describe, expect, test } from "bun:test";
import { runClaudeCli } from "./claude-cli";

const HAVE = Bun.which("claude") !== null;

describe.skipIf(!HAVE)("Claude Code CLI provider, live", () => {
  test("a turn comes back with text, token counts and a reported cost", async () => {
    const out = await runClaudeCli("sonnet", "You are a terse assistant.", [
      { role: "user", content: "Reply with exactly: OK" },
    ]);
    if (!out.ok) throw new Error(`${out.reason}: ${out.detail}`);
    expect(out.text.trim()).toContain("OK");
    expect(out.usage.output).toBeGreaterThan(0);
    // The ledger reports these numbers, so zeros would make it claim nothing was spent.
    expect(out.usage.cacheRead + out.usage.cacheWrite).toBeGreaterThan(0);
    expect(out.costUsd).toBeGreaterThan(0);
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

  test("a missing CLI is a refusal naming the fix, not a throw", async () => {
    const out = await runClaudeCli("sonnet", "sys", [{ role: "user", content: "hi" }], {
      command: "claude-that-is-not-installed",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("not-installed");
    expect(out.detail).toContain("claude login");
  }, 60_000);
});
