/**
 * Character-variant editor helpers - pure body transforms so the editor stays a thin view. A variant
 * lives in `body.variants` (see entities/character/variant). Add/remove/edit one, or write a field into
 * a specific variant's overrides. Used by the portrait card's variant strip via use-variants.
 */
import type { CharacterBody, CharacterVariant } from "../../../entities/character/schema";
import { readPath, writePath } from "./editor-core";

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asBody = (r: Record<string, unknown>): CharacterBody => r as unknown as CharacterBody;
const bodyRec = (b: CharacterBody): Record<string, unknown> => b as unknown as Record<string, unknown>;

/** the variants declared on a body (never throws; [] when absent) */
export function variantsOf(body: unknown): CharacterVariant[] {
  const v = readPath(body, "variants");
  return Array.isArray(v) ? (v as CharacterVariant[]) : [];
}

/** append a fresh empty variant with the given id + label */
export function addVariant(body: CharacterBody, id: string, label: string): CharacterBody {
  const next: CharacterVariant = { id, label, overrides: {} };
  return asBody(writePath(bodyRec(body), "variants", [...variantsOf(body), next]));
}

/** drop a variant by id */
export function removeVariant(body: CharacterBody, id: string): CharacterBody {
  return asBody(writePath(bodyRec(body), "variants", variantsOf(body).filter((v) => v.id !== id)));
}

/** write a field (deep dot path) into ONE variant's overrides; an empty value clears the override */
export function setVariantField(body: CharacterBody, id: string, path: string, value: unknown): CharacterBody {
  const list = variantsOf(body).map((v) =>
    v.id === id ? { ...v, overrides: writePath(rec(v.overrides), path, value) } : v,
  );
  return asBody(writePath(bodyRec(body), "variants", list));
}

/** retitle a variant */
export function setVariantLabel(body: CharacterBody, id: string, label: string): CharacterBody {
  const list = variantsOf(body).map((v) => (v.id === id ? { ...v, label } : v));
  return asBody(writePath(bodyRec(body), "variants", list));
}

/** set a variant's merge mode (true/undefined = mirror, false = full override) */
export function setVariantMode(body: CharacterBody, id: string, mirrorBase: boolean): CharacterBody {
  const list = variantsOf(body).map((v) => (v.id === id ? { ...v, mirrorBase } : v));
  return asBody(writePath(bodyRec(body), "variants", list));
}
