/**
 * Backyard AI (Faraday) coverage - the lens's ground truth for the Backyard tab. Audited from the
 * BYAF v1 archive shape (scenario.json + character.json). Backyard is a local desktop app; its
 * sampling block, prompt template, GBNF grammar, model id, and per-image labels are platform/preset
 * state and ride escrow (a future Preset entity), not portable character content.
 */
import type { CoverageDecl } from "../../core/coverage";

const coverage: CoverageDecl = {
  carries: [
    "identity.name",
    "identity.fullName",
    "persona.personality",
    "persona.scenario",
    "prompts.systemPrompt",
    "greetings.firstMessage",
    "examples.exampleMessages",
    "discovery.rating",
    "attribution.creator",
    "attribution.sourceUrl",
    "attribution.createdAt",
    "attribution.updatedAt",
    "media.portrait",
    "media.assets",
    "presentation.background",
    "knowledgeRefs",
  ],
  notes: {
    "discovery.rating": "from the byaf isNSFW boolean, folded into the 3-value rating",
    "media.assets": "byaf labeled images[]; the label survives, sampler/model state rides escrow",
    "knowledgeRefs": "byaf loreItems become a linked lorebook via the bundle layer",
  },
};

export default coverage;
