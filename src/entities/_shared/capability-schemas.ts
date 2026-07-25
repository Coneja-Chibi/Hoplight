/**
 * Reusable strict Zod shapes for canonical values shared across semantic capability bundles.
 */
import { z } from "zod";

export const mediaAssetSchema = z.strictObject({
  role: z.enum(["portrait", "emotion", "outfit", "pose", "background", "other"]),
  ref: z.string().min(1),
  name: z.string().optional(),
  label: z.string().optional(),
  primary: z.boolean().optional(),
  mime: z.string().optional(),
});

export const swatchSchema = z.strictObject({
  label: z.string().optional(),
  name: z.string().optional(),
  hex: z.string().min(1),
});

export const nonEmptyPatch = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.strictObject(shape).refine((patch) => Object.keys(patch).length > 0, {
    message: "at least one field must change",
  });
