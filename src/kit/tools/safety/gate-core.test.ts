/** Permission-gate decision tests across modes, risks, and temporary grants. */
import { describe, expect, test } from "bun:test";
import { decideGate, isFloor, type GateState } from "./gate-core";
import type { RiskLevel, RiskVerdict, ToolAccess } from "./risk";

const verdict = (level: RiskLevel, access: ToolAccess): RiskVerdict => ({ level, access, reason: "" });
const state = (mode: GateState["mode"], grants: string[] = []): GateState => ({
  mode,
  grants: new Set(grants),
});

describe("decideGate", () => {
  test("locked allows only safe and denies everything else", () => {
    expect(decideGate("read", verdict("safe", "read"), state("locked"))).toBe("allow");
    expect(decideGate("draft", verdict("safe", "draft"), state("locked"))).toBe("allow");
    expect(decideGate("write", verdict("caution", "write"), state("locked"))).toBe("deny");
    expect(decideGate("del", verdict("danger", "delete"), state("locked"))).toBe("deny");
  });

  test("guarded (the default) allows safe and confirms caution and danger", () => {
    expect(decideGate("read", verdict("safe", "read"), state("guarded"))).toBe("allow");
    expect(decideGate("write", verdict("caution", "write"), state("guarded"))).toBe("confirm");
    expect(decideGate("del", verdict("danger", "delete"), state("guarded"))).toBe("confirm");
  });

  test("guarded honors a session grant for a non-floor tool (caution and danger alike)", () => {
    expect(decideGate("write", verdict("caution", "write"), state("guarded", ["write"]))).toBe("allow");
    expect(decideGate("del", verdict("danger", "delete"), state("guarded", ["del"]))).toBe("allow");
  });

  test("autopilot auto-allows safe and caution but still confirms danger", () => {
    expect(decideGate("read", verdict("safe", "read"), state("autopilot"))).toBe("allow");
    expect(decideGate("write", verdict("caution", "write"), state("autopilot"))).toBe("allow");
    expect(decideGate("del", verdict("danger", "delete"), state("autopilot"))).toBe("confirm");
  });

  test("full control auto-allows everything but the danger floor", () => {
    expect(decideGate("write", verdict("caution", "write"), state("full"))).toBe("allow");
    expect(decideGate("del", verdict("danger", "delete"), state("full"))).toBe("allow");
    expect(decideGate("send", verdict("danger", "egress"), state("full"))).toBe("allow");
    expect(decideGate("x", verdict("danger", "exec"), state("full"))).toBe("confirm");
    expect(decideGate("x", verdict("danger", "unknown"), state("full"))).toBe("confirm");
  });

  test("the floor (unknown/exec) is never opened by a grant, in any mode", () => {
    expect(decideGate("x", verdict("danger", "unknown"), state("guarded", ["x"]))).toBe("confirm");
    expect(decideGate("x", verdict("danger", "exec"), state("autopilot", ["x"]))).toBe("confirm");
    expect(decideGate("x", verdict("danger", "exec"), state("locked", ["x"]))).toBe("deny");
  });

  test("isFloor marks only unknown and exec", () => {
    expect(isFloor("unknown")).toBe(true);
    expect(isFloor("exec")).toBe(true);
    expect(isFloor("delete")).toBe(false);
    expect(isFloor("egress")).toBe(false);
    expect(isFloor("read")).toBe(false);
    expect(isFloor("draft")).toBe(false);
  });
});
