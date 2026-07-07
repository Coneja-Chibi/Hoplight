/**
 * Character-variant merge. A variant is an alternate version of the character that can override ANY
 * field of the base (inspired by RoleCall's variant mechanic, apps/rc src/lib/scene/variant-merge.ts,
 * generalized from RC's fixed field subset to a deep partial of the whole body). The editor/preview
 * renders the base with the active variant deep-merged in. Pure: returns a NEW body, never mutates.
 *
 * Merge rule: a field is overridden when its key is PRESENT in the variant's `overrides` - nested
 * objects recurse, arrays and primitives replace wholesale (set a field to "" to clear it). Keys the
 * variant does not mention inherit from the base.
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

/** The base body with the variant's overrides deep-merged in. Pure. */
export function applyVariant(base: CharacterBody, variant: CharacterVariant): CharacterBody {
  return deepMerge(base, variant.overrides as DeepPartial<CharacterBody>);
}
