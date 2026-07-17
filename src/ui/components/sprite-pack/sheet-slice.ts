/**
 * Canvas-slice a sprite sheet into pack items (UI edge; geometry is pure sheetCells).
 * Extracted from sprite-pack/dialog.tsx.
 */
import {
  newPackItemId,
  sheetCells,
  SHEET_MAX_CELLS,
  type SpritePackItem,
} from "../../../core/media";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("sprite-pack: sheet image load failed"));
    img.src = src;
  });

export const readFileAsDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("sprite-pack: expected data URL"));
    };
    reader.onerror = () => reject(new Error("sprite-pack: read failed"));
    reader.readAsDataURL(file);
  });

/** Canvas-slice a sheet into pack items (UI edge; geometry is pure sheetCells). */
export async function sliceSheetToItems(
  dataUri: string,
  cols: number,
  rows: number,
  labels?: readonly string[],
): Promise<SpritePackItem[]> {
  const img = await loadImage(dataUri);
  const cells = sheetCells({
    cols,
    rows,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    labels,
  }).slice(0, SHEET_MAX_CELLS);
  if (cells.length === 0) return [];

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const items: SpritePackItem[] = [];
  for (const cell of cells) {
    canvas.width = cell.w;
    canvas.height = cell.h;
    ctx.clearRect(0, 0, cell.w, cell.h);
    ctx.drawImage(img, cell.x, cell.y, cell.w, cell.h, 0, 0, cell.w, cell.h);
    const ref = canvas.toDataURL("image/png");
    items.push({
      id: newPackItemId(),
      label: cell.label,
      ref,
      mime: "image/png",
    });
  }
  return items;
}
