/**
 * Character capability helpers for target inputs, typed narrowing, and exact preview rows.
 */
import { z } from "zod";
import type { CapabilityChange, CapabilityPreview } from "../../capabilities";
import { nonEmptyPatch } from "../../_shared/capability-schemas";
import type { CanonicalCharacter, CharacterBody } from "../schema";
import { inheritVariantField, setVariantField, variantsOf } from "../variant-edit";
import {
  patchCharacterPaths,
  readCharacterPath,
} from "./operations";

export const targetSchema = z.strictObject({
  id: z.string().min(1).describe("the character piece id"),
  variantId: z.string().min(1).optional().describe("an optional character variant to edit"),
});

export { nonEmptyPatch };

const equal = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export function previewCharacterPatch(
  entity: CanonicalCharacter,
  patch: Readonly<Record<string, unknown>>,
  paths: Readonly<Record<string, string>>,
  variantId?: string,
): CapabilityPreview<CanonicalCharacter> {
  const before = entity.body as unknown as Record<string, unknown>;
  let after = entity.body;
  if (variantId && !variantsOf(entity.body).some((variant) => variant.id === variantId)) {
    throw new Error(`character variant "${variantId}" does not exist`);
  }
  if (variantId) {
    for (const [field, value] of Object.entries(patch)) {
      const path = paths[field];
      if (!path) continue;
      after = value === null
        ? inheritVariantField(after, variantId, path)
        : setVariantField(after, variantId, path, value);
    }
  } else {
    after = patchCharacterPaths(before, patch, paths) as unknown as CharacterBody;
  }
  const changes: CapabilityChange[] = [];
  for (const field of Object.keys(patch)) {
    const path = paths[field];
    if (!path) continue;
    const variantPrefix = variantId ? `variants[id=${variantId}].overrides.` : "";
    const prior = variantId
      ? readCharacterPath(
          variantsOf(entity.body).find((variant) => variant.id === variantId)?.overrides,
          path,
        )
      : readCharacterPath(before, path);
    const next = variantId
      ? readCharacterPath(
          variantsOf(after).find((variant) => variant.id === variantId)?.overrides,
          path,
        )
      : readCharacterPath(after, path);
    if (!equal(prior, next)) {
      changes.push({
        path: `body.${variantPrefix}${path}`,
        label: field,
        before: prior,
        after: next,
      });
    }
  }
  return {
    entity: changes.length ? { ...entity, body: after } : entity,
    changes,
    warnings: [],
    platformImpact: [],
  };
}
