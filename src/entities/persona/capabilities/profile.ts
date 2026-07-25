/**
 * Semantic capability for structured persona sections, traits, order, and casting facts.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalPersona } from "../schema";
import { nonEmptyPatch, previewPersonaPatch, targetSchema } from "./shared";

const nullableText = z.string().nullable().optional();
const pronounSet = z.strictObject({
  subjective: z.string(),
  objective: z.string(),
  possessive: z.string(),
});
const patchSchema = nonEmptyPatch({
  appearance: nullableText,
  body: nullableText,
  personality: nullableText,
  quirks: nullableText,
  history: nullableText,
  sectionOrder: z.array(z.string()).nullable().optional(),
  traits: z.array(z.string()).nullable().optional(),
  tagline: nullableText,
  age: nullableText,
  height: nullableText,
  pronouns: nullableText,
  pronounSet: pronounSet.nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });
const paths: Record<string, string> = {
  appearance: "sections.appearance",
  body: "sections.body",
  personality: "sections.personality",
  quirks: "sections.quirks",
  history: "sections.history",
  sectionOrder: "sectionOrder",
  traits: "traits",
  tagline: "identity.tagline",
  age: "identity.age",
  height: "identity.height",
  pronouns: "identity.pronouns",
  pronounSet: "identity.pronounSet",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalPersona> = {
  id: "persona.profile.update",
  kind: "persona",
  area: "profile",
  action: "update",
  summary: "Change structured persona sections, traits, ordering, pronouns, or casting facts.",
  aliases: ["persona sections", "persona traits", "persona pronouns", "persona appearance"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `persona/${target.id}`,
  preview: (entity, { patch }) => previewPersonaPatch(entity, patch, paths),
};

export default capability;
