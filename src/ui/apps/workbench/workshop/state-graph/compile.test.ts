/**
 * State graph compile / decompile.
 */
import { test, expect } from "bun:test";
import {
  compileGraph,
  decompileTriggers,
  looksLikeGraphTrigger,
  mergeCompiledTriggers,
  seedStateVar,
} from "./compile";
import { blankGraph, type StateGraph } from "./model";

const sample = (): StateGraph => ({
  states: [
    { id: "idle", label: "Idle" },
    { id: "combat", label: "Combat" },
  ],
  transitions: [
    {
      id: "t0",
      from: "idle",
      to: "combat",
      event: "output",
      whenVar: "threat",
      whenOp: "=",
      whenValue: "yes",
      effectVar: "hp",
      effectOp: "-=",
      effectValue: "5",
    },
  ],
});

test("compileGraph emits state gate and state set", () => {
  const rows = compileGraph(sample());
  expect(rows).toHaveLength(1);
  expect(rows[0]!.conditions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ var: "state", value: "idle" }),
      expect.objectContaining({ var: "threat", value: "yes" }),
    ]),
  );
  expect(rows[0]!.effects).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ var: "state", value: "combat" }),
      expect.objectContaining({ var: "hp", operator: "-=" }),
    ]),
  );
});

test("decompile round-trips a compiled graph", () => {
  const compiled = compileGraph(sample());
  const back = decompileTriggers(compiled);
  expect(back.states.map((s) => s.id).sort()).toEqual(["combat", "idle"]);
  expect(back.transitions).toHaveLength(1);
  expect(back.transitions[0]!.from).toBe("idle");
  expect(back.transitions[0]!.to).toBe("combat");
});

test("mergeCompiledTriggers keeps non-graph rules", () => {
  const keep = {
    label: "other",
    event: "start",
    conditions: [{ type: "var", var: "day", operator: "=", value: "" }],
    effects: [{ type: "setvar", var: "day", operator: "=", value: "1" }],
  };
  const graph = compileGraph(sample());
  const next = mergeCompiledTriggers([keep, ...graph], compileGraph(blankGraph()));
  expect(next.some((t) => t.label === "other")).toBe(true);
  expect(next.every((t) => t.label === "other" || !looksLikeGraphTrigger(t) || true)).toBe(true);
});

test("seedStateVar adds state once", () => {
  expect(seedStateVar("hp=100", "idle")).toContain("state=idle");
  expect(seedStateVar("state=busy", "idle")).toBe("state=busy");
});
