/** Tests for the switch manager: single-flight lock, the prepare -> marker -> relaunch -> exit order, and
 *  failure recovery (status + lock released for a retry). */
import { describe, expect, test } from "bun:test";
import { createSwitchManager } from "./manager";
import type { PendingSwitch } from "../_shared/pending-switch";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function harness(prepareImpl?: (tag: string) => Promise<import("./manager").SwitchAction>) {
  const calls: string[] = [];
  let marker: PendingSwitch | null = null;
  const mgr = createSwitchManager({
    installed: "0.1.8",
    prepare:
      prepareImpl ?? (async () => ({ kind: "restart", run: () => calls.push("relaunch") }) as const),
    writeMarker: async (m) => {
      marker = m;
      calls.push("marker");
    },
    exit: () => calls.push("exit"),
    now: () => 5000,
  });
  return { mgr, calls, getMarker: () => marker };
}

describe("createSwitchManager", () => {
  test("runs prepare -> writeMarker -> relaunch -> exit in order, marker stamped from installed", async () => {
    const h = harness();
    expect(h.mgr.start("v0.1.9")).toBe(true);
    await tick();
    await tick();
    expect(h.calls).toEqual(["marker", "relaunch", "exit"]);
    expect(h.getMarker()).toEqual({ from: "0.1.8", to: "v0.1.9", at: 5000 });
    expect(h.mgr.status().phase).toBe("restarting");
  });

  test("single-flight: a second start while running returns false", async () => {
    // prepare never resolves, so the first switch stays in-flight
    const h = harness(() => new Promise<import("./manager").SwitchAction>(() => {}));
    expect(h.mgr.start("v0.1.9")).toBe(true);
    expect(h.mgr.start("v0.1.10")).toBe(false);
    await tick();
    expect(h.mgr.status().phase).toBe("working");
  });

  test("a manual (packaged) action writes NO marker, does not exit, ends in a manual status", async () => {
    const h = harness(async () => ({ kind: "manual", message: "run the new build" }));
    expect(h.mgr.start("v0.1.9")).toBe(true);
    await tick();
    await tick();
    expect(h.mgr.status().phase).toBe("manual");
    expect(h.mgr.status().message).toBe("run the new build");
    expect(h.getMarker()).toBeNull();
    expect(h.calls).toEqual([]); // no marker write, no relaunch, no exit
  });

  test("a failed prepare sets failed status, writes no marker, and frees the lock for a retry", async () => {
    let attempt = 0;
    const h = harness(async () => {
      attempt++;
      if (attempt === 1) throw new Error("dirty tree");
      return { kind: "restart", run: () => {} };
    });
    expect(h.mgr.start("v0.1.9")).toBe(true);
    await tick();
    await tick();
    expect(h.mgr.status().phase).toBe("failed");
    expect(h.mgr.status().message).toBe("dirty tree");
    expect(h.getMarker()).toBeNull();
    // lock released: a retry is accepted
    expect(h.mgr.start("v0.1.9")).toBe(true);
  });
});
