/**
 * CCv3 data.assets[] emotion/expression rows <-> SpritePack hub.
 * ST / RoleCall / Risu V3 share this shape. Pure.
 */
import {
  emotionAssetsFromPack,
  normalizePack,
  type SpritePackValue,
  newPackItemId,
} from "../../../core/media";
import { extFromMimeOrRef, mimeFromExt } from "../assets";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export type Ccv3AssetRow = {
  type?: string;
  uri?: string;
  name?: string;
  ext?: string;
};

/** Wire type for emotion rows. RC prefers "expression"; ST/Risu prefer "emotion". */
export type EmotionWireType = "emotion" | "expression";

/** Pack from a CCv3 assets array (emotion + expression only; main icon ignored). */
export function packFromCcv3Assets(assets: unknown): SpritePackValue {
  if (!Array.isArray(assets)) return normalizePack({ items: [] });
  const items: { id: string; label: string; ref: string; mime?: string }[] = [];
  for (const a of assets) {
    if (!isRec(a)) continue;
    const type = str(a.type);
    const name = str(a.name);
    // main icon is portrait, not pack
    if (name === "main" || type === "icon") continue;
    if (type !== "emotion" && type !== "expression") continue;
    const ref = str(a.uri).trim();
    const label = name.trim();
    if (!label || !ref) continue;
    const mime = mimeFromExt(a.ext);
    const item: { id: string; label: string; ref: string; mime?: string } = {
      id: newPackItemId(),
      label,
      ref,
    };
    if (mime) item.mime = mime;
    items.push(item);
  }
  return normalizePack({ items });
}

/**
 * Merge pack into assets[]: replace emotion/expression rows; keep icon/outfit/etc.
 * @param wireType how to tag emotion rows on write
 */
export function mergePackIntoCcv3Assets(
  assets: unknown,
  pack: SpritePackValue,
  wireType: EmotionWireType = "emotion",
): Ccv3AssetRow[] {
  const base = Array.isArray(assets)
    ? assets.filter((a) => {
        if (!isRec(a)) return false;
        const type = str(a.type);
        const name = str(a.name);
        if (name === "main") return true;
        if (type === "emotion" || type === "expression") return false;
        return true;
      }).map((a) => ({ ...(a as Ccv3AssetRow) }))
    : [];

  const p = normalizePack(pack);
  for (const item of p.items) {
    const row: Ccv3AssetRow = {
      type: wireType,
      uri: item.ref,
      name: item.label,
    };
    const ext = extFromMimeOrRef(item.mime, item.ref);
    if (ext !== undefined) row.ext = ext;
    base.push(row);
  }
  return base;
}

/** Body emotion assets from pack (for hub write). */
export const bodyEmotionsFromPack = (pack: SpritePackValue) => emotionAssetsFromPack(pack);
