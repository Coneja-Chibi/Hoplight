/**
 * When a re-read is allowed into an open editor.
 *
 * The decision, lifted so it can be asserted without a DOM. The hook is a ref and an effect around
 * exactly this, and the two cases worth pinning are both about NOT firing.
 */
import { describe, expect, test } from "bun:test";

/** The rule inside useReseedOnReread. */
function decide(seen: string, incoming: string, dirty: boolean): "reseed" | "hold" | "ignore" {
  if (incoming === seen) return "ignore";
  if (dirty) return "hold";
  return "reseed";
}

describe("taking a fresh read into an open editor", () => {
  test("a new revision on a clean editor is taken", () => {
    expect(decide("r1", "r2", false)).toBe("reseed");
  });

  test("THE SAME REVISION IS NOT A CHANGE", () => {
    /**
     * The room rebuilds and re-renders constantly - a status message, a tab, a keystroke elsewhere.
     * Keyed on the entity object instead of the revision, this would re-seed continuously and wipe
     * the editor as fast as somebody typed into it.
     */
    expect(decide("r1", "r1", false)).toBe("ignore");
  });

  test("A DIRTY EDITOR IS NEVER OVERWRITTEN", () => {
    // Re-seeding here would throw away somebody's edits to show them a fresher copy.
    expect(decide("r1", "r2", true)).toBe("hold");
  });

  test("HOLDING IS NOT SWALLOWING: the change is taken once the edits are gone", () => {
    /**
     * The important half of "hold". If the revision were marked seen while dirty, the editor would
     * stay stale forever with nothing left to trigger it - a worse outcome than either taking or
     * refusing, because it looks like the feature simply stopped working.
     */
    expect(decide("r1", "r2", true)).toBe("hold");
    // Same incoming revision, edits now saved or discarded: it lands.
    expect(decide("r1", "r2", false)).toBe("reseed");
  });
});
