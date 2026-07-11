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
    // Still NOT behavior.regexScripts or behaviorRefs (REGEX-JEWEL-PLAN.md R1, 2026-07-11): the
    // archive's regex_scripts[] now decodes losslessly through a real typed codec
    // (formats/lumiverse/regex.ts, RegexRule round-trip) instead of an opaque unknown[] blob, but
    // it still lands as NATIVE data at extensions._lumiverse_modules_regex_scripts - this adapter
    // (index.ts) never lifts it onto a canonical body field, so claiming carries coverage here
    // would still be drift. Wiring a canonical ref is separate follow-up work.
    "media.portrait",
    "media.assets",
    "media.sprite",
  ],
  notes: {
    "media.assets": "expression / alt-avatar images when modules or data URIs hydrate",
    native:
      "expressions, expression_groups, alternate_*, lumiverse_image_gen_lora, ttsVoice, world_book_ids, regex_scripts (typed via formats/lumiverse/regex.ts) on original.sillytavern.raw.data.extensions",
  },
};

export default coverage;
