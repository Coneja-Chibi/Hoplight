/**
 * Direct manipulation of the block list.
 *
 * These are the cases that are easy to get wrong and impossible to check by eye in a terminal:
 * dragging a selection downward, dropping onto a row inside the selection, shift-clicking backwards.
 * Each one has a specific wrong answer that looks almost right, which is why they are pinned.
 */
import { describe, expect, test } from "bun:test";
import {
  clickRow, insertRow, moveSelection, nudgeSelection, railIsDirty, railState,
  removeSelection, selectAll, selectNone, setEnabled,
} from "./rail-edit";
import type { OutlineRow } from "./outline";

const rows = (...ids: string[]): OutlineRow[] =>
  ids.map((id, index) => ({
    index, id, name: id.toUpperCase(), enabled: true, marker: false, size: 10, role: "system",
  }));

const order = (state: { rows: readonly OutlineRow[] }): string[] => state.rows.map((r) => r.id);
const indexes = (state: { rows: readonly OutlineRow[] }): number[] => state.rows.map((r) => r.index);
const chosen = (state: { selected: ReadonlySet<string> }): string[] => [...state.selected].sort();

describe("selecting", () => {
  const base = railState(rows("a", "b", "c", "d", "e"));

  test("a plain click replaces the selection", () => {
    const one = clickRow(base, "b");
    expect(chosen(one)).toEqual(["b"]);
    expect(chosen(clickRow(one, "d"))).toEqual(["d"]);
  });

  test("shift extends from the anchor, downward", () => {
    const state = clickRow(clickRow(base, "b"), "d", { shift: true });
    expect(chosen(state)).toEqual(["b", "c", "d"]);
  });

  test("shift extends from the anchor UPWARD, meaning the same thing", () => {
    // A person shift-clicking up wants the range between the two rows, same as clicking down.
    const state = clickRow(clickRow(base, "d"), "b", { shift: true });
    expect(chosen(state)).toEqual(["b", "c", "d"]);
  });

  test("the anchor stays put, so a range can be widened and narrowed", () => {
    const wide = clickRow(clickRow(base, "b"), "e", { shift: true });
    expect(chosen(wide)).toEqual(["b", "c", "d", "e"]);
    const narrow = clickRow(wide, "c", { shift: true });
    // Moving the anchor to `e` on the first shift would make this select c..e instead of b..c.
    expect(chosen(narrow)).toEqual(["b", "c"]);
  });

  test("ctrl adds and removes one row without disturbing the rest", () => {
    const two = clickRow(clickRow(base, "a"), "c", { ctrl: true });
    expect(chosen(two)).toEqual(["a", "c"]);
    expect(chosen(clickRow(two, "a", { ctrl: true }))).toEqual(["c"]);
  });

  test("shift with no anchor selects the one row rather than nothing", () => {
    expect(chosen(clickRow(base, "c", { shift: true }))).toEqual(["c"]);
  });

  test("clicking a row that is not there changes nothing", () => {
    expect(clickRow(base, "ghost")).toBe(base);
  });

  test("select all and none", () => {
    expect(chosen(selectAll(base))).toEqual(["a", "b", "c", "d", "e"]);
    expect(chosen(selectNone(selectAll(base)))).toEqual([]);
  });
});

describe("moving", () => {
  const base = railState(rows("a", "b", "c", "d", "e"));

  test("one row lands before the row it was dropped on", () => {
    const state = moveSelection(clickRow(base, "e"), "b");
    expect(order(state)).toEqual(["a", "e", "b", "c", "d"]);
  });

  test("a contiguous range moves together and keeps its internal order", () => {
    const picked = clickRow(clickRow(base, "b"), "c", { shift: true });
    expect(order(moveSelection(picked, "e"))).toEqual(["a", "d", "b", "c", "e"]);
  });

  test("a non-contiguous selection collapses to the drop point, in list order", () => {
    const picked = clickRow(clickRow(base, "a"), "d", { ctrl: true });
    expect(order(moveSelection(picked, "c"))).toEqual(["b", "a", "d", "c", "e"]);
  });

  test("dragging DOWNWARD lands where it was dropped, not one short", () => {
    // The bug this exists for: pulling the selection out first shifts every index below it, so an
    // index captured before the removal points somewhere else after. Naming the target ROW survives.
    const picked = clickRow(clickRow(base, "a"), "b", { shift: true });
    expect(order(moveSelection(picked, "e"))).toEqual(["c", "d", "a", "b", "e"]);
  });

  test("dropping at the end is expressible", () => {
    expect(order(moveSelection(clickRow(base, "a"), null))).toEqual(["b", "c", "d", "e", "a"]);
  });

  test("dropping a range onto itself costs nothing", () => {
    // What happens when somebody picks a range up and puts it back down.
    const picked = clickRow(clickRow(base, "b"), "d", { shift: true });
    expect(order(moveSelection(picked, "c"))).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("moving with nothing selected changes nothing", () => {
    expect(moveSelection(base, "c")).toBe(base);
  });

  test("indexes are renumbered, so order never lies", () => {
    const state = moveSelection(clickRow(base, "e"), "a");
    expect(indexes(state)).toEqual([0, 1, 2, 3, 4]);
    expect(state.rows[0]!.id).toBe("e");
  });
});

describe("nudging, for anyone without a mouse", () => {
  const base = railState(rows("a", "b", "c", "d"));

  test("up moves one place up", () => {
    expect(order(nudgeSelection(clickRow(base, "c"), -1))).toEqual(["a", "c", "b", "d"]);
  });

  test("down moves one place down", () => {
    expect(order(nudgeSelection(clickRow(base, "b"), 1))).toEqual(["a", "c", "b", "d"]);
  });

  test("down from the last row does nothing, rather than wrapping", () => {
    const last = clickRow(base, "d");
    expect(order(nudgeSelection(last, 1))).toEqual(["a", "b", "c", "d"]);
  });

  test("up from the first row does nothing", () => {
    expect(order(nudgeSelection(clickRow(base, "a"), -1))).toEqual(["a", "b", "c", "d"]);
  });

  test("a range nudges as one", () => {
    const picked = clickRow(clickRow(base, "a"), "b", { shift: true });
    expect(order(nudgeSelection(picked, 1))).toEqual(["c", "a", "b", "d"]);
  });
});

describe("enabling and removing", () => {
  const base = railState(rows("a", "b", "c"));

  test("toggle flips each selected row on its own current state", () => {
    const mixed = { ...base, rows: base.rows.map((r, i) => (i === 1 ? { ...r, enabled: false } : r)) };
    const state = setEnabled(selectAll(mixed), "toggle");
    expect(state.rows.map((r) => r.enabled)).toEqual([false, true, false]);
  });

  test("explicit on and off set every selected row the same way", () => {
    expect(setEnabled(selectAll(base), false).rows.every((r) => !r.enabled)).toBe(true);
    expect(setEnabled(selectAll(base), true).rows.every((r) => r.enabled)).toBe(true);
  });

  test("unselected rows are untouched", () => {
    const state = setEnabled(clickRow(base, "b"), false);
    expect(state.rows.map((r) => r.enabled)).toEqual([true, false, true]);
  });

  test("removing drops the rows and clears the selection", () => {
    const state = removeSelection(clickRow(clickRow(base, "a"), "b", { shift: true }));
    expect(order(state)).toEqual(["c"]);
    expect(chosen(state)).toEqual([]);
    expect(indexes(state)).toEqual([0]);
  });
});

describe("inserting", () => {
  const base = railState(rows("a", "b", "c"));
  const fresh = { id: "new", name: "New", enabled: true, marker: false, size: 0, role: "system" };

  test("a new row lands before the named one and arrives selected", () => {
    const state = insertRow(base, fresh, "b");
    expect(order(state)).toEqual(["a", "new", "b", "c"]);
    // Selected, because the next thing anybody does after inserting is something to that block.
    expect(chosen(state)).toEqual(["new"]);
    expect(indexes(state)).toEqual([0, 1, 2, 3]);
  });

  test("a null target appends", () => {
    expect(order(insertRow(base, fresh, null))).toEqual(["a", "b", "c", "new"]);
  });

  test("a duplicate id is refused, because the id is the identity", () => {
    expect(insertRow(base, { ...fresh, id: "b" }, "a")).toBe(base);
  });
});

describe("dirty", () => {
  const before = rows("a", "b", "c");

  test("an equal-but-separate list is clean", () => {
    // railState does not copy, so passing its .rows compared the array with ITSELF - a railIsDirty
    // that ignored both arguments and returned false would have passed.
    expect(railIsDirty(before, rows("a", "b", "c"))).toBe(false);
  });

  test("a reorder is dirty even though every row still exists", () => {
    const moved = moveSelection(clickRow(railState(before), "c"), "a");
    expect(railIsDirty(before, moved.rows)).toBe(true);
  });

  test("a toggle is dirty", () => {
    expect(railIsDirty(before, setEnabled(clickRow(railState(before), "a"), false).rows)).toBe(true);
  });

  test("selecting alone is not a change", () => {
    const selected = selectAll(railState(rows("a", "b", "c")));
    expect(railIsDirty(before, selected.rows)).toBe(false);
  });
});
