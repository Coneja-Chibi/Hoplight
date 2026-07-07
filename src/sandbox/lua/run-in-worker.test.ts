/**
 * Phase 1 backstop proof: wasmoon runs in a Worker that can be KILLED. The load-bearing test is the
 * infinite loop - the in-VM timeout can't stop `while true do end`, but the worker deadline terminates
 * it near the deadline instead of hanging forever. A normal script still returns its value, and the seal
 * still holds across the boundary.
 */
import { describe, expect, test } from "bun:test";
import { runLuaSandboxed } from "./run-in-worker";

describe("worker backstop: the real kill switch", () => {
  test("a normal script returns its value through the worker", async () => {
    expect(await runLuaSandboxed("return 2 + 40")).toEqual({ ok: true, value: 42 });
  });

  test("a pure infinite loop is KILLED by the worker deadline, not hung", async () => {
    const start = Date.now();
    const res = await runLuaSandboxed("while true do end", { timeoutMs: 400 });
    const elapsed = Date.now() - start;
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("timeout");
    expect(elapsed).toBeLessThan(2500); // terminated near the 400ms deadline, not run forever
  }, 6000);

  test("the seal still holds through the worker (os unreachable)", async () => {
    expect(await runLuaSandboxed("return os == nil")).toEqual({ ok: true, value: true });
  });
});
