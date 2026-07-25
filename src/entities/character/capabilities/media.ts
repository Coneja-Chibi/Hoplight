/**
 * Semantic capability for character portrait and named media references.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import { mediaAssetSchema } from "../../_shared/capability-schemas";
import type { CanonicalCharacter } from "../schema";
import { nonEmptyPatch, previewCharacterPatch, targetSchema } from "./shared";

const patchSchema = nonEmptyPatch({
  portrait: mediaAssetSchema.nullable().optional(),
  assets: z.array(mediaAssetSchema).nullable().optional(),
  visualKind: z.string().nullable().optional(),
  faceLabel: z.string().nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });
const paths: Record<string, string> = {
  portrait: "media.portrait",
  assets: "media.assets",
  visualKind: "media.visualKind",
  faceLabel: "media.faceLabel",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.media.update",
  kind: "character",
  area: "media",
  action: "update",
  summary: "Change the canonical portrait, media asset references, visual mode, or preferred face.",
  aliases: ["character portrait", "sprites", "emotion images", "media pack"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { target, patch }) =>
    previewCharacterPatch(entity, patch, paths, target.variantId),
};

export default capability;
