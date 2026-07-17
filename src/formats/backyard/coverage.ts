/**
 * Legacy Backyard flat-JSON coverage - only paths the legacy adapter maps.
 * BYAF media/alts/rating live on the separate `byaf` adapter (byaf-coverage.ts).
 * Inflating this list lied to the lens the same way inflated Pyg coverage did.
 */
import type { CoverageDecl } from "../../core/coverage";

const coverage: CoverageDecl = {
  carries: [
    "identity.name",
    "identity.nickname",
    "identity.description",
    "identity.characterVersion",
    "persona.personality",
    "persona.scenario",
    "prompts.systemPrompt",
    "greetings.firstMessage",
    "examples.exampleMessages",
    "attribution.creator",
    "discovery.tags",
  ],
  notes: {
    "identity.nickname": "aiName when it differs from aiDisplayName / name",
    "identity.description": "aiPersona (aliases: description, persona)",
    "examples.exampleMessages": "customDialogue (aliases: examples, mes_example)",
    placeholders:
      "Wire uses single-brace {character}/{user}; unedited fields re-emit raw; edits re-encode lossily",
  },
};

export default coverage;
