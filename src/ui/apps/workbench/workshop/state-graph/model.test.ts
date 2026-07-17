/**
 * State-graph identity helpers: transition ids are collision-resistant; normalize does not rewrite.
 */
import { describe, expect, test } from "bun:test";
import { blankGraph, newStateId, newTransitionId } from "./model";

describe("newTransitionId", () => {
  test("rapid generation yields unique ids with stable prefix", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newTransitionId()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id.startsWith("t")).toBe(true);
  });
});

describe("newStateId", () => {
  test("slugifies and disambiguates against used set", () => {
    const used = new Set(["idle", "idle_2"]);
    expect(newStateId("Idle", used)).toBe("idle_3");
    expect(newStateId("Combat!", new Set())).toBe("combat");
  });
});

describe("blankGraph", () => {
  test("seeds idle/busy without transitions", () => {
    const g = blankGraph();
    expect(g.states.map((s) => s.id)).toEqual(["idle", "busy"]);
    expect(g.transitions).toEqual([]);
  });
});
