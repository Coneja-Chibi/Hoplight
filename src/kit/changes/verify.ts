/**
 * Post-save verification for a capability draft, excluding only Studio-owned timestamp metadata.
 */
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";

const jsonEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const withoutStudioMetadata = (
  entity: ParsedCanonicalEntity,
): ParsedCanonicalEntity => {
  const original = { ...(entity.original ?? {}) };
  delete original["vaud-studio"];
  return { ...entity, original };
};

/** Verify every capability-owned canonical field and non-Studio escrow after persistence. */
export function verifySavedEntity(
  proposed: ParsedCanonicalEntity,
  saved: ParsedCanonicalEntity,
): boolean {
  return jsonEqual(
    withoutStudioMetadata(proposed),
    withoutStudioMetadata(saved),
  );
}
