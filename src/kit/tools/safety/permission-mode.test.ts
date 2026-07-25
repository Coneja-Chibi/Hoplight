/** Permission-mode tests for guarded defaults and explicit user choices. */
import { describe, expect, test } from "bun:test";
import { applyGateChoice, initGate, type GateChoice } from "./permission-mode";

describe("initGate", () => {
  test("defaults to guarded with no grants (fail-closed)", () => {
    const g = initGate();
    expect(g.mode).toBe("guarded");
    expect(g.grants.size).toBe(0);
  });
});

describe("applyGateChoice", () => {
  test("allow-session adds a grant keyed by tool name", () => {
    const g = applyGateChoice(initGate(), { type: "allow-session" }, "write");
    expect(g.grants.has("write")).toBe(true);
  });

  test("allow-once and deny leave the standing policy unchanged", () => {
    const g = initGate();
    expect(applyGateChoice(g, { type: "allow-once" }, "x")).toEqual(g);
    expect(applyGateChoice(g, { type: "deny" }, "x")).toEqual(g);
  });

  test("abort drops the mode to locked (slam the brakes)", () => {
    expect(applyGateChoice(initGate(), { type: "abort" }, "x").mode).toBe("locked");
  });

  test("set-mode raises or lowers the mode; an invalid mode is a no-op", () => {
    expect(applyGateChoice(initGate(), { type: "set-mode", mode: "autopilot" }, "x").mode).toBe(
      "autopilot",
    );
    const bad = applyGateChoice(initGate(), { type: "set-mode", mode: "bogus" as never }, "x");
    expect(bad.mode).toBe("guarded");
  });

  test("an unknown choice is a tolerant no-op, never a throw", () => {
    const g = initGate();
    const call = () => applyGateChoice(g, { type: "nope" } as unknown as GateChoice, "x");
    expect(call).not.toThrow();
    expect(call()).toEqual(g);
  });

  test("grants are bounded: the newest are kept, the oldest evicted", () => {
    let g = initGate();
    for (let i = 0; i < 80; i += 1) g = applyGateChoice(g, { type: "allow-session" }, `tool-${i}`);
    expect(g.grants.size).toBeLessThanOrEqual(64);
    expect(g.grants.has("tool-79")).toBe(true);
    expect(g.grants.has("tool-0")).toBe(false);
  });
});
