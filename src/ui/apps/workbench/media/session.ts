/**
 * Pure media session helpers: pack/named from drafts; apply to body + twins.
 */
import type { Media } from "../../../../entities/character/schema";
import {
  applyPackToMedia,
  faceOnlyFromPack,
  packFromMedia,
  type NamedAssetsValue,
  type SpritePackValue,
} from "../../../../core/media";
import {
  mergePackIntoCcv3Assets,
  originalWithChubPack,
  originalWithLumiPack,
  originalWithNamed,
  namedFromRisuOriginal,
  packFromChubOriginal,
  packFromLumiOriginal,
  groupsFromLumiOriginal,
} from "../../../../formats/_shared/media-bridge";
import { writePath } from "../editor-core";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const rec = (v: unknown): Record<string, unknown> => (isRec(v) ? v : {});

/** Prefer body pack; fall back to Lumi/Chub twin maps. */
export function packFromBodyDraft(
  body: Record<string, unknown>,
  original?: Record<string, unknown>,
): SpritePackValue {
  const fromBody = packFromMedia(rec(body.media) as Media);
  if (fromBody.items.length > 0) return fromBody;
  if (!original) return fromBody;
  const lumi = packFromLumiOriginal(original);
  if (lumi.items.length > 0) return lumi;
  return packFromChubOriginal(original);
}

export function bodyWithPack(
  body: Record<string, unknown>,
  pack: SpritePackValue,
): Record<string, unknown> {
  const media = rec(body.media) as Media;
  const nextMedia = applyPackToMedia(media, pack);
  return writePath(body, "media", nextMedia) as Record<string, unknown>;
}

/** Merge pack into all present twins (ST/RC/Risu assets + Lumi/Chub maps). */
export function originalWithPack(
  original: Record<string, unknown>,
  pack: SpritePackValue,
  groups?: Record<string, SpritePackValue>,
): Record<string, unknown> {
  let next = original;
  const groupMap = groups ?? groupsFromLumiOriginal(original);

  if (isRec(original.sillytavern)) {
    const raw = rec(rec(original.sillytavern).raw);
    const data = rec(raw.data);
    if (Object.keys(data).length > 0 || Array.isArray(data.assets) || isRec(raw.data)) {
      const assets = mergePackIntoCcv3Assets(data.assets, pack, "emotion");
      next = writePath(next, "sillytavern.raw.data.assets", assets) as Record<string, unknown>;
    }
    const ext = isRec(data.extensions) ? data.extensions : {};
    next = originalWithLumiPack(
      next,
      pack,
      Object.keys(groupMap).length ? groupMap : undefined,
    );
    if (isRec(ext.chub)) {
      next = originalWithChubPack(next, pack);
    }
  }

  if (isRec(original.rolecall)) {
    const raw = rec(rec(original.rolecall).raw);
    const data = rec(raw.data);
    if (Object.keys(data).length > 0 || Array.isArray(data.assets) || isRec(raw.data)) {
      const assets = mergePackIntoCcv3Assets(data.assets, pack, "expression");
      next = writePath(next, "rolecall.raw.data.assets", assets) as Record<string, unknown>;
    }
  }

  if (isRec(original.risu)) {
    const raw = rec(rec(original.risu).raw);
    const data = rec(raw.data);
    if (Object.keys(data).length > 0 || Array.isArray(data.assets) || isRec(raw.data)) {
      const assets = mergePackIntoCcv3Assets(data.assets, pack, "emotion");
      next = writePath(next, "risu.raw.data.assets", assets) as Record<string, unknown>;
    }
  }

  // Pure Lumi twin without sillytavern key
  if (isRec(original.lumiverse) && !isRec(original.sillytavern)) {
    next = originalWithLumiPack(
      next,
      pack,
      Object.keys(groupMap).length ? groupMap : groupsFromLumiOriginal(original),
    );
  }

  return next;
}

export { groupsFromLumiOriginal };


export function namedFromOriginal(original: Record<string, unknown>): NamedAssetsValue {
  return namedFromRisuOriginal(original);
}

export function originalWithNamedBag(
  original: Record<string, unknown>,
  value: NamedAssetsValue,
): Record<string, unknown> {
  return originalWithNamed(original, value);
}

/**
 * Promote one pack face to portrait and clear emotions on body + twins.
 * Returns next body; call originalWithPack(empty pack) for twins separately or use both.
 */
export function bodyWithFaceOnly(
  body: Record<string, unknown>,
  pack: SpritePackValue,
  wantLabel?: string | null,
): { body: Record<string, unknown>; pack: SpritePackValue; faceLabel: string | null } {
  const media = rec(body.media) as Media;
  const result = faceOnlyFromPack(media, pack, wantLabel);
  return {
    body: writePath(body, "media", result.media) as Record<string, unknown>,
    pack: result.pack,
    faceLabel: result.faceLabel,
  };
}
