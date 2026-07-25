/** Gated-dispatch tests for approval seams, denial, and tool execution. */
import { describe, expect, test } from "bun:test";
import { makeGatedDispatch, type GateSeam } from "./gated-dispatch";
import { initGate } from "./permission-mode";
import type { GateState } from "./gate-core";
import type { DispatchFn, DispatchResult } from "../../loop/loop-core";
import type { ModelToolCall } from "../../providers/provider";

const ok: DispatchResult = { summary: "ran", output: "done" };
const call = (name: string, args: unknown = {}): ModelToolCall => ({ id: "1", name, args });

/** An inner dispatch that counts how many times it actually ran (must be 0 on every deny path). */
const spyInner = (): { fn: DispatchFn; calls: () => number } => {
  let calls = 0;
  return {
    fn: async () => {
      calls += 1;
      return ok;
    },
    calls: () => calls,
  };
};

const seamWith = (state: GateState, confirm?: GateSeam["requestConfirm"]): GateSeam => ({
  state,
  requestConfirm: confirm,
});

describe("makeGatedDispatch", () => {
  test("a safe read runs immediately, without a confirm", async () => {
    const inner = spyInner();
    let asked = 0;
    const seam = seamWith(initGate(), async () => {
      asked += 1;
      return { type: "deny" };
    });
    const r = await makeGatedDispatch(inner.fn, seam)(call("read", { id: "x" }));
    expect(inner.calls()).toBe(1);
    expect(asked).toBe(0);
    expect(r).toEqual(ok);
  });

  test("locked denies a risky call and never calls inner", async () => {
    const inner = spyInner();
    const gated = makeGatedDispatch(inner.fn, seamWith({ mode: "locked", grants: new Set() }));
    const r = await gated(call("delete", { id: "x" }));
    expect(inner.calls()).toBe(0);
    expect(r.summary).toContain("blocked");
  });

  test("a confirm resolved deny never calls inner", async () => {
    const inner = spyInner();
    const gated = makeGatedDispatch(inner.fn, seamWith(initGate(), async () => ({ type: "deny" })));
    const r = await gated(call("delete"));
    expect(inner.calls()).toBe(0);
    expect(r.summary).toContain("blocked");
  });

  test("a confirm resolved allow-once runs the tool exactly once", async () => {
    const inner = spyInner();
    const gated = makeGatedDispatch(inner.fn, seamWith(initGate(), async () => ({ type: "allow-once" })));
    await gated(call("delete"));
    expect(inner.calls()).toBe(1);
  });

  test("a missing confirm seam fails closed to deny", async () => {
    const inner = spyInner();
    const r = await makeGatedDispatch(inner.fn, { state: initGate() })(call("delete"));
    expect(inner.calls()).toBe(0);
    expect(r.summary).toContain("blocked");
  });

  test("a throwing confirm seam fails closed to deny", async () => {
    const inner = spyInner();
    const gated = makeGatedDispatch(
      inner.fn,
      seamWith(initGate(), async () => {
        throw new Error("boom");
      }),
    );
    const r = await gated(call("delete"));
    expect(inner.calls()).toBe(0);
    expect(r.summary).toContain("blocked");
  });

  test("abort denies and locks the rest of the turn without re-asking", async () => {
    const inner = spyInner();
    let asked = 0;
    const gated = makeGatedDispatch(
      inner.fn,
      seamWith(initGate(), async () => {
        asked += 1;
        return { type: "abort" };
      }),
    );
    expect((await gated(call("delete"))).summary).toContain("blocked");
    expect(asked).toBe(1);
    // A second risky call in the same turn must be denied without prompting again.
    expect((await gated(call("delete"))).summary).toContain("blocked");
    expect(asked).toBe(1);
    expect(inner.calls()).toBe(0);
  });

  test("allow-session cannot open a floor tool; the re-decision loop is bounded", async () => {
    const inner = spyInner();
    let asked = 0;
    const gated = makeGatedDispatch(
      inner.fn,
      seamWith(initGate(), async () => {
        asked += 1;
        return { type: "allow-session" };
      }),
    );
    const r = await gated(call("exec-something")); // unknown -> floor -> never grantable
    expect(inner.calls()).toBe(0);
    expect(r.summary).toContain("blocked");
    expect(asked).toBeGreaterThan(0);
    expect(asked).toBeLessThanOrEqual(3);
  });

  test("set-mode to autopilot still cannot auto-allow a floor tool", async () => {
    const inner = spyInner();
    const gated = makeGatedDispatch(
      inner.fn,
      seamWith(initGate(), async () => ({ type: "set-mode", mode: "autopilot" })),
    );
    const r = await gated(call("exec-x"));
    expect(inner.calls()).toBe(0);
    expect(r.summary).toContain("blocked");
  });

  test("onChoice bubbles the user's choice for app persistence", async () => {
    const inner = spyInner();
    const seen: string[] = [];
    const seam: GateSeam = {
      state: initGate(),
      requestConfirm: async () => ({ type: "allow-once" }),
      onChoice: (c, name) => seen.push(`${c.type}:${name}`),
    };
    await makeGatedDispatch(inner.fn, seam)(call("delete"));
    expect(seen).toEqual(["allow-once:delete"]);
  });
});
