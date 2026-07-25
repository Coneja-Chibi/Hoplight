/** Shared target and receipt helper for pack capabilities. */
import { z } from "zod";
import type { CapabilityChange, CapabilityPreview } from "../../capabilities";
import type { CanonicalPack } from "../schema";

export const targetSchema = z.strictObject({
  id: z.string().min(1),
  groupId: z.string().min(1).optional(),
});
export const preview = (
  entity: CanonicalPack,
  body: CanonicalPack["body"],
  changes: readonly CapabilityChange[],
): CapabilityPreview<CanonicalPack> => ({
  entity: { ...entity, body },
  changes,
  warnings: [],
  platformImpact: [],
});
