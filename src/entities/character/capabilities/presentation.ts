/**
 * Semantic capability for portable casting-card presentation fields.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import { swatchSchema } from "../../_shared/capability-schemas";
import type { CanonicalCharacter } from "../schema";
import { nonEmptyPatch, previewCharacterPatch, targetSchema } from "./shared";

const background = z.strictObject({
  ref: z.string().min(1),
  overlayOpacity: z.number().min(0).max(1).optional(),
  videoPlaybackRate: z.number().positive().optional(),
});
const spoilers = z.strictObject({
  mode: z.string().optional(),
  order: z.array(z.string()).optional(),
  fields: z.record(z.string(), z.boolean()).optional(),
});
const patchSchema = nonEmptyPatch({
  signatureColor: z.string().nullable().optional(),
  gradientColors: z.array(z.string()).nullable().optional(),
  palette: z.array(swatchSchema).nullable().optional(),
  background: background.nullable().optional(),
  fieldOrder: z.array(z.string()).nullable().optional(),
  spoilers: spoilers.nullable().optional(),
  mediaLinks: z.array(z.string()).nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });
const paths: Record<string, string> = {
  signatureColor: "presentation.signatureColor",
  gradientColors: "presentation.gradientColors",
  palette: "presentation.palette",
  background: "presentation.background",
  fieldOrder: "presentation.fieldOrder",
  spoilers: "presentation.spoilers",
  mediaLinks: "presentation.mediaLinks",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.presentation.update",
  kind: "character",
  area: "presentation",
  action: "update",
  summary: "Change signature colors, palette, background, field order, spoilers, or media links.",
  aliases: ["character colors", "casting card layout", "character background", "spoilers"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { target, patch }) =>
    previewCharacterPatch(entity, patch, paths, target.variantId),
};

export default capability;
