/**
 * Semantic capability for persona presentation, portrait, knowledge links, rating, and attribution.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import {
  mediaAssetSchema,
  nonEmptyPatch,
  swatchSchema,
} from "../../_shared/capability-schemas";
import type { CanonicalPersona } from "../schema";
import { previewPersonaPatch, targetSchema } from "./shared";

const patchSchema = nonEmptyPatch({
  signatureColor: z.string().nullable().optional(),
  colors: z.array(swatchSchema).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  portrait: mediaAssetSchema.nullable().optional(),
  knowledgeRefs: z.array(z.string()).nullable().optional(),
  rating: z.enum(["all-ages", "mature", "explicit"]).nullable().optional(),
  creator: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });
const paths: Record<string, string> = {
  signatureColor: "presentation.signatureColor",
  colors: "presentation.colors",
  imageUrl: "presentation.imageUrl",
  portrait: "media.portrait",
  knowledgeRefs: "knowledgeRefs",
  rating: "rating",
  creator: "attribution.creator",
  version: "attribution.version",
  createdAt: "attribution.createdAt",
  source: "attribution.source",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalPersona> = {
  id: "persona.presentation.update",
  kind: "persona",
  area: "presentation",
  action: "update",
  summary: "Change persona colors, portrait, lorebook links, rating, or attribution.",
  aliases: ["persona portrait", "persona palette", "persona lorebook", "persona creator"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `persona/${target.id}`,
  preview: (entity, { patch }) => previewPersonaPatch(entity, patch, paths),
};

export default capability;
