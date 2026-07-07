/**
 * Phase 1 backstop + card-runtime proof: a Risu card (Lua) runs in a Worker that can be KILLED, with its
 * host API (get/setChatVar) and json wired in across the boundary by state, not functions. The
 * load-bearing test is the infinite loop - the in-VM timeout can't stop `while true do end`, but the
 * worker deadline terminates it near time instead of hanging forever. The rest proves the card's runtime
 * actually works end to end: vars round-trip, json encodes, real 5.4 math runs, and the seal still holds.
 */
import { describe, expect, test } from "bun:test";
import { runLuaSandboxed } from "./run-in-worker";

describe("worker card runner: the real kill switch", () => {
  test("a normal script returns its value through the worker", async () => {
    const res = await runLuaSandboxed("return 2 + 40");
    expect(res.result).toEqual({ ok: true, value: 42 });
  });

  test("a pure infinite loop is KILLED by the worker deadline, not hung", async () => {
    const start = Date.now();
    const res = await runLuaSandboxed("while true do end", { timeoutMs: 400 });
    const elapsed = Date.now() - start;
    expect(res.result.ok).toBe(false);
    if (!res.result.ok) expect(res.result.reason).toBe("timeout");
    expect(elapsed).toBeLessThan(2500); // terminated near the 400ms deadline, not run forever
  }, 6000);
});

describe("worker card runner: the host API works end to end", () => {
  test("a card reads and writes chat vars, and the mutation comes back", async () => {
    const res = await runLuaSandboxed('setChatVar("mood", "calm") return getChatVar("mood")', {
      chatVars: { mood: "grumpy" },
    });
    expect(res.result).toEqual({ ok: true, value: "calm" });
    expect(res.chatVars.mood).toBe("calm");
  });

  test("a card uses json + real 5.4 integer math, stored through the API", async () => {
    const res = await runLuaSandboxed('local j = require("json") setChatVar("bits", j.encode({6 & 3, 1 << 4}))');
    expect(res.result.ok).toBe(true);
    expect(res.chatVars.bits).toBe("[2,16]");
  });

  test("the seal still holds through the worker (os unreachable)", async () => {
    const res = await runLuaSandboxed("return os == nil");
    expect(res.result).toEqual({ ok: true, value: true });
  });
});
