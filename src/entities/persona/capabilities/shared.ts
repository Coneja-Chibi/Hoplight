/**
 * Persona capability helpers for strict targets and exact canonical preview rows.
 */
import { z } from "zod";
import type { CapabilityChange, CapabilityPreview } from "../../capabilities";
import { nonEmptyPatch } from "../../_shared/capability-schemas";
import { readEntityPath, writeEntityPath } from "../../_shared/path-operations";
import type { CanonicalPersona, PersonaBody } from "../schema";

export const targetSchema = z.strictObject({
  id: z.string().min(1).describe("the persona piece id"),
});
export { nonEmptyPatch };

const equal = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export function previewPersonaPatch(
  entity: CanonicalPersona,
  patch: Readonly<Record<string, unknown>>,
  paths: Readonly<Record<string, string>>,
): CapabilityPreview<CanonicalPersona> {
  const before = entity.body as unknown as Record<string, unknown>;
  let after = before;
  for (const [field, value] of Object.entries(patch)) {
    const path = paths[field];
    if (path) {
      after = writeEntityPath(after, path, value === null ? undefined : value, (next) => next === undefined);
    }
  }
  const changes: CapabilityChange[] = [];
  for (const field of Object.keys(patch)) {
    const path = paths[field];
    if (!path) continue;
    const prior = readEntityPath(before, path);
    const next = readEntityPath(after, path);
    if (!equal(prior, next)) {
      changes.push({ path: `body.${path}`, label: field, before: prior, after: next });
    }
  }
  return {
    entity: changes.length
      ? { ...entity, body: after as unknown as PersonaBody }
      : entity,
    changes,
    warnings: [],
    platformImpact: [],
  };
}
