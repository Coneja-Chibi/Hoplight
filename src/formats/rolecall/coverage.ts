/**
 * RoleCall character coverage - the lens's ground truth for the RC tab (vs-editor-2). RC rides the
 * shared Tavern core and adds the casting card, presentation layer and richer discovery/attribution
 * (audited against this folder's index mapping). Claims-vs-round-trip harness: tracked follow-up.
 */
import type { CoverageDecl } from "../../core/coverage";

const coverage: CoverageDecl = {
  carries: [
    "identity.name",
    "identity.description",
    "identity.characterVersion",
    "identity.tagline",
    "identity.fullName",
    "identity.title",
    "identity.age",
    "identity.pronouns",
    "persona.personality",
    "persona.scenario",
    "greetings",
    "examples",
    "prompts.systemPrompt",
    "prompts.postHistoryInstructions",
    "prompts.depthInjections",
    "attribution",
    "discovery",
    "presentation",
    "media.portrait",
    "media.assets",
    "knowledgeRefs",
  ],
  notes: {
    "greetings.alternateGreetings": "greeting TITLES survive (alternate_greeting_titles)",
    presentation: "casting card: palette, gradient colors, background, field order, spoilers",
  },
};

export default coverage;
