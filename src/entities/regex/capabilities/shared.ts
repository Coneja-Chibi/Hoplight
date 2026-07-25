/** Shared target and receipt helper for standalone regex capabilities. */
import { z } from "zod";
import type { CapabilityChange, CapabilityPreview } from "../../capabilities";
import type { CanonicalRegexSet } from "../schema";

export const targetSchema = z.strictObject({ id: z.string().min(1) });
export const preview = (
  entity: CanonicalRegexSet,
  body: CanonicalRegexSet["body"],
  changes: readonly CapabilityChange[],
): CapabilityPreview<CanonicalRegexSet> => ({
  entity: { ...entity, body },
  changes,
  warnings: [],
  platformImpact: [],
});
