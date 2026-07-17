/**
 * Pure Agnai FullSprite (flat parts + colors + gender) normalize.
 */
const SPECIALS = ["eyeColor", "bodyColor", "hairColor", "gender"] as const;

export interface SpritePartsValue {
  parts: Record<string, string>;
  gender: string;
  eyeColor: string;
  bodyColor: string;
  hairColor: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function normalizeSprite(raw: unknown): SpritePartsValue {
  const parts: Record<string, string> = {};
  let gender = "";
  let eyeColor = "";
  let bodyColor = "";
  let hairColor = "";
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    // Canonical Sprite shape { parts, gender, ... } or flat wire
    if (r.parts && typeof r.parts === "object" && !Array.isArray(r.parts)) {
      for (const [k, v] of Object.entries(r.parts as Record<string, unknown>)) {
        if (typeof v === "string") parts[k] = v;
      }
      gender = str(r.gender);
      eyeColor = str(r.eyeColor);
      bodyColor = str(r.bodyColor);
      hairColor = str(r.hairColor);
    } else {
      for (const [k, v] of Object.entries(r)) {
        if ((SPECIALS as readonly string[]).includes(k)) {
          if (k === "gender") gender = str(v);
          if (k === "eyeColor") eyeColor = str(v);
          if (k === "bodyColor") bodyColor = str(v);
          if (k === "hairColor") hairColor = str(v);
        } else if (typeof v === "string") {
          parts[k] = v;
        }
      }
    }
  }
  return { parts, gender, eyeColor, bodyColor, hairColor };
}

/** Flat wire object for Agnai FullSprite (original twin). */
export function spriteToWire(v: SpritePartsValue): Record<string, unknown> {
  const out: Record<string, unknown> = { ...v.parts };
  if (v.gender) out.gender = v.gender;
  if (v.eyeColor) out.eyeColor = v.eyeColor;
  if (v.bodyColor) out.bodyColor = v.bodyColor;
  if (v.hairColor) out.hairColor = v.hairColor;
  return out;
}

/** Canonical Sprite for body.media.sprite. */
export function spriteToCanonical(v: SpritePartsValue): Record<string, unknown> {
  const out: Record<string, unknown> = { parts: { ...v.parts } };
  if (v.gender) out.gender = v.gender;
  if (v.eyeColor) out.eyeColor = v.eyeColor;
  if (v.bodyColor) out.bodyColor = v.bodyColor;
  if (v.hairColor) out.hairColor = v.hairColor;
  return out;
}
