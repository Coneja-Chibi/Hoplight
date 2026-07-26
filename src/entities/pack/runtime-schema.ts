/** Strict runtime decoders for canonical expression-pack bodies. */
import { z } from "zod";
import type { SpritePackItem, SpritePackValue } from "../../core/media/pack";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import type { PackBody } from "./schema";

const itemShape = defineExhaustiveShape<SpritePackItem>()({
  id: z.string(),
  label: z.string(),
  ref: z.string(),
  mime: z.string().optional(),
});

export const spritePackItemSchema = z.strictObject(itemShape);

const spritePackShape = defineExhaustiveShape<SpritePackValue>()({
  enabled: z.boolean().optional(),
  defaultLabel: z.string().optional(),
  items: z.array(spritePackItemSchema),
});

export const spritePackSchema = z.strictObject(spritePackShape);

const bodyShape = defineExhaustiveShape<PackBody>()({
  name: z.string(),
  brief: z.string().optional(),
  pack: spritePackSchema,
  groups: z.record(z.string(), spritePackSchema).optional(),
});

export const packBodySchema = z.strictObject(bodyShape);
export const packProfileSchema = packBodySchema.partial();
