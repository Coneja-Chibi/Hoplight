/**
 * Lumiverse extensions.expressions + expression_groups <-> SpritePack hub. Pure.
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

export type LumiExpressionConfig = {
  enabled?: boolean;
  defaultExpression?: string;
  mappings?: Record<string, string>;
};

export type LumiExpressionGroups = Record<string, Record<string, string>>;

/** Flat pack from Lumi expressions config. */
export function packFromLumiExpressions(config: unknown): SpritePackValue {
  if (!isRec(config)) return normalizePack({ items: [] });
  const mappings = isRec(config.mappings) ? config.mappings : {};
  const items: SpritePackItem[] = [];
  for (const [label, ref] of Object.entries(mappings)) {
    if (typeof ref !== "string" || !ref.trim() || !label.trim()) continue;
    items.push({ id: newPackItemId(), label: label.trim(), ref: ref.trim() });
  }
  const pack = normalizePack({
    items,
    enabled: config.enabled === true ? true : config.enabled === false ? false : undefined,
    defaultLabel: str(config.defaultExpression).trim() || undefined,
  });
  return pack;
}

/** Pack -> Lumi expressions block */
export function lumiExpressionsFromPack(pack: SpritePackValue): LumiExpressionConfig {
  const p = normalizePack(pack);
  const mappings: Record<string, string> = {};
  for (const it of p.items) mappings[it.label] = it.ref;
  const out: LumiExpressionConfig = { mappings };
  if (p.enabled === true) out.enabled = true;
  if (p.enabled === false) out.enabled = false;
  if (p.defaultLabel) out.defaultExpression = p.defaultLabel;
  else if (p.items[0]) out.defaultExpression = p.items[0].label;
  return out;
}

/** Groups: characterName -> pack */
export function packsFromLumiGroups(groups: unknown): Record<string, SpritePackValue> {
  if (!isRec(groups)) return {};
  // support { groups: Record } or bare Record
  const root = isRec(groups.groups) ? groups.groups : groups;
  const out: Record<string, SpritePackValue> = {};
  for (const [charName, map] of Object.entries(root)) {
    if (!isRec(map)) continue;
    const items: SpritePackItem[] = [];
    for (const [label, ref] of Object.entries(map)) {
      if (typeof ref !== "string" || !ref.trim()) continue;
      items.push({ id: newPackItemId(), label, ref: ref.trim() });
    }
    out[charName] = normalizePack({ items });
  }
  return out;
}

export function lumiGroupsFromPacks(
  packs: Record<string, SpritePackValue>,
): { groups: LumiExpressionGroups } {
  const groups: LumiExpressionGroups = {};
  for (const [charName, pack] of Object.entries(packs)) {
    const p = normalizePack(pack);
    const map: Record<string, string> = {};
    for (const it of p.items) map[it.label] = it.ref;
    if (Object.keys(map).length) groups[charName] = map;
  }
  return { groups };
}

/** Read from ST twin extensions on original */
export function packFromLumiOriginal(original: Record<string, unknown>): SpritePackValue {
  const st = isRec(original.sillytavern) ? original.sillytavern : null;
  const raw = st && isRec(st.raw) ? st.raw : null;
  const data = raw && isRec(raw.data) ? raw.data : null;
  const ext = data && isRec(data.extensions) ? data.extensions : null;
  if (!ext) return normalizePack({ items: [] });
  return packFromLumiExpressions(ext.expressions);
}

export function groupsFromLumiOriginal(
  original: Record<string, unknown>,
): Record<string, SpritePackValue> {
  const st = isRec(original.sillytavern) ? original.sillytavern : null;
  const raw = st && isRec(st.raw) ? st.raw : null;
  const data = raw && isRec(raw.data) ? raw.data : null;
  const ext = data && isRec(data.extensions) ? data.extensions : null;
  if (!ext) return {};
  return packsFromLumiGroups(ext.expression_groups);
}

/** Write pack (+ optional groups) onto sillytavern extensions */
export function originalWithLumiPack(
  original: Record<string, unknown>,
  pack: SpritePackValue,
  groups?: Record<string, SpritePackValue>,
): Record<string, unknown> {
  const st = isRec(original.sillytavern) ? { ...original.sillytavern } : { raw: { data: { extensions: {} } } };
  const raw = isRec(st.raw) ? { ...st.raw } : { data: { extensions: {} } };
  const data = isRec(raw.data) ? { ...raw.data } : { extensions: {} };
  const ext = isRec(data.extensions) ? { ...data.extensions } : {};
  ext.expressions = lumiExpressionsFromPack(pack);
  if (groups && Object.keys(groups).length > 0) {
    ext.expression_groups = lumiGroupsFromPacks(groups);
  }
  data.extensions = ext;
  raw.data = data;
  st.raw = raw;
  return { ...original, sillytavern: st };
}
