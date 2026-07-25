/** Shared strict target and preview helpers for preset capabilities. */
import { z } from "zod";
import type { CapabilityChange, CapabilityPreview } from "../../capabilities";
import type { CanonicalPreset } from "../schema";

export const targetSchema = z.strictObject({ id: z.string().min(1) });

export function presetPreview(
  before: CanonicalPreset,
  body: CanonicalPreset["body"],
  changes: readonly CapabilityChange[],
): CapabilityPreview<CanonicalPreset> {
  return {
    entity: changes.length ? { ...before, body } : before,
    changes,
    warnings: [],
    platformImpact: [],
  };
}
