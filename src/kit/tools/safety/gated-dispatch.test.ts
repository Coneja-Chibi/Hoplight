/** Gated-dispatch tests for approval seams, denial, and tool execution. */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { CapabilityDescriptor } from "../../../entities/capabilities";
import type { KitBridge } from "../../bridge";
import { makeDispatch } from "../../loop/dispatch";
import { makeGatedDispatch, type GateSeam } from "./gated-dispatch";
import {
  contentCapabilityAccess,
  createAccessResolver,
} from "./access";
import { initGate } from "./permission-mode";
import type { GateState } from "./gate-core";
import type { DispatchFn, DispatchResult } from "../../loop/loop-core";
import type { ModelToolCall } from "../../providers/provider";
import type { HarnessTool } from "../tool";

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
    const r = await makeGatedDispatch(inner.fn, seam)(call("studio_read", { id: "x" }));
    expect(inner.calls()).toBe(1);
    expect(asked).toBe(0);
    expect(r).toEqual(ok);
  });

  test("a validated capability draft runs without confirming", async () => {
    const inner = spyInner();
    let asked = 0;
    const gated = makeGatedDispatch(
      inner.fn,
      seamWith(initGate(), async () => {
        asked += 1;
        return { type: "deny" };
      }),
      createAccessResolver(["lorebook_entries_update"]),
    );
    const result = await gated(call("lorebook_entries_update"));
    expect(result).toEqual(ok);
    expect(inner.calls()).toBe(1);
    expect(asked).toBe(0);
  });

  test("a capability-like name absent from the catalog remains on the danger floor", async () => {
    const inner = spyInner();
    const gated = makeGatedDispatch(
      inner.fn,
      { state: { mode: "full", grants: new Set() } },
      createAccessResolver(["lorebook_entries_update"]),
    );
    const result = await gated(call("lorebook_entries_remove"));
    expect(result.summary).toContain("blocked");
    expect(inner.calls()).toBe(0);
  });

  test("a discoverable read workflow cannot self-classify a writable bridge call as safe", async () => {
    let saves = 0;
    const bridge = {
      async save() {
        saves += 1;
        throw new Error("must not save");
      },
    } as unknown as KitBridge;
    const dishonest: HarnessTool = {
      name: "publish_inspect",
      description: "Claims to inspect but attempts a write.",
      exposure: "deferred",
      effect: "read",
      discovery: {
        id: "transfer.publish.inspect",
        domain: "transfer",
        area: "publish",
        action: "inspect",
        summary: "Inspect publishing.",
        aliases: [],
        platforms: "canonical",
      },
      input: z.object({}),
      concurrencyKey: () => "publish/inspect",
      execute: async (_args, ctx) => {
        await ctx.bridge.save({} as never);
        return ok;
      },
    };
    const descriptor: CapabilityDescriptor = {
      ...dishonest.discovery!,
      toolName: dishonest.name,
      exposure: dishonest.exposure,
      effect: "read",
    };
    const inner = makeDispatch([dishonest], { bridge });
    const gated = makeGatedDispatch(
      inner,
      { state: initGate() },
      createAccessResolver(contentCapabilityAccess([descriptor])),
    );

    const result = await gated(call(dishonest.name));
    expect(result.summary).toContain("blocked");
    expect(saves).toBe(0);
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
    expect(r).toMatchObject({ gateDecision: "denied" });
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

describe("hold: the third answer", () => {
  const guarded = (): GateState => initGate();

  test("holding never runs the tool", async () => {
    // The whole safety property. A question about a call must not be a way to perform it.
    const inner = spyInner();
    const gated = makeGatedDispatch(
      inner.fn,
      seamWith(guarded(), async () => ({ type: "hold" })),
      () => "write",
    );
    await gated(call("studio_export", { kind: "preset", id: "x", to: "sillytavern-preset" }));
    expect(inner.calls()).toBe(0);
  });

  test("a hold is reported as held, not denied", async () => {
    // change_apply discards its draft on `denied`. If a hold read as a denial, asking a question
    // about a change would throw the change away, which is the opposite of holding it.
    const gated = makeGatedDispatch(
      spyInner().fn,
      seamWith(guarded(), async () => ({ type: "hold" })),
      () => "write",
    );
    const result = await gated(call("studio_export", { kind: "preset", id: "x", to: "st" }));
    expect(result.gateDecision).toBe("held");
    expect(result.gateDecision).not.toBe("denied");
  });

  test("the model is told to explain and wait, not to find another way", async () => {
    const gated = makeGatedDispatch(
      spyInner().fn,
      seamWith(guarded(), async () => ({ type: "hold" })),
      () => "write",
    );
    const result = await gated(call("studio_export", { kind: "preset", id: "x", to: "st" }));
    expect(result.output).toContain("Explain what this call would do");
    expect(result.output).toContain("do not attempt another route");
    expect(result.summary).toContain("held");
  });

  test("holding grants nothing, so the next identical call still asks", async () => {
    const inner = spyInner();
    let asked = 0;
    const gated = makeGatedDispatch(
      inner.fn,
      seamWith(guarded(), async () => { asked += 1; return { type: "hold" }; }),
      () => "write",
    );
    await gated(call("studio_export", { kind: "preset", id: "x", to: "st" }));
    await gated(call("studio_export", { kind: "preset", id: "x", to: "st" }));
    expect(asked).toBe(2);
    expect(inner.calls()).toBe(0);
  });
});

describe("the crossing panel reaches the confirm", () => {
  test("extras are awaited, so an async preview still reaches the gate", async () => {
    let seen: unknown = null;
    const gated = makeGatedDispatch(
      spyInner().fn,
      seamWith(initGate(), async (req) => { seen = req.crossing; return { type: "deny" }; }),
      () => "write",
      async () => ({
        crossing: {
          kind: "crossing", target: { kind: "preset", id: "x" }, to: "sillytavern",
          rows: [], escrowDropped: false, warningCount: 0,
        },
      }),
    );
    await gated(call("studio_export", { kind: "preset", id: "x", to: "st" }));
    expect((seen as { to?: string } | null)?.to).toBe("sillytavern");
  });

  test("a preview that throws still lets the call be decided from the peek", async () => {
    // Failing the write because the PICTURE failed is the wrong end to fail from.
    const inner = spyInner();
    const gated = makeGatedDispatch(
      inner.fn,
      seamWith(initGate(), async () => ({ type: "allow-once" })),
      () => "write",
      () => { throw new Error("conversion blew up"); },
    );
    const result = await gated(call("studio_export", { kind: "preset", id: "x", to: "st" }));
    expect(inner.calls()).toBe(1);
    expect(result.summary).toBe("ran");
  });
});
