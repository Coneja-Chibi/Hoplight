/** Verifies terminal-height windows keep the selected row visible. */
import { describe, expect, test } from "bun:test";
import { visibleWindow } from "./visible-window";

describe("visibleWindow", () => {
  test("keeps the active row inside a bounded centered slice", () => {
    const rows = Array.from({ length: 20 }, (_, index) => index);
    expect(visibleWindow(rows, 15, 5)).toEqual({ items: [13, 14, 15, 16, 17], start: 13 });
  });

  test("clamps at both ends and tolerates an invalid limit", () => {
    const rows = [0, 1, 2, 3, 4];
    expect(visibleWindow(rows, 0, 3)).toEqual({ items: [0, 1, 2], start: 0 });
    expect(visibleWindow(rows, 99, 3)).toEqual({ items: [2, 3, 4], start: 2 });
    expect(visibleWindow(rows, 2, 0)).toEqual({ items: [2], start: 2 });
  });
});
