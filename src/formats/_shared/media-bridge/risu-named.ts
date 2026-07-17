/**
 * Risu additionalAssets / x-risu-asset <-> NamedAssets hub. Pure.
 */
import {
  kindFromExt,
  newNamedId,
  normalizeNamed,
  type NamedAsset,
  type NamedAssetsValue,
} from "../../../core/media";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Runtime twin shape: [name, pathOrRef, ext?][] */
export function namedFromRisuAdditional(rows: unknown): NamedAssetsValue {
  if (!Array.isArray(rows)) return normalizeNamed({ items: [] });
  const items: NamedAsset[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const name = str(row[0]).trim();
    const ref = str(row[1]).trim();
    if (!name || !ref) continue;
    const ext = str(row[2]).trim() || name.split(".").pop()?.toLowerCase() || "";
    const kind = kindFromExt(ext);
    items.push({
      id: newNamedId(),
      name,
      ref,
      kind,
      ...(ext ? { ext } : {}),
    });
  }
  return normalizeNamed({ items });
}

/** Named hub -> Risu additionalAssets rows */
export function risuAdditionalFromNamed(value: NamedAssetsValue): [string, string, string][] {
  const n = normalizeNamed(value);
  return n.items.map((it) => {
    const ext = it.ext || it.name.split(".").pop()?.toLowerCase() || "bin";
    return [it.name, it.ref, ext];
  });
}

/** Pull from original.risu (runtime or raw extensions.risuai.additionalAssets) */
export function namedFromRisuOriginal(original: Record<string, unknown>): NamedAssetsValue {
  const risu = isRec(original.risu) ? original.risu : null;
  if (!risu) return normalizeNamed({ items: [] });

  if (Array.isArray(risu.additionalAssets)) {
    return namedFromRisuAdditional(risu.additionalAssets);
  }

  const raw = isRec(risu.raw) ? risu.raw : null;
  const data = raw && isRec(raw.data) ? raw.data : null;
  const ext = data && isRec(data.extensions) ? data.extensions : null;
  const risuai = ext && isRec(ext.risuai) ? ext.risuai : null;
  if (risuai && Array.isArray(risuai.additionalAssets)) {
    return namedFromRisuAdditional(risuai.additionalAssets);
  }

  // x-risu-asset rows on data.assets
  const assets = data && Array.isArray(data.assets) ? data.assets : [];
  const fromX: NamedAsset[] = [];
  for (const a of assets) {
    if (!isRec(a) || str(a.type) !== "x-risu-asset") continue;
    const name = str(a.name).trim();
    const ref = str(a.uri).trim();
    if (!name || !ref) continue;
    const extName = str(a.ext).trim();
    fromX.push({
      id: newNamedId(),
      name,
      ref,
      kind: kindFromExt(extName),
      ...(extName ? { ext: extName } : {}),
    });
  }
  if (fromX.length) return normalizeNamed({ items: fromX });
  return normalizeNamed({ items: [] });
}

/** Write named bag onto risu twin paths that exist. */
export function originalWithNamed(
  original: Record<string, unknown>,
  value: NamedAssetsValue,
): Record<string, unknown> {
  if (!isRec(original.risu)) {
    // create minimal risu bag for authoring
    return {
      ...original,
      risu: { additionalAssets: risuAdditionalFromNamed(value) },
    };
  }
  // Open Rec clone so sibling keys (raw, etc.) stay assignable after spreads.
  const risu: Rec = { ...original.risu, additionalAssets: risuAdditionalFromNamed(value) };
  // also mirror into raw.extensions.risuai if raw card exists
  const raw: Rec | null = isRec(risu.raw) ? { ...risu.raw } : null;
  if (raw && isRec(raw.data)) {
    const data: Rec = { ...raw.data };
    const extensions: Rec = isRec(data.extensions) ? { ...data.extensions } : {};
    const risuai: Rec = isRec(extensions.risuai) ? { ...extensions.risuai } : {};
    risuai.additionalAssets = risuAdditionalFromNamed(value);
    extensions.risuai = risuai;
    data.extensions = extensions;
    raw.data = data;
    risu.raw = raw;
  }
  return { ...original, risu };
}
