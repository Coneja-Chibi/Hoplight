/**
 * Pure character-variant editing authority shared by semantic capabilities and the Workbench.
 * Override writes preserve intentional blank strings and arrays; inheritance removes only the leaf.
 */
import type { CharacterBody, CharacterVariant } from "./schema";
import { readCharacterPath, writeCharacterPath } from "./capabilities/operations";

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const bodyRecord = (body: CharacterBody): Record<string, unknown> =>
  body as unknown as Record<string, unknown>;

const asBody = (body: Record<string, unknown>): CharacterBody =>
  body as unknown as CharacterBody;

/** Read the body's declared variants, or an empty list for malformed/absent input. */
export function variantsOf(body: unknown): CharacterVariant[] {
  const variants = readCharacterPath(body, "variants");
  return Array.isArray(variants) ? variants as CharacterVariant[] : [];
}

/** Write a present value into an override tree, including intentional blank strings and arrays. */
export function writeVariantOverride(
  overrides: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): Record<string, unknown> {
  const keys = dotPath.split(".");
  const output: Record<string, unknown> = { ...overrides };
  let host = output;
  for (const key of keys.slice(0, -1)) {
    const next = { ...record(host[key]) };
    host[key] = next;
    host = next;
  }
  host[keys.at(-1)!] = structuredClone(value);
  return output;
}

/** Remove one override leaf so that field resumes inheriting from the base character. */
export function inheritVariantOverride(
  overrides: Record<string, unknown>,
  dotPath: string,
): Record<string, unknown> {
  const keys = dotPath.split(".");
  const output: Record<string, unknown> = { ...overrides };
  let host = output;
  for (const key of keys.slice(0, -1)) {
    const current = host[key];
    if (current === null || typeof current !== "object" || Array.isArray(current)) return output;
    const next = { ...current as Record<string, unknown> };
    host[key] = next;
    host = next;
  }
  delete host[keys.at(-1)!];
  return output;
}

/** Whether an override path is explicitly present, including a blank value. */
export function variantOverridePresent(overrides: unknown, dotPath: string): boolean {
  let current: unknown = overrides;
  for (const key of dotPath.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return false;
    if (!Object.prototype.hasOwnProperty.call(current, key)) return false;
    current = (current as Record<string, unknown>)[key];
  }
  return true;
}

/** Append one empty variant. Duplicate ids fail closed. */
export function addVariant(
  body: CharacterBody,
  id: string,
  label?: string,
  mirrorBase?: boolean,
): CharacterBody {
  if (variantsOf(body).some((variant) => variant.id === id)) {
    throw new Error(`character variant "${id}" already exists`);
  }
  const variant: CharacterVariant = {
    id,
    ...(label === undefined ? {} : { label }),
    overrides: {},
    ...(mirrorBase === undefined ? {} : { mirrorBase }),
  };
  return asBody(writeCharacterPath(bodyRecord(body), "variants", [...variantsOf(body), variant]));
}

/** Remove one existing variant. Missing ids fail closed. */
export function removeVariant(body: CharacterBody, id: string): CharacterBody {
  const variants = variantsOf(body);
  if (!variants.some((variant) => variant.id === id)) {
    throw new Error(`character variant "${id}" does not exist`);
  }
  return asBody(writeCharacterPath(
    bodyRecord(body),
    "variants",
    variants.filter((variant) => variant.id !== id),
  ));
}

function mapVariant(
  body: CharacterBody,
  id: string,
  update: (variant: CharacterVariant) => CharacterVariant,
): CharacterBody {
  let found = false;
  const variants = variantsOf(body).map((variant) => {
    if (variant.id !== id) return variant;
    found = true;
    return update(variant);
  });
  if (!found) throw new Error(`character variant "${id}" does not exist`);
  return asBody(writeCharacterPath(bodyRecord(body), "variants", variants));
}

/** Set or remove a human-facing variant label. */
export function setVariantLabel(
  body: CharacterBody,
  id: string,
  label: string | undefined,
): CharacterBody {
  return mapVariant(body, id, (variant) => {
    if (label === undefined) {
      const { label: _removed, ...rest } = variant;
      return rest;
    }
    return { ...variant, label };
  });
}

/** Set the explicit mirror/full merge mode. */
export function setVariantMode(body: CharacterBody, id: string, mirrorBase: boolean): CharacterBody {
  return mapVariant(body, id, (variant) => ({ ...variant, mirrorBase }));
}

/** Write one semantic canonical field into a named variant. */
export function setVariantField(
  body: CharacterBody,
  id: string,
  path: string,
  value: unknown,
): CharacterBody {
  return mapVariant(body, id, (variant) => ({
    ...variant,
    overrides: writeVariantOverride(record(variant.overrides), path, value),
  }));
}

/** Remove one field override from a named variant. */
export function inheritVariantField(body: CharacterBody, id: string, path: string): CharacterBody {
  return mapVariant(body, id, (variant) => ({
    ...variant,
    overrides: inheritVariantOverride(record(variant.overrides), path),
  }));
}

/** Whether a named variant explicitly overrides one canonical path. */
export function variantHasOverride(body: unknown, id: string, path: string): boolean {
  const variant = variantsOf(body).find((candidate) => candidate.id === id);
  return variant ? variantOverridePresent(variant.overrides, path) : false;
}
