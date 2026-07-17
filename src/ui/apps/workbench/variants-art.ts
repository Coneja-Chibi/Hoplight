/**
 * Per-variant art for the variant strip. Only surfaces a thumb when the variant
 * actually overrides media.portrait (inherit = no duplicate of base art).
 * Pure.
 */
import type { CharacterVariant } from "../../../entities/character/schema";
import { isPreviewablePortraitRef } from "../../../core/media";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Previewable portrait ref the variant owns (override present), else null.
 * Selecting the variant still shows base art in the main stage via applyVariant inherit.
 */
export function variantOwnPortraitRef(variant: CharacterVariant): string | null {
  const media = isRec(variant.overrides) ? variant.overrides.media : undefined;
  if (!isRec(media)) return null;
  const portrait = isRec(media.portrait) ? media.portrait : undefined;
  if (!portrait) return null;
  const ref = str(portrait.ref).trim();
  if (!ref) return null;
  return isPreviewablePortraitRef(ref) ? ref : null;
}

/** Map variant id -> own art URL (null = inherits base, no custom thumb). */
export function variantArtUrls(
  variants: readonly CharacterVariant[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const v of variants) {
    out[v.id] = variantOwnPortraitRef(v);
  }
  return out;
}
