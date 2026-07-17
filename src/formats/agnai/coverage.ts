/**
 * Agnai character coverage - the lens's ground truth for the Agnai tab. Audited against the real
 * adapter mapping (index.ts cardToBody / applyBodyToCard, readVoice/readSprite/readImagePrompt) and
 * agnai.md. Agnai is the sole/lead producer of structured persona (W++/attributes), appearance,
 * sprite recipe, voice, and image-prompt affixes; sampler knobs + library state ride original.
 */
import type { CoverageDecl } from "../../core/coverage";

const coverage: CoverageDecl = {
  carries: [
    "identity.name",
    "identity.description",
    "identity.characterVersion",
    "identity.culture",
    "persona.personality",
    "persona.scenario",
    "persona.appearance",
    "persona.structured",
    "persona.voice",
    "persona.imagePrompt",
    "prompts.systemPrompt",
    "prompts.postHistoryInstructions",
    "prompts.prefill",
    "prompts.depthInjections",
    "greetings.firstMessage",
    "greetings.alternateGreetings",
    "examples.exampleMessages",
    "discovery.tags",
    "attribution.creator",
    // createdAt/updatedAt ride original only (adapter does not map them to body)
    "media.portrait",
    "media.sprite",
    "media.visualKind",
    "settings.responseSchema",
    "knowledgeRefs",
  ],
  notes: {
    "persona.structured": "the Agnai core: {kind: boostyle|wpp|sbf|attributes|text, attributes}; a text persona folds into personality",
    "prompts.depthInjections": "one fixed-depth slot (insert); only depthInjections[0] re-encodes, no role/origin",
    "persona.imagePrompt": "authored affixes only; sampler/provider knobs stay on the original twin",
    "knowledgeRefs": "carried as a relation via the embedded MemoryBook, linked by the bundle layer",
  },
};

export default coverage;
