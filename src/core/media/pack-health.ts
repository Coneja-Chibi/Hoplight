/**
 * Soft pack health checks. Pure; never throws; never blocks apply.
 */
import { normalizeLabel, normalizePack, type SpritePackValue } from "./pack";

export type PackHealthKind = "ok" | "tip" | "warn";

export type PackHealthNote = {
  kind: PackHealthKind;
  text: string;
};

const approxBytesFromDataUri = (ref: string): number => {
  if (!ref.startsWith("data:")) return 0;
  const i = ref.indexOf(",");
  if (i < 0) return 0;
  const b64 = ref.slice(i + 1);
  return Math.floor((b64.length * 3) / 4);
};

/** Human soft checks for creators. */
export function packHealth(pack: SpritePackValue): PackHealthNote[] {
  const p = normalizePack(pack);
  const notes: PackHealthNote[] = [];
  if (p.items.length === 0) {
    notes.push({ kind: "tip", text: "Empty pack. Drop images or import a ZIP to add faces." });
    return notes;
  }

  const norms = p.items.map((i) => normalizeLabel(i.label));
  const hasNeutral = norms.some((n) => n === "neutral" || n === "default" || n === "idle");
  if (!hasNeutral) {
    notes.push({
      kind: "tip",
      text: "No neutral/default face. Hosts often fall back here when emotion is unclear.",
    });
  }

  const seen = new Set<string>();
  for (const n of norms) {
    if (seen.has(n)) {
      notes.push({ kind: "warn", text: `Duplicate label after normalize: "${n}". Last one wins on export.` });
      break;
    }
    seen.add(n);
  }

  let bytes = 0;
  for (const it of p.items) bytes += approxBytesFromDataUri(it.ref);
  if (bytes > 8 * 1024 * 1024) {
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    notes.push({
      kind: "warn",
      text: `Pack embeds ~${mb} MB. Large CharX / PNG cards may be slow to share.`,
    });
  } else if (bytes > 2 * 1024 * 1024) {
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    notes.push({ kind: "tip", text: `Pack size ~${mb} MB (embedded).` });
  }

  if (p.items.length === 1) {
    notes.push({ kind: "tip", text: "Only one face. A few more (happy/sad/angry) help most hosts." });
  }

  if (notes.length === 0) {
    notes.push({ kind: "ok", text: `${p.items.length} faces · looks good.` });
  }
  return notes;
}
