/**
 * Risu character coverage - the lens's ground truth for the Risu tab (vs-editor-2). Risu's .charx
 * rides the CCv3 core and adds authored behavior (scripts as data), bias, voice/image-gen config
 * and the risu settings group (audited against this folder's index + risu-fields mapping).
 * Claims-vs-round-trip harness: tracked follow-up.
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
    "persona.voice",
    "persona.imagePrompt",
    "greetings",
    "examples",
    "prompts.systemPrompt",
    "prompts.postHistoryInstructions",
    "prompts.additionalText",
    "attribution.creator",
    "attribution.creatorNotes",
    "attribution.license",
    "attribution.createdAt",
    "attribution.updatedAt",
    "discovery.tags",
    "media.portrait",
    "media.assets",
    "settings.risu",
    "behavior",
    "bias",
    "knowledgeRefs",
  ],
  notes: {
    behavior: "scripts ride as DATA (regex/trigger/virtual); never executed here",
  },
};

export default coverage;
