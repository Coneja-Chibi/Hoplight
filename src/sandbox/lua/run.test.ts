/**
 * Phase 1 spike proof: the hardened wasmoon engine runs PUC-Lua 5.4 faithfully AND is sealed - no host
 * filesystem/shell, no bytecode loader, deny-by-absence capabilities, and a pure-Lua infinite loop is
 * killed by the timeout. The fidelity tests (integer subtype + native bitops) are the reason we chose
 * wasmoon over Luau: those silently differ on a 5.1-based dialect.
 */
import { describe, expect, test } from "bun:test";
import { runLua } from "./run";

describe("hardened Lua engine: fidelity to PUC-Lua 5.4", () => {
  test("runs and returns a value", async () => {
    expect(await runLua("return 40 + 2")).toEqual({ ok: true, value: 42 });
  });

  test("has the 5.4 integer subtype (Luau, all-doubles, would say 'number')", async () => {
    expect(await runLua('return math.type(3)')).toEqual({ ok: true, value: "integer" });
    expect(await runLua('return math.type(3.0)')).toEqual({ ok: true, value: "float" });
  });

  test("has native 5.4 bitwise ops and integer division (Luau lacks these)", async () => {
    expect(await runLua("return 6 & 3")).toEqual({ ok: true, value: 2 });
    expect(await runLua("return 1 << 4")).toEqual({ ok: true, value: 16 });
    expect(await runLua("return 17 // 5")).toEqual({ ok: true, value: 3 });
  });

  test("pure stdlib a card needs is present (string/table/math)", async () => {
    expect(await runLua('return string.upper("hi")')).toEqual({ ok: true, value: "HI" });
    expect(await runLua("return math.floor(3.7)")).toEqual({ ok: true, value: 3 });
  });
});

describe("hardened Lua engine: the seal holds", () => {
  test("os is not reachable (no host shell)", async () => {
    expect(await runLua("return os == nil")).toEqual({ ok: true, value: true });
    const shell = await runLua('return os.execute("echo hi")');
    expect(shell.ok).toBe(false);
  });

  test("io is not reachable (no host filesystem)", async () => {
    expect(await runLua("return io == nil")).toEqual({ ok: true, value: true });
    const read = await runLua('return io.open("/etc/passwd", "r")');
    expect(read.ok).toBe(false);
  });

  test("debug and package are not reachable", async () => {
    expect(await runLua("return debug == nil")).toEqual({ ok: true, value: true });
    expect(await runLua("return package == nil")).toEqual({ ok: true, value: true });
  });

  test("bytecode/file loaders are stripped (source strings only)", async () => {
    expect(await runLua("return load == nil")).toEqual({ ok: true, value: true });
    expect(await runLua("return loadfile == nil")).toEqual({ ok: true, value: true });
    expect(await runLua("return dofile == nil")).toEqual({ ok: true, value: true });
    expect(await runLua("return require == nil")).toEqual({ ok: true, value: true });
  });
});

describe("hardened Lua engine: capabilities are deny-by-absence", () => {
  test("an injected capability is callable; one not injected does not exist", async () => {
    const store: Record<string, string> = { mood: "grumpy" };
    const caps = { getvar: (...a: unknown[]) => store[String(a[0])] ?? "" };

    const got = await runLua('return getvar("mood")', { capabilities: caps });
    expect(got).toEqual({ ok: true, value: "grumpy" });

    // setvar was never injected -> it is nil in the card's world, calling it errors (not a silent host reach)
    const denied = await runLua('return setvar("mood", "calm")', { capabilities: caps });
    expect(denied.ok).toBe(false);
  });
});

describe("hardened Lua engine: card faults are returned, not thrown", () => {
  test("a card error is returned, never thrown", async () => {
    const res = await runLua('error("card blew up")');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("error");
  });

  // NOTE: a pure-Lua infinite loop (`while true do end`) is NOT stopped here. wasmoon's in-VM
  // functionTimeout relies on an instruction-count hook whose JS callback does not fire reliably under
  // Bun, so it hangs. This confirms the research: the in-VM timeout is not the kill switch - the Worker
  // backstop is. That loop-kill is proven in run-in-worker.test.ts, never in this in-process suite.
});
