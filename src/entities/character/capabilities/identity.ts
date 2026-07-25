/**
 * Semantic capability for portable character identity and casting-card facts.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalCharacter } from "../schema";
import { nonEmptyPatch, previewCharacterPatch, targetSchema } from "./shared";

const nullableText = z.string().nullable().optional();
const patchSchema = nonEmptyPatch({
  name: z.string().min(1).optional(),
  nickname: nullableText,
  tagline: nullableText,
  fullName: nullableText,
  title: nullableText,
  age: nullableText,
  pronouns: nullableText,
  culture: nullableText,
  characterVersion: nullableText,
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });

const paths: Record<string, string> = {
  name: "identity.name",
  nickname: "identity.nickname",
  tagline: "identity.tagline",
  fullName: "identity.fullName",
  title: "identity.title",
  age: "identity.age",
  pronouns: "identity.pronouns",
  culture: "identity.culture",
  characterVersion: "identity.characterVersion",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.identity.update",
  kind: "character",
  area: "identity",
  action: "update",
  summary: "Change a character's portable name, nickname, tagline, or casting-card identity facts.",
  aliases: ["rename character", "edit identity", "change pronouns", "casting card"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { target, patch }) =>
    previewCharacterPatch(entity, patch, paths, target.variantId),
};

export default capability;
