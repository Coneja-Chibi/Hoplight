/**
 * The empty guard, which is the whole design.
 *
 * The arrows reach past the composer only when there is nothing in the buffer for them to mean. Get
 * that wrong in one direction and an arrow stops moving the cursor in somebody's sentence; get it
 * wrong in the other and the rail can only be driven by taking the keyboard away from typing, which
 * is what made Kit feel like it was refusing to accept input at all.
 *
 * The number keys used to be decided here too. They belong to the question panel now, which has a
 * cursor and fields of its own; see ask-core.ts.
 */
import { describe, expect, test } from "bun:test";
import { emptyDraftAction } from "./empty-draft-keys";

const context = (over: Partial<Parameters<typeof emptyDraftAction>[1]> = {}) => ({
  draft: "", menuOpen: false, railOpen: true, ...over,
});

describe("stepping the rail", () => {
  test("a bare arrow from an empty draft steps", () => {
    expect(emptyDraftAction({ name: "right" }, context())).toEqual({ kind: "step-rail", delta: 1 });
    expect(emptyDraftAction({ name: "left" }, context())).toEqual({ kind: "step-rail", delta: -1 });
  });

  test("an arrow in a half-written sentence stays a cursor move", () => {
    // The one rule that cannot bend: somebody editing text owns their arrows completely.
    expect(emptyDraftAction({ name: "right" }, context({ draft: "hello" }))).toBeNull();
    expect(emptyDraftAction({ name: "left" }, context({ draft: " " }))).toBeNull();
  });

  test("a modifier means the key was aimed somewhere else", () => {
    // Ctrl+shift+arrows resize the rail, and alt+arrows move blocks. Neither is a step.
    for (const mod of [{ ctrl: true }, { shift: true }, { meta: true }, { option: true }]) {
      expect(emptyDraftAction({ name: "right", ...mod }, context())).toBeNull();
    }
  });

  test("an open popup owns its own navigation", () => {
    expect(emptyDraftAction({ name: "right" }, context({ menuOpen: true }))).toBeNull();
  });

  test("no rail means nothing to step", () => {
    expect(emptyDraftAction({ name: "right" }, context({ railOpen: false }))).toBeNull();
  });

  test("up and down are left alone, because history recall owns them", () => {
    expect(emptyDraftAction({ name: "up" }, context())).toBeNull();
    expect(emptyDraftAction({ name: "down" }, context())).toBeNull();
  });
});
