/**
 * Lumiverse coverage - ST core + media when modules hydrate assets. Native extras are original paths.
 */
import type { CoverageDecl } from "../../core/coverage";

const coverage: CoverageDecl = {
  carries: [
    "identity.name",
    "identity.description",
    "identity.characterVersion",
    "persona.personality",
    "persona.scenario",
    "prompts.systemPrompt",
    "prompts.postHistoryInstructions",
    "greetings.firstMessage",
    "greetings.alternateGreetings",
    "examples.exampleMessages",
    "discovery.tags",
    "attribution.creator",
    "attribution.creatorNotes",
    "knowledgeRefs",
    // NOT behavior.regexScripts: archive regex_scripts[] stays sealed in
    // extensions._lumiverse_modules_regex_scripts - no canonical mapping exists yet
    // (design/REGEX-FORMATS.md); claiming coverage the codec does not deliver is drift.
    "media.portrait",
    "media.assets",
    "media.sprite",
  ],
  notes: {
    "media.assets": "expression / alt-avatar images when modules or data URIs hydrate",
    native:
      "expressions, expression_groups, alternate_*, lumiverse_image_gen_lora, ttsVoice, world_book_ids on original.sillytavern.raw.data.extensions",
  },
};

export default coverage;
