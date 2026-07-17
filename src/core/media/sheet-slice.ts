/**
 * Sprite sheet grid geometry. Pure math; pixel crop lives in the UI (canvas).
 * Cells are row-major; labels default to face1, face2, ... or slot names if provided.
 */

export type SheetCell = {
  index: number;
  col: number;
  row: number;
  /** pixel rect in source image */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export type SheetGridSpec = {
  cols: number;
  rows: number;
  /** source image pixel size */
  width: number;
  height: number;
  /** optional labels in row-major order; missing slots get faceN */
  labels?: readonly string[];
};

const clampInt = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.floor(n)));

/** Fail closed: empty grid when cols/rows/size invalid. */
export function sheetCells(spec: SheetGridSpec): SheetCell[] {
  const cols = clampInt(spec.cols, 0, 32);
  const rows = clampInt(spec.rows, 0, 32);
  const width = Math.floor(spec.width);
  const height = Math.floor(spec.height);
  if (cols < 1 || rows < 1 || width < 1 || height < 1) return [];

  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);
  if (cellW < 1 || cellH < 1) return [];

  const out: SheetCell[] = [];
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const label =
        (spec.labels?.[i] && spec.labels[i]!.trim()) || `face${i + 1}`;
      out.push({
        index: i,
        col,
        row,
        x: col * cellW,
        y: row * cellH,
        w: cellW,
        h: cellH,
        label,
      });
      i++;
    }
  }
  return out;
}

/** Cap cells so a bad grid cannot explode memory (UI still respects this). */
export const SHEET_MAX_CELLS = 64;

export function sheetCellCount(cols: number, rows: number): number {
  const c = clampInt(cols, 0, 32);
  const r = clampInt(rows, 0, 32);
  return Math.min(c * r, SHEET_MAX_CELLS);
}
