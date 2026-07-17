/**
 * Media rail feature flags from original twins + lens targets. Deny by absence.
 * Pure: UI does not invent host rules.
 */

export type MediaCapabilities = {
  face: true;
  sprites: boolean;
  spriteGroups: boolean;
  namedAssets: boolean;
};

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const hasRisuTwin = (original: Record<string, unknown>): boolean => isRec(original.risu);

const hasLumiExpressionSurface = (original: Record<string, unknown>): boolean => {
  if (isRec(original.lumiverse)) return true;
  const st = original.sillytavern;
  if (!isRec(st)) return false;
  const raw = isRec(st.raw) ? st.raw : null;
  const data = raw && isRec(raw.data) ? raw.data : null;
  const ext = data && isRec(data.extensions) ? data.extensions : null;
  if (!ext) return false;
  return ext.expressions !== undefined || ext.expression_groups !== undefined;
};

/**
 * @param original entity.original
 * @param targets editor lens platform ids (empty = full card / Vaude)
 */
export function mediaCapabilities(args: {
  original: Record<string, unknown>;
  targets: readonly string[];
}): MediaCapabilities {
  const { original, targets } = args;
  const t = new Set(targets);
  const fullCard = targets.length === 0;

  const risuTwin = hasRisuTwin(original);
  const lumiSurface = hasLumiExpressionSurface(original);

  // Named multipurpose bag: Risu twin or lens on risu. Never "only Lumi/Chub/Mari".
  const namedAssets = risuTwin || t.has("risu");

  // Sprite groups (Lumi multi-char): lens or twin fingerprints.
  const spriteGroups = fullCard
    ? lumiSurface
    : t.has("lumiverse") || lumiSurface;

  // Sprites pack: all image-pack hosts. Hide only when the sole target is Agnai (recipe, not PNG pack).
  const onlyAgnai = targets.length > 0 && [...t].every((id) => id === "agnai");
  const sprites = !onlyAgnai;

  return {
    face: true,
    sprites,
    spriteGroups: sprites && spriteGroups,
    namedAssets,
  };
}
