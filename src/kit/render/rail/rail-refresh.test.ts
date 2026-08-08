/**
 * The rail re-reads a preset the model just wrote.
 *
 * IT DID NOT, AND THE FIRST FIX DID NOT EITHER. The obvious wiring was the studio watcher, which
 * diffs entity SUMMARIES - a name, an accent, a source format, nothing about the body. Adding,
 * moving or rewriting blocks changes no field it looks at, so a preset edit is invisible to it and
 * the reload could never fire. The apply path is the signal: it knows what it touched.
 */
import { describe, expect, test } from "bun:test";

/** What the rail does with one turn event, lifted so it can be pressed without a terminal. */
function shouldReread(
  event: { type: string; kind?: string; id?: string },
  rail: { open: boolean; presetId: string | null; pending: number },
): boolean {
  if (event.type !== "wrote" || event.kind !== "preset" || !event.id) return false;
  return rail.open && rail.presetId === event.id && rail.pending === 0;
}

const rail = (over: Partial<Parameters<typeof shouldReread>[1]> = {}) =>
  ({ open: true, presetId: "astrolabe", pending: 0, ...over });

const wrote = (id: string, kind = "preset") => ({ type: "wrote", kind, id });

describe("what makes the rail re-read", () => {
  test("a write to the preset on screen", () => {
    // The reported bug: applied, said so, and the rail kept showing the old order.
    expect(shouldReread(wrote("astrolabe"), rail())).toBe(true);
  });

  test("a write to some other preset does not disturb it", () => {
    expect(shouldReread(wrote("paramnesia"), rail())).toBe(false);
  });

  test("a write to another KIND does not disturb it", () => {
    // Saving a character while a preset is on the rail must not reload the rail.
    expect(shouldReread(wrote("astrolabe", "character"), rail())).toBe(false);
  });

  test("NEVER over unapplied work", () => {
    /**
     * The half that matters more. A stale view is an annoyance; reloading over a session of
     * rearranging to show somebody a change they already knew about is lost work.
     */
    expect(shouldReread(wrote("astrolabe"), rail({ pending: 1 }))).toBe(false);
  });

  test("a closed rail has nothing to re-read", () => {
    expect(shouldReread(wrote("astrolabe"), rail({ open: false }))).toBe(false);
  });

  test("ordinary turn events are ignored", () => {
    // The handler sees every event in the turn; only one of them means the file moved.
    for (const type of ["say", "tool", "state", "usage", "stopped"]) {
      expect(shouldReread({ type, kind: "preset", id: "astrolabe" }, rail())).toBe(false);
    }
  });

  test("a wrote event with no id is ignored rather than guessed at", () => {
    expect(shouldReread({ type: "wrote", kind: "preset" }, rail())).toBe(false);
  });
});
