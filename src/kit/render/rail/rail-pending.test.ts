/**
 * What counts as unapplied, which three keys have to agree about.
 *
 * They disagreed once: a typed edit identical to what was stored counted as pending, so the rail
 * refused to step away from it, refused to close, and then reported nothing to apply when asked to
 * write it. The fix is in rail-typing; this pins the counting itself.
 */
import { describe, expect, test } from "bun:test";
import { railDirty, railPending } from "./rail-pending";
import type { OutlineRow } from "../../../core/preset/outline";

const rows: OutlineRow[] = [
  { index: 0, id: "a", name: "First", enabled: true, marker: false, size: 3, role: "system" },
  { index: 1, id: "b", name: "Second", enabled: true, marker: false, size: 3, role: "system" },
];
const clean = { name: null, note: null };

describe("railDirty", () => {
  test("an untouched rail is clean", () => {
    expect(railDirty(rows, rows, clean)).toBe(false);
  });

  test("a rename with no block touched is still a change", () => {
    // Dirtiness was once measured only by comparing rows, so the rail refused to apply a rename.
    expect(railDirty(rows, rows, { name: "New Title", note: null })).toBe(true);
  });

  test("a note on its own is a change", () => {
    expect(railDirty(rows, rows, { name: null, note: "why I moved this" })).toBe(true);
  });

  test("a typed block edit is a change", () => {
    const edited = [{ ...rows[0]!, editedName: "Opening" }, rows[1]!];
    expect(railDirty(rows, edited, clean)).toBe(true);
  });

  test("a toggled block is a change", () => {
    const toggled = [{ ...rows[0]!, enabled: false }, rows[1]!];
    expect(railDirty(rows, toggled, clean)).toBe(true);
  });
});

describe("railPending", () => {
  test("nothing staged counts zero", () => {
    expect(railPending(rows, rows, clean)).toBe(0);
  });

  test("a rename and a note count one each", () => {
    expect(railPending(rows, rows, { name: "New", note: "because" })).toBe(2);
  });

  test("each typed row counts once", () => {
    const edited = [
      { ...rows[0]!, editedName: "Opening" },
      { ...rows[1]!, editedContent: "rewritten" },
    ];
    expect(railPending(rows, edited, clean)).toBe(2);
  });

  test("a row that was both renamed and rewritten still counts once", () => {
    // It goes out as one row in one draft, so counting it twice would overstate the review.
    const edited = [{ ...rows[0]!, editedName: "Opening", editedContent: "text" }, rows[1]!];
    expect(railPending(rows, edited, clean)).toBe(1);
  });
});
