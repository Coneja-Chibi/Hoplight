/**
 * Pure loop lifecycle coverage, including terminal states that cannot return to success.
 */
import { expect, test } from "bun:test";
import { initialLoopState, transitionLoop } from "./state";

test("a draft and apply journey follows observable work", () => {
  let state = initialLoopState();
  for (const event of [
    { type: "model-request" },
    { type: "tool-start", effect: "draft" },
    { type: "preview-ready" },
    { type: "tool-start", effect: "apply" },
    { type: "verifying" },
    { type: "completed" },
  ] as const) {
    state = transitionLoop(state, event);
  }
  expect(state.phase).toBe("completed");
});

test("failed and stale terminals cannot be overwritten by completed", () => {
  const failed = transitionLoop(
    transitionLoop(initialLoopState(), { type: "failed" }),
    { type: "completed" },
  );
  const stale = transitionLoop(
    transitionLoop(initialLoopState(), { type: "stale" }),
    { type: "completed" },
  );
  expect(failed.phase).toBe("failed");
  expect(stale.phase).toBe("stale");
});

test("discarded is an honest absorbing receipt, not a failed apply", () => {
  const discarded = transitionLoop(
    transitionLoop(initialLoopState(), { type: "tool-start", effect: "draft" }),
    { type: "discarded" },
  );
  expect(discarded.phase).toBe("discarded");
  expect(transitionLoop(discarded, { type: "completed" }).phase).toBe("discarded");
});

test("tool effects select their honest active phase", () => {
  expect(transitionLoop(initialLoopState(), { type: "tool-start", effect: "read" }).phase)
    .toBe("reading");
  expect(transitionLoop(initialLoopState(), { type: "tool-start", effect: "draft" }).phase)
    .toBe("drafting");
  expect(transitionLoop(initialLoopState(), { type: "tool-start", effect: "apply" }).phase)
    .toBe("applying");
});
