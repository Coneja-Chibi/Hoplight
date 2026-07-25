/**
 * Semantic capability for character persona, prompt, and example-text slots.
 */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import type { CanonicalCharacter } from "../schema";
import { nonEmptyPatch, previewCharacterPatch, targetSchema } from "./shared";

const text = z.string().nullable().optional();
const patchSchema = nonEmptyPatch({
  description: text,
  personality: text,
  scenario: text,
  appearance: text,
  systemPrompt: text,
  postHistoryInstructions: text,
  prefill: text,
  additionalText: text,
  exampleMessages: text,
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });

const paths: Record<string, string> = {
  description: "identity.description",
  personality: "persona.personality",
  scenario: "persona.scenario",
  appearance: "persona.appearance",
  systemPrompt: "prompts.systemPrompt",
  postHistoryInstructions: "prompts.postHistoryInstructions",
  prefill: "prompts.prefill",
  additionalText: "prompts.additionalText",
  exampleMessages: "examples.exampleMessages",
};

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.prompts.update",
  kind: "character",
  area: "prompts",
  action: "update",
  summary: "Change portable character description, persona, scenario, system instructions, or examples.",
  aliases: ["edit character prompt", "change personality", "update scenario", "system prompt"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { target, patch }) =>
    previewCharacterPatch(entity, patch, paths, target.variantId),
};

export default capability;
