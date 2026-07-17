/**
 * Thin-export helper: promote one pack face to portrait and clear emotion pack.
 * Pure. Hosts that only carry a single face get an honest card.
 */
import type { Media } from "../../entities/character/schema";
import { applyPackToMedia, emptyPack, normalizePack, resolvePackFace, type SpritePackValue } from "./pack";
import { portraitFromRef } from "./portrait";

export type FaceOnlyResult = {
  media: Media;
  pack: SpritePackValue;
  /** label that became the portrait */
  faceLabel: string | null;
};

/**
 * Set portrait from pack face (wantLabel -> default -> neutral -> first).
 * Clear emotion assets. Keeps non-emotion assets, sprite recipe, visualKind.
 */
export function faceOnlyFromPack(
  media: Media | undefined,
  pack: SpritePackValue,
  wantLabel?: string | null,
): FaceOnlyResult {
  const p = normalizePack(pack);
  const face = resolvePackFace(p, wantLabel);
  if (!face) {
    return {
      media: media ?? {},
      pack: emptyPack(),
      faceLabel: null,
    };
  }

  const portrait = portraitFromRef(face.ref, face.mime);
  const base = applyPackToMedia(media, emptyPack());
  const next: Media = { ...base };
  if (portrait) next.portrait = portrait;
  // Bond metadata: this face was promoted from the pack label.
  next.faceLabel = face.label;

  return {
    media: next,
    pack: emptyPack(),
    faceLabel: face.label,
  };
}
