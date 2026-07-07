/**
 * Character-variant merge. A variant is an alternate version of the character that can override ANY
 * field of the base (inspired by RoleCall's variant mechanic, apps/rc src/lib/scene/variant-merge.ts,
 * generalized from RC's fixed field subset to a deep partial of the whole body). The editor/preview
 * renders the base with the active variant deep-merged in. Pure: returns a NEW body, never mutates.
 *
 * Two modes (RC's), both over the any-field overrides:
 *   - mirror (default): deep-overlay - a field is overridden when its key is PRESENT in `overrides`
 *     (nested objects recurse; arrays/primitives replace; set "" to clear). Absent keys inherit.
 *   - full override (mirrorBase === false): each section the variant defines REPLACES the base's whole
 *     section (base fields in it drop); sections the variant omits still inherit; the character keeps a
 *     name (base name falls through when the override omits it).
 */
import type { CharacterBody, CharacterVariant, DeepPartial } from "./schema";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Deep-overlay `over` onto `base` by key presence. Recurses plain objects; arrays/primitives replace. */
function deepMerge<T>(base: T, over: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(over as Record<string, unknown>)) {
    if (value === undefined) continue; // an absent override does not touch the base
    const baseValue = out[key];
    out[key] = isPlainObject(value) && isPlainObject(baseValue) ? deepMerge(baseValue, value) : value;
  }
  return out as T;
}

/** The base body with the variant applied, per its mode. Pure. */
export function applyVariant(base: CharacterBody, variant: CharacterVariant): CharacterBody {
  const overrides = variant.overrides as DeepPartial<CharacterBody>;
  if (variant.mirrorBase !== false) return deepMerge(base, overrides); // mirror (default)

  // full override: each defined section replaces the base's section wholesale; omitted sections inherit
  const out: Record<string, unknown> = { ...(base as unknown as Record<string, unknown>) };
  for (const [key, section] of Object.entries(overrides as Record<string, unknown>)) {
    if (section !== undefined) out[key] = section;
  }
  const identity = out.identity as { name?: string } | undefined;
  if (!identity?.name) out.identity = { ...(identity ?? {}), name: base.identity.name };
  return out as unknown as CharacterBody;
}
