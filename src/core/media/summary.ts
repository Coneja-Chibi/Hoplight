/**
 * Media export summary chips: count emotions / named / portrait for Press UI.
 * Pure; no React; no format bridges (avoids core <-> formats cycles).
 */
import type { Media } from "../../entities/character/schema";
import { packFromMedia } from "./pack";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export type MediaExportSummary = {
  emotions: number;
  named: number;
  hasPortrait: boolean;
  /** short chips for UI, e.g. "12 emotions", "3 named" */
  chips: readonly string[];
};

const countAssetRows = (rows: unknown): number => {
  if (!Array.isArray(rows)) return 0;
  return rows.filter(
    (row) => Array.isArray(row) && typeof row[0] === "string" && typeof row[1] === "string",
  ).length;
};

/** Count Risu additionalAssets rows without importing the named bridge. */
function countNamedFromOriginal(original: unknown): number {
  if (!isRec(original)) return 0;
  const risu = isRec(original.risu) ? original.risu : null;
  if (!risu) return 0;
  const top = countAssetRows(risu.additionalAssets);
  if (top > 0) return top;

  const raw = isRec(risu.raw) ? risu.raw : null;
  const data = raw && isRec(raw.data) ? raw.data : null;
  if (data) {
    const onData = countAssetRows(data.additionalAssets);
    if (onData > 0) return onData;
    const ext = isRec(data.extensions) ? data.extensions : null;
    const risuai = ext && isRec(ext.risuai) ? ext.risuai : null;
    if (risuai) {
      const onExt = countAssetRows(risuai.additionalAssets);
      if (onExt > 0) return onExt;
    }
    // x-risu-asset rows
    const assets = Array.isArray(data.assets) ? data.assets : [];
    let n = 0;
    for (const a of assets) {
      if (
        isRec(a) &&
        a.type === "x-risu-asset" &&
        typeof a.name === "string" &&
        typeof a.uri === "string"
      ) {
        n++;
      }
    }
    if (n > 0) return n;
  }
  return 0;
}

/**
 * Count pack faces + named bag + portrait presence for export preview chips.
 * Named count uses Risu twin when `original` is passed.
 */
export function mediaExportSummary(body: unknown, original?: unknown): MediaExportSummary {
  const b = isRec(body) ? body : {};
  const media = (isRec(b.media) ? b.media : {}) as Media;
  const pack = packFromMedia(media);
  const emotions = pack.items.length;
  const hasPortrait = Boolean(
    media.portrait && typeof media.portrait.ref === "string" && media.portrait.ref.trim(),
  );
  const named = countNamedFromOriginal(original);

  const chips: string[] = [];
  if (hasPortrait) chips.push("portrait");
  if (emotions > 0) {
    chips.push(`${emotions} emotion${emotions === 1 ? "" : "s"}`);
  }
  if (named > 0) {
    chips.push(`${named} named`);
  }

  return { emotions, named, hasPortrait, chips };
}
