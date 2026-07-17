/**
 * sheetCells geometry.
 */
import { describe, expect, test } from "bun:test";
import { sheetCellCount, sheetCells } from "./sheet-slice";

describe("sheetCells", () => {
  test("2x2 grid rects", () => {
    const cells = sheetCells({ cols: 2, rows: 2, width: 100, height: 80 });
    expect(cells).toHaveLength(4);
    expect(cells[0]).toMatchObject({ col: 0, row: 0, x: 0, y: 0, w: 50, h: 40, label: "face1" });
    expect(cells[1]).toMatchObject({ col: 1, row: 0, x: 50, y: 0 });
    expect(cells[2]).toMatchObject({ col: 0, row: 1, y: 40 });
    expect(cells[3]?.label).toBe("face4");
  });

  test("custom labels", () => {
    const cells = sheetCells({
      cols: 2,
      rows: 1,
      width: 20,
      height: 10,
      labels: ["happy", "sad"],
    });
    expect(cells.map((c) => c.label)).toEqual(["happy", "sad"]);
  });

  test("fail closed on bad size", () => {
    expect(sheetCells({ cols: 0, rows: 2, width: 10, height: 10 })).toEqual([]);
    expect(sheetCells({ cols: 2, rows: 2, width: 0, height: 10 })).toEqual([]);
  });

  test("sheetCellCount caps", () => {
    expect(sheetCellCount(3, 3)).toBe(9);
    expect(sheetCellCount(100, 100)).toBe(64);
  });
});
