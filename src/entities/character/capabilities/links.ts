/**
 * Semantic capability for character links to lorebooks and standalone behavior sets.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalCharacter } from "../schema";
import { nonEmptyPatch, previewCharacterPatch, targetSchema } from "./shared";

const patchSchema = nonEmptyPatch({
  worldName: z.string().nullable().optional(),
  knowledgeRefs: z.array(z.string().min(1)).nullable().optional(),
  behaviorRefs: z.array(z.string().min(1)).nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });
const paths: Record<string, string> = {
  worldName: "worldName",
  knowledgeRefs: "knowledgeRefs",
  behaviorRefs: "behaviorRefs",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.links.update",
  kind: "character",
  area: "links",
  action: "update",
  summary: "Change authored worldbook-by-name, canonical lorebook links, or standalone behavior links.",
  aliases: ["attach lorebook", "link regex", "character world", "behavior references"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { target, patch }) =>
    previewCharacterPatch(entity, patch, paths, target.variantId),
};

export default capability;
