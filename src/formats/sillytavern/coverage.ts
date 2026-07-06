/**
 * SillyTavern character coverage - the lens's ground truth for the ST tab (vs-editor-2).
 * Audited against the family's real mapping surface (_shared/tavern-fields.ts dataToBody /
 * applyBodyToData plus index-level assetsToMedia, character_book embed, extensions.world and
 * talkativeness). The mechanical claims-vs-round-trip harness is tracked follow-up work.
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
    "greetings",
    "examples",
    "prompts.systemPrompt",
    "prompts.postHistoryInstructions",
    "prompts.depthInjections",
    "attribution.creator",
    "attribution.creatorNotes",
    "attribution.creatorNotesMultilingual",
    "attribution.source",
    "attribution.createdAt",
    "attribution.updatedAt",
    "discovery.tags",
    "media.portrait",
    "media.assets",
    "settings.talkativeness",
    "worldName",
    "knowledgeRefs",
  ],
  notes: {
    "greetings.groupOnlyGreetings": "CCv3 only; a V2 export drops them",
    "attribution.creatorNotesMultilingual": "CCv3 only",
  },
};

export default coverage;
