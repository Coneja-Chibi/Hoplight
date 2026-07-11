import { describe, expect, test } from "bun:test";
import { componentLabels, seedLayout, stepLayout, WEB_NODE_CAP } from "./web-layout";

describe("web-layout", () => {
  test("componentLabels groups connected nodes", () => {
    const labels = componentLabels(
      ["a", "b", "c", "d"],
      [
        { from: "a", to: "b" },
        { from: "c", to: "d" },
      ],
    );
    expect(labels.get("a")).toBe(labels.get("b"));
    expect(labels.get("c")).toBe(labels.get("d"));
    expect(labels.get("a")).not.toBe(labels.get("c"));
  });

  test("stepLayout is deterministic", () => {
    const bounds = { width: 400, height: 300 };
    const edges = [{ from: "a", to: "b" }];
    const s0 = seedLayout(["a", "b", "c"], edges, bounds);
    const a1 = stepLayout(s0, edges, bounds);
    const a2 = stepLayout(s0, edges, bounds);
    expect(a1).toEqual(a2);
  });

  test("pinned nodes do not move", () => {
    const bounds = { width: 200, height: 200 };
    const nodes = seedLayout(["a", "b"], [{ from: "a", to: "b" }], bounds);
    nodes[0] = { ...nodes[0]!, pinned: true, x: 10, y: 10 };
    const next = stepLayout(nodes, [{ from: "a", to: "b" }], bounds);
    expect(next[0]?.x).toBe(10);
    expect(next[0]?.y).toBe(10);
  });

  test("node cap constant is 200", () => {
    expect(WEB_NODE_CAP).toBe(200);
  });
});
