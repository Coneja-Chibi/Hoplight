/**
 * Semantic capability for first, alternate, and group-only character greetings.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalCharacter } from "../schema";
import { nonEmptyPatch, previewCharacterPatch, targetSchema } from "./shared";

const greeting = z.strictObject({
  text: z.string(),
  title: z.string().optional(),
  id: z.string().optional(),
});
const patchSchema = nonEmptyPatch({
  firstMessage: z.string().nullable().optional(),
  alternateGreetings: z.array(greeting).nullable().optional(),
  groupOnlyGreetings: z.array(greeting).nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });
const paths: Record<string, string> = {
  firstMessage: "greetings.firstMessage",
  alternateGreetings: "greetings.alternateGreetings",
  groupOnlyGreetings: "greetings.groupOnlyGreetings",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.greetings.update",
  kind: "character",
  area: "greetings",
  action: "update",
  summary: "Change the first message or replace authored alternate and group-only greeting lists.",
  aliases: ["edit greeting", "alternate greetings", "first message", "group greeting"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { target, patch }) =>
    previewCharacterPatch(entity, patch, paths, target.variantId),
};

export default capability;
