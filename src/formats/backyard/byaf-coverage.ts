/**
 * BYAF (Backyard Archive Format) coverage - character + primary scenario authored content.
 * Sampling / promptTemplate / grammar / chat transcript stay on original (not portable body).
 */
import type { CoverageDecl } from "../../core/coverage";

const coverage: CoverageDecl = {
  carries: [
    "identity.name",
    "identity.nickname",
    "identity.description",
    "persona.scenario",
    "prompts.systemPrompt",
    "greetings.firstMessage",
    "greetings.alternateGreetings",
    "examples.exampleMessages",
    "discovery.rating",
    "attribution.creator",
    "attribution.sourceUrl",
    "attribution.createdAt",
    "attribution.updatedAt",
    "media.portrait",
    "media.assets",
    "presentation.background",
  ],
  notes: {
    "identity.nickname": "byaf character.name ({{char}} short); displayName is identity.name",
    "identity.description": "byaf character.persona",
    "persona.scenario": "primary scenario.narrative",
    "prompts.systemPrompt": "scenario.formattingInstructions",
    "greetings.alternateGreetings":
      "untitled alts = extra primary firstMessages; titled alts = secondary scenarios (match twin by title or create)",
    "discovery.rating": "character.isNSFW -> explicit | all-ages",
    "media.portrait": "images[] entry labeled avatar (or first image)",
    "presentation.background": "scenario.backgroundImage path as asset ref when present",
    loreItems: "flat key/value lore rides original until lore content-type maps it",
    sampling: "temperature/topP/minP/promptTemplate/grammar/messages ride original only",
  },
};

export default coverage;
