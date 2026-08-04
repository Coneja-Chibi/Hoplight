/**
 * The outline and its diff.
 *
 * The test that matters most is the one about a shift not being a move. Inserting a block at the top
 * changes every index below it, and a differ that calls that 150 moves is technically right and
 * useless: the rail would light up entirely and the one thing that actually went somewhere would be
 * invisible inside it.
 */
import { describe, expect, test } from "bun:test";
import { diffOutline, enabledCount, outlineOf, outlineSummary } from "./outline";
import type { PresetBody, PresetPrompt } from "../../entities/preset";

const prompt = (over: Partial<PresetPrompt>): PresetPrompt => ({
  id: "b", name: "Block", content: "x", role: "system", enabled: true, systemPrompt: false,
  marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100,
  forbidOverrides: false, ...over,
} as PresetPrompt);

const body = (...prompts: PresetPrompt[]): PresetBody =>
  ({ name: "P", prompts }) as PresetBody;

const ids = (...list: string[]): PresetBody => body(...list.map((id) => prompt({ id, name: id })));

describe("outlineOf", () => {
  test("reads blocks in evaluation order, with the facts a rail shows", () => {
    const rows = outlineOf(body(
      prompt({ id: "init", name: "Init", content: "abc" }),
      prompt({ id: "hist", name: "Chat History", content: "", marker: true }),
      prompt({ id: "off", name: "Off one", enabled: false, content: "12345" }),
    ));
    expect(rows.map((r) => [r.index, r.id, r.size, r.marker, r.enabled])).toEqual([
      [0, "init", 3, false, true],
      [1, "hist", 0, true, true],
      [2, "off", 5, false, false],
    ]);
  });

  test("a nameless block falls back to its id, so no row is blank", () => {
    expect(outlineOf(body(prompt({ id: "hp_init", name: "   " })))[0]!.name).toBe("hp_init");
  });

  test("an absent body is an empty outline, not a throw", () => {
    expect(outlineOf(undefined)).toEqual([]);
    expect(enabledCount([])).toBe(0);
  });
});

describe("diffOutline", () => {
  test("no change at all reports null, so a poll that found nothing says nothing", () => {
    expect(diffOutline(outlineOf(ids("a", "b")), outlineOf(ids("a", "b")))).toBeNull();
  });

  test("a real move names where it came from and where it went", () => {
    const before = outlineOf(ids("a", "b", "c", "d"));
    const after = outlineOf(ids("a", "d", "b", "c"));
    const diff = diffOutline(before, after)!;
    const moved = diff.changes.filter((c) => c.kind === "moved");
    expect(moved).toHaveLength(1);
    expect(moved[0]!.id).toBe("d");
    expect(moved[0]!.from).toBe(3);
    expect(moved[0]!.index).toBe(1);
  });

  test("inserting at the top is ONE addition, not a move of everything below it", () => {
    // The whole reason the diff ranks survivors separately. A rail that lights up 150 rows because
    // one block was added at the top has hidden the change inside the noise it made.
    const before = outlineOf(ids("a", "b", "c", "d", "e"));
    const after = outlineOf(ids("new", "a", "b", "c", "d", "e"));
    const diff = diffOutline(before, after)!;
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0]).toMatchObject({ kind: "added", id: "new", index: 0 });
  });

  test("removing from the top is ONE removal, for the same reason", () => {
    const diff = diffOutline(outlineOf(ids("a", "b", "c")), outlineOf(ids("b", "c")))!;
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0]).toMatchObject({ kind: "removed", id: "a", index: null });
  });

  test("toggling reports which way it went", () => {
    const before = outlineOf(body(prompt({ id: "x", enabled: true })));
    const after = outlineOf(body(prompt({ id: "x", enabled: false })));
    expect(diffOutline(before, after)!.changes[0]).toMatchObject({ kind: "disabled", id: "x" });
    expect(diffOutline(after, before)!.changes[0]).toMatchObject({ kind: "enabled", id: "x" });
  });

  test("an edit is noticed by size or by name", () => {
    const before = outlineOf(body(prompt({ id: "x", content: "aa", name: "One" })));
    expect(diffOutline(before, outlineOf(body(prompt({ id: "x", content: "aaaa", name: "One" }))))!
      .changes[0]).toMatchObject({ kind: "edited" });
    expect(diffOutline(before, outlineOf(body(prompt({ id: "x", content: "aa", name: "Two" }))))!
      .changes[0]).toMatchObject({ kind: "edited" });
  });

  test("a block that moved AND was edited reports the move, because that is the headline", () => {
    // Both are true; only one can lead. Position is the thing that silently changes behaviour.
    const before = outlineOf(body(prompt({ id: "a" }), prompt({ id: "b", content: "aa" })));
    const after = outlineOf(body(prompt({ id: "b", content: "aaaaaa" }), prompt({ id: "a" })));
    const forB = diffOutline(before, after)!.changes.filter((c) => c.id === "b");
    expect(forB).toHaveLength(1);
    expect(forB[0]!.kind).toBe("moved");
  });

  test("a swap is ONE move, because one block went past another", () => {
    // Written expecting both, which was wrong: describing a swap as two moves is the same
    // over-reporting as calling an insert 150 moves, just smaller. One of them stayed and one
    // travelled; which one is arbitrary, so the test does not pin it.
    const diff = diffOutline(outlineOf(ids("a", "b")), outlineOf(ids("b", "a")))!;
    const moved = diff.changes.filter((c) => c.kind === "moved");
    expect(moved).toHaveLength(1);
    expect(["a", "b"]).toContain(moved[0]!.id);
  });

  test("dragging one block past two others is one move, not three", () => {
    // The case that broke the first two attempts. Comparing indexes says three blocks changed
    // position, and all three really did - but only one was dragged, and a rail lighting up three
    // rows has hidden the change inside the noise it made.
    const diff = diffOutline(outlineOf(ids("a", "b", "c", "d")), outlineOf(ids("a", "d", "b", "c")))!;
    const moved = diff.changes.filter((c) => c.kind === "moved");
    expect(moved).toHaveLength(1);
    expect(moved[0]!.id).toBe("d");
  });

  test("a wholesale reversal reports nearly everything, because nearly everything did move", () => {
    // The guard against a differ so eager to minimise that it explains away a real upheaval.
    const diff = diffOutline(outlineOf(ids("a", "b", "c", "d", "e")), outlineOf(ids("e", "d", "c", "b", "a")))!;
    expect(diff.changes.filter((c) => c.kind === "moved").length).toBeGreaterThanOrEqual(4);
  });
});

describe("outlineSummary", () => {
  test("one move reads as a sentence with both positions", () => {
    const diff = diffOutline(outlineOf(ids("a", "b", "c")), outlineOf(ids("c", "a", "b")))!;
    expect(outlineSummary(diff)).toBe("moved c · 2 to 0");
  });

  test("a batch is counted by kind rather than listed", () => {
    const diff = diffOutline(outlineOf(ids("a", "b", "c")), outlineOf(ids("d", "e")))!;
    // The counts ARE the point of the name. Checking only the words let a summary that always
    // reported 1 of each pass.
    expect(outlineSummary(diff)).toBe("2 added · 3 removed");
  });
});

describe("blocks that share an id", () => {
  // Not hypothetical: the SillyTavern reader dedupes on import, the Marinara one does not, so a
  // preset really can reach here with two blocks named the same thing.
  const collide = body(
    prompt({ id: "x", name: "First", content: "aa" }),
    prompt({ id: "y", name: "Y" }),
    prompt({ id: "x", name: "Second", content: "bbbb" }),
  );

  test("each row gets its own identity, so nothing downstream can conflate them", () => {
    const rows = outlineOf(collide);
    expect(rows.map((r) => r.id)).toEqual(["x", "y", "x#1"]);
    // The names still describe the real blocks; only the row key was disambiguated.
    expect(rows.map((r) => r.name)).toEqual(["First", "Y", "Second"]);
  });

  test("removing the second reports a removal, not a phantom move of the first", () => {
    // Measured before the fix: the id-keyed Map kept only the last `x`, so the surviving first block
    // was reported as having moved from index 2 to 0, and the real removal appeared nowhere.
    const after = body(prompt({ id: "x", name: "First", content: "aa" }), prompt({ id: "y", name: "Y" }));
    const diff = diffOutline(outlineOf(collide), outlineOf(after))!;
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0]).toMatchObject({ kind: "removed", id: "x#1" });
  });

  test("an unchanged read of a colliding preset is still silent", () => {
    expect(diffOutline(outlineOf(collide), outlineOf(collide))).toBeNull();
  });
});
