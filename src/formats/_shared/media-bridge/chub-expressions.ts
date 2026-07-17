/**
 * Chub extensions.chub.expressions / alt_expressions <-> SpritePack. Pure.
 * Shape is open: often {} or label->url/object; we accept string refs and {url}|{uri}|{path}.
 */
import {
  newPackItemId,
  normalizePack,
  type SpritePackItem,
  type SpritePackValue,
} from "../../../core/media";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

const refFromValue = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (!isRec(v)) return "";
  return str(v.url || v.uri || v.path || v.image || v.src).trim();
};

export function packFromChubExpressions(bag: unknown): SpritePackValue {
  if (!isRec(bag)) return normalizePack({ items: [] });
  const items: SpritePackItem[] = [];
  for (const [label, v] of Object.entries(bag)) {
    const ref = refFromValue(v);
    if (!label.trim() || !ref) continue;
    items.push({ id: newPackItemId(), label: label.trim(), ref });
  }
  return normalizePack({ items });
}

/** Simple map label -> url string (Chub-friendly). */
export function chubExpressionsFromPack(pack: SpritePackValue): Record<string, string> {
  const p = normalizePack(pack);
  const out: Record<string, string> = {};
  for (const it of p.items) out[it.label] = it.ref;
  return out;
}

export function packFromChubOriginal(original: Record<string, unknown>): SpritePackValue {
  const st = isRec(original.sillytavern) ? original.sillytavern : null;
  const raw = st && isRec(st.raw) ? st.raw : null;
  const data = raw && isRec(raw.data) ? raw.data : null;
  const ext = data && isRec(data.extensions) ? data.extensions : null;
  const chub = ext && isRec(ext.chub) ? ext.chub : null;
  if (!chub) return normalizePack({ items: [] });
  const primary = packFromChubExpressions(chub.expressions);
  if (primary.items.length) return primary;
  return packFromChubExpressions(chub.alt_expressions);
}

export function originalWithChubPack(
  original: Record<string, unknown>,
  pack: SpritePackValue,
): Record<string, unknown> {
  // Open Rec clones: conditional `{}` would otherwise infer closed literals and block sibling keys.
  const st: Rec = isRec(original.sillytavern)
    ? { ...original.sillytavern }
    : { raw: { data: { extensions: { chub: {} } } } };
  const raw: Rec = isRec(st.raw) ? { ...st.raw } : { data: { extensions: { chub: {} } } };
  const data: Rec = isRec(raw.data) ? { ...raw.data } : { extensions: { chub: {} } };
  const ext: Rec = isRec(data.extensions) ? { ...data.extensions } : {};
  const chub: Rec = isRec(ext.chub) ? { ...ext.chub } : {};
  chub.expressions = chubExpressionsFromPack(pack);
  ext.chub = chub;
  data.extensions = ext;
  raw.data = data;
  st.raw = raw;
  return { ...original, sillytavern: st };
}
