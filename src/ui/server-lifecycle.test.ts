/**
 * Lifecycle handlers: quit answers ok then stops+exits; restart frees the port BEFORE respawning
 * so the child's rebind never races the dying parent.
 */
import { describe, expect, test } from "bun:test";
import { handleRestart, handleShutdown } from "./server-lifecycle";

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("lifecycle", () => {
  test("shutdown: replies ok, then stop and exit(0)", async () => {
    const calls: string[] = [];
    const res = handleShutdown({
      stop: () => calls.push("stop"),
      exit: (c) => calls.push(`exit${c}`),
      spawnSelf: () => calls.push("spawn"),
    });
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(calls).toEqual([]); // nothing torn down before the reply is out
    await wait(140);
    expect(calls).toEqual(["stop", "exit0"]);
  });

  test("restart: stop comes before spawnSelf, then exit", async () => {
    const calls: string[] = [];
    const res = handleRestart({
      stop: () => calls.push("stop"),
      exit: (c) => calls.push(`exit${c}`),
      spawnSelf: () => calls.push("spawn"),
    });
    expect(((await res.json()) as { restarting?: boolean }).restarting).toBe(true);
    await wait(140);
    expect(calls).toEqual(["stop", "spawn", "exit0"]);
  });
});

describe("a teardown step that fails", () => {
  const wait140 = (): Promise<void> => wait(140);

  test("A FAILED CLEANUP STILL EXITS, AND STILL RESPAWNS", async () => {
    /**
     * The stray-process bug. `stop` tears down four things; when one threw, the exit never ran and
     * the old instance stayed alive holding the port. The replacement then could not bind and died,
     * so the old server kept answering and the app looked restarted while nothing had restarted.
     */
    const calls: string[] = [];
    handleRestart({
      stop: () => { throw new Error("sidecar refused to stop"); },
      exit: (c) => calls.push(`exit${c}`),
      spawnSelf: () => calls.push("spawn"),
    });
    await wait140();
    expect(calls).toEqual(["spawn", "exit0"]);
  });

  test("quit exits even when cleanup throws", async () => {
    const calls: string[] = [];
    handleShutdown({
      stop: () => { throw new Error("nope"); },
      exit: (c) => calls.push(`exit${c}`),
      spawnSelf: () => calls.push("spawn"),
    });
    await wait140();
    // No respawn on quit: the person asked for the app to be gone.
    expect(calls).toEqual(["exit0"]);
  });

  test("A PROCESS THAT CANNOT REPLACE ITSELF STILL LETS GO OF THE PORT", async () => {
    /**
     * Vanishing is the better failure. Lingering after `stop` means a process with no listener that
     * nothing can reach and nobody can see - which is the exact thing being fixed, wearing a
     * different hat. The person reopens the app; they do not hunt a PID.
     */
    const calls: string[] = [];
    handleRestart({
      stop: () => calls.push("stop"),
      exit: (c) => calls.push(`exit${c}`),
      spawnSelf: () => { throw new Error("binary moved"); },
    });
    await wait140();
    expect(calls).toEqual(["stop", "exit0"]);
  });
});
