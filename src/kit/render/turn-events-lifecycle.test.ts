/**
 * Scheduler lifecycle projection coverage for live and sealed Backstage traces.
 */
import { expect, test } from "bun:test";
import { applyTurnEvent, type TurnView } from "./turn-events";

const view = (): TurnView => ({
  lines: [],
  live: { phase: "waiting" },
  label: "",
  tools: null,
  toolsSeen: false,
});

test("scheduler lifecycle updates the open cluster and its sealed receipt", () => {
  let current = applyTurnEvent(view(), { type: "tool-start", name: "change_apply" }, 1000);
  current = applyTurnEvent(current, { type: "state", phase: "applying" }, 1100);
  expect(current.tools?.phase).toBe("applying");
  current = applyTurnEvent(current, {
    type: "tool",
    name: "change_apply",
    summary: "apply draft-1: applied",
  }, 1300);
  current = applyTurnEvent(current, { type: "state", phase: "verifying" }, 1400);
  current = applyTurnEvent(current, { type: "state", phase: "completed" }, 1500);
  current = applyTurnEvent(current, { type: "say", text: "Saved." }, 2000);
  expect(current.lines[0]).toMatchObject({
    role: "backstage",
    phase: "completed",
    moves: ["apply draft-1: applied"],
  });
});

test("tool-loop reasoning lands as one accumulated rehearsal receipt", () => {
  let current = applyTurnEvent(view(), {
    type: "delta",
    kind: "reasoning",
    text: "Find the character. ",
  }, 1000);
  current = applyTurnEvent(current, { type: "tool-start", name: "studio_search" }, 2000);
  current = applyTurnEvent(current, {
    type: "delta",
    kind: "reasoning",
    text: "Inspect its identity. ",
  }, 3000);
  current = applyTurnEvent(current, { type: "tool-start", name: "studio_read" }, 4000);

  expect(current.lines).toEqual([{
    role: "thought",
    text: "Find the character. Inspect its identity. ",
    seconds: 2,
    open: false,
  }]);
});
