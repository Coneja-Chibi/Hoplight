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
