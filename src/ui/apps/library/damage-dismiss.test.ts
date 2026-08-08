/**
 * Putting the unreadable-files notice away.
 *
 * Every test here is about what a dismissal must NOT hide. This banner is the only place Hoplight
 * says a file in somebody's studio did not load, so an off switch that outlives its files means the
 * next broken preset arrives in silence and the deck is quietly short by one.
 */
import { describe, expect, test } from "bun:test";
import { damageHidden, damageSeenList } from "./damage-dismiss";
import type { StudioDamagedEntry } from "../../app-contract";

const bad = (id: string, reason: StudioDamagedEntry["reason"] = "schema-mismatch"): StudioDamagedEntry =>
  ({ kind: "preset", id, reason });

describe("damageHidden", () => {
  test("nothing dismissed yet shows the notice", () => {
    expect(damageHidden([bad("a")], undefined)).toBe(false);
  });

  test("dismissing these files puts it away", () => {
    const entries = [bad("a"), bad("b")];
    expect(damageHidden(entries, damageSeenList(entries))).toBe(true);
  });

  test("A NEW BROKEN FILE BRINGS IT BACK", () => {
    /**
     * The whole point. Remembering "this notice was dismissed" instead of "these files were" would
     * mean the next unreadable preset never gets mentioned at all.
     */
    const seen = damageSeenList([bad("a")]);
    expect(damageHidden([bad("a"), bad("b")], seen)).toBe(false);
  });

  test("THE SAME FILE FAILING A NEW WAY BRINGS IT BACK", () => {
    // Different reason, different advice. Hiding it under the old dismissal buries the new problem.
    const seen = damageSeenList([bad("a", "schema-mismatch")]);
    expect(damageHidden([bad("a", "unusable-filename")], seen)).toBe(false);
  });

  test("FEWER PROBLEMS NEVER RE-NAGS", () => {
    // Dismiss two, fix one: the one left is a file they already said they knew about.
    const seen = damageSeenList([bad("a"), bad("b")]);
    expect(damageHidden([bad("a")], seen)).toBe(true);
  });

  test("a studio with nothing broken has nothing to show", () => {
    expect(damageHidden([], undefined)).toBe(true);
  });

  test("a junk preference reads as nothing dismissed, never as everything", () => {
    // Fail open, because failing closed here hides a real problem behind a corrupt setting.
    for (const junk of ["all", 7, null, {}, [1, 2]]) {
      expect(damageHidden([bad("a")], junk)).toBe(false);
    }
  });
});

describe("damageSeenList", () => {
  test("stable and deduplicated, so re-reads do not churn the settings file", () => {
    expect(damageSeenList([bad("b"), bad("a"), bad("b")]))
      .toEqual(["preset/a:schema-mismatch", "preset/b:schema-mismatch"]);
  });
});
