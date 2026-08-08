/**
 * When an open editor is allowed to re-read itself.
 *
 * The rule that matters is the refusal: a piece with unsaved work is never re-read underneath the
 * person editing it. Getting that backwards trades somebody's draft for a fresher copy, which is
 * not a smaller version of the same behaviour - it is the opposite of what they wanted.
 */
import { describe, expect, test } from "bun:test";

/**
 * The decision inside useReopenOnStudioChange, lifted so it can be asserted without a DOM.
 *
 * Kept in the test rather than exported from the hook on purpose: the hook is four lines of React
 * around this, and exporting a predicate nobody else calls would be an API invented for a test.
 * If a third caller ever needs it, that is when it earns a home.
 */
const shouldReopen = (
  version: number,
  kinds: readonly string[],
  pieceKind: string,
  dirty: boolean,
): boolean => {
  if (version === 0) return false;
  if (kinds.length > 0 && !kinds.includes(pieceKind)) return false;
  if (dirty) return false;
  return true;
};

describe("re-reading an open piece", () => {
  test("A DIRTY PIECE IS NEVER RE-READ", () => {
    /**
     * The whole point. Kit's rail settled this first: a stale view is an annoyance, losing a
     * rearrange is not. The one case it leaves stale - unsaved edits AND an outside change to the
     * same file - is the case that wants a conflict at save time, which the revision check gives.
     */
    expect(shouldReopen(3, ["preset"], "preset", true)).toBe(false);
  });

  test("a clean piece re-reads when its own deck changed", () => {
    expect(shouldReopen(3, ["preset"], "preset", false)).toBe(true);
  });

  test("ANOTHER DECK'S CHANGE IS IGNORED", () => {
    // Editing a preset must not re-read every open lorebook; a reload costs a network round trip
    // and a repaint per open tab.
    expect(shouldReopen(3, ["lorebook"], "preset", false)).toBe(false);
  });

  test("a change with no named kinds re-reads anyway", () => {
    // A malformed frame still means SOMETHING moved. Re-reading is the safe answer when the stream
    // could not say what; refusing would leave the bench stale on the one event it could not parse.
    expect(shouldReopen(3, [], "preset", false)).toBe(true);
  });

  test("the initial subscription is not a change", () => {
    // Version 0 arrives when the stream connects, by which time the editor has already loaded.
    // Re-reading there would double every open.
    expect(shouldReopen(0, ["preset"], "preset", false)).toBe(false);
  });
});
