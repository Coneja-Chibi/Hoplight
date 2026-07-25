/**
 * Semantic capability for character discovery and creator attribution metadata.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalCharacter } from "../schema";
import { nonEmptyPatch, previewCharacterPatch, targetSchema } from "./shared";

const text = z.string().nullable().optional();
const list = z.array(z.string()).nullable().optional();
const patchSchema = nonEmptyPatch({
  tags: list,
  genre: text,
  fandom: text,
  rating: z.enum(["all-ages", "mature", "explicit"]).nullable().optional(),
  contentWarnings: list,
  creator: text,
  originalCreator: text,
  sourceUrl: text,
  license: text,
  creatorNotes: text,
  publicNote: text,
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });

const paths: Record<string, string> = {
  tags: "discovery.tags",
  genre: "discovery.genre",
  fandom: "discovery.fandom",
  rating: "discovery.rating",
  contentWarnings: "discovery.contentWarnings",
  creator: "attribution.creator",
  originalCreator: "attribution.originalCreator",
  sourceUrl: "attribution.sourceUrl",
  license: "attribution.license",
  creatorNotes: "attribution.creatorNotes",
  publicNote: "attribution.publicNote",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.metadata.update",
  kind: "character",
  area: "metadata",
  action: "update",
  summary: "Change portable discovery tags, rating, content warnings, creator, license, or notes.",
  aliases: ["tag character", "content rating", "creator notes", "character metadata"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { target, patch }) =>
    previewCharacterPatch(entity, patch, paths, target.variantId),
};

export default capability;
