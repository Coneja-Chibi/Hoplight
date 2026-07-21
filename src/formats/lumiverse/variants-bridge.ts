/**
 * Bridge Lumiverse alternate_fields / alternate_avatars <-> body.variants.
 * Lumi stores per-slot named alts; Hoplight authors whole-card variants (VariantStrip).
 * Import: fold alts into variants by shared label. Export: fold variant overrides back to Lumi wire.
 */
import type { CharacterBody, CharacterVariant, MediaAsset } from "../../entities/character/schema";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const FIELD_KEYS = ["description", "personality", "scenario"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function stableId(label: string, fallback: string): string {
  const slug = label.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  return slug ? `lumi_${slug}` : fallback;
}

/**
 * Build body.variants from extensions.alternate_fields + alternate_avatars.
 * Entries that share a label merge into one variant (desc + personality + face under "Formal").
 */
export function altsToVariants(ext: unknown): CharacterVariant[] {
  if (!isRec(ext)) return [];
  const byKey = new Map<string, CharacterVariant>();

  const ensure = (label: string, idHint?: string): CharacterVariant => {
    const key = label.trim() || idHint || "variant";
    let v = byKey.get(key);
    if (!v) {
      v = {
        id: idHint && idHint.length > 0 ? idHint : stableId(key, `lumi_${byKey.size + 1}`),
        label: key,
        mirrorBase: true,
        overrides: {},
      };
      byKey.set(key, v);
    }
    return v;
  };

  const af = ext.alternate_fields;
  if (isRec(af)) {
    for (const field of FIELD_KEYS) {
      const rows = af[field];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!isRec(row)) continue;
        const label = str(row.label)?.trim() || str(row.id) || "Variant";
        const content = str(row.content) ?? "";
        const v = ensure(label, str(row.id));
        if (field === "description") {
          v.overrides.identity = { ...(v.overrides.identity ?? {}), description: content };
        } else if (field === "personality") {
          v.overrides.persona = { ...(v.overrides.persona ?? {}), personality: content };
        } else {
          v.overrides.persona = { ...(v.overrides.persona ?? {}), scenario: content };
        }
      }
    }
  }

  const avatars = ext.alternate_avatars;
  if (Array.isArray(avatars)) {
    for (const row of avatars) {
      if (!isRec(row)) continue;
      const label = str(row.label)?.trim() || str(row.id) || "Face";
      const ref = str(row.image_id) ?? str(row.path) ?? "";
      if (!ref) continue;
      const v = ensure(label, str(row.id));
      const portrait: MediaAsset = {
        role: "portrait",
        label,
        ref,
        primary: true,
      };
      v.overrides.media = { ...(v.overrides.media ?? {}), portrait };
    }
  }

  return [...byKey.values()];
}

export interface LumiAltsWire {
  alternate_fields?: Partial<Record<FieldKey, Array<{ id: string; label: string; content: string }>>>;
  alternate_avatars?: Array<{ id: string; label: string; image_id: string; path: string }>;
}

/**
 * Fold body.variants back into Lumiverse extension alts for export.
 * Only emits rows for fields the variant actually overrides.
 */
export function variantsToAlts(variants: CharacterVariant[] | undefined): LumiAltsWire {
  if (!variants?.length) return {};
  const fields: Partial<Record<FieldKey, Array<{ id: string; label: string; content: string }>>> = {};
  const avatars: Array<{ id: string; label: string; image_id: string; path: string }> = [];

  for (const v of variants) {
    const label = v.label?.trim() || v.id;
    const o = v.overrides;
    const desc = o.identity?.description;
    if (typeof desc === "string") {
      (fields.description ??= []).push({ id: v.id, label, content: desc });
    }
    const personality = o.persona?.personality;
    if (typeof personality === "string") {
      (fields.personality ??= []).push({ id: v.id, label, content: personality });
    }
    const scenario = o.persona?.scenario;
    if (typeof scenario === "string") {
      (fields.scenario ??= []).push({ id: v.id, label, content: scenario });
    }
    const ref = o.media?.portrait?.ref;
    if (typeof ref === "string" && ref.length > 0) {
      avatars.push({ id: v.id, label, image_id: ref, path: ref });
    }
  }

  const out: LumiAltsWire = {};
  if (fields.description || fields.personality || fields.scenario) {
    out.alternate_fields = fields;
  }
  if (avatars.length) out.alternate_avatars = avatars;
  return out;
}

/** Apply alts→variants onto a body (sets body.variants when any alts exist). */
export function applyAltsToBody(body: CharacterBody, ext: unknown): CharacterBody {
  const variants = altsToVariants(ext);
  if (!variants.length) return body;
  return { ...body, variants };
}

/** Merge variants→alts into an extensions object (overwrites alternate_fields/avatars when variants present). */
export function applyVariantsToExtensions(ext: Rec, body: CharacterBody): Rec {
  const alts = variantsToAlts(body.variants);
  const next = { ...ext };
  if (alts.alternate_fields) next.alternate_fields = alts.alternate_fields;
  else delete next.alternate_fields;
  if (alts.alternate_avatars) next.alternate_avatars = alts.alternate_avatars;
  else delete next.alternate_avatars;
  return next;
}
