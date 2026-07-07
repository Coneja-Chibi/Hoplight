/**
 * Extension-map & shallow-import platforms - editor-lens coverage for platforms that ride the generic
 * CCv2/v3 `extensions` bag (Lumiverse, Marinara, Chub, ...) or a closed site export (Character.AI,
 * Crushon, Janitor, Pygmalion) rather than shipping their own character adapter. They are lensable so a
 * creator can TARGET them and see which canonical fields carry; each platform's authored fields with no
 * canonical home ride escrow and are named in `escrowFields` for honest exposure. Merged into
 * /api/coverage. Grounded in the source-code / deep-web re-audit (design/EXTENSIONS-CENSUS.md).
 */
import type { CoverageEntry } from "../../core/coverage";

export interface ExtensionPlatform extends CoverageEntry {
  /** platform-specific authored fields with no canonical home yet (ride escrow), named for honesty */
  escrowFields?: string[];
}

export const EXTENSION_PLATFORMS: ExtensionPlatform[] = [
  {
    id: "pygmalion",
    label: "Pygmalion",
    carries: [
      "identity.name", "identity.description", "identity.characterVersion", "persona.personality",
      "persona.scenario", "prompts.systemPrompt", "prompts.postHistoryInstructions",
      "greetings.firstMessage", "greetings.alternateGreetings", "examples.exampleMessages",
      "discovery.tags", "attribution.creator", "attribution.creatorNotes", "worldName", "knowledgeRefs",
    ],
    escrowFields: ["pygmalion_id"],
  },
  {
    id: "lumiverse",
    label: "Lumiverse",
    carries: [
      "identity.name", "identity.description", "identity.characterVersion", "persona.personality",
      "persona.scenario", "prompts.systemPrompt", "prompts.postHistoryInstructions",
      "greetings.firstMessage", "greetings.alternateGreetings", "examples.exampleMessages",
      "discovery.tags", "attribution.creator", "attribution.creatorNotes", "knowledgeRefs",
      "behavior.regexScripts", "media.portrait", "media.assets", "media.sprite",
    ],
    escrowFields: [
      "expressions (label->sprite maps)", "expression_groups (multi-char)", "alternate_fields",
      "alternate_avatars", "world_books (bundled)", "entry.vectorized", "entry.group_override",
      "entry.automation_id",
    ],
  },
  {
    id: "marinara",
    label: "Marinara",
    carries: [
      "identity.name", "identity.description", "identity.characterVersion", "persona.personality",
      "persona.scenario", "persona.appearance", "prompts.systemPrompt", "prompts.postHistoryInstructions",
      "prompts.depthInjections", "greetings.firstMessage", "greetings.alternateGreetings",
      "examples.exampleMessages", "discovery.tags", "attribution.creator", "attribution.creatorNotes",
      "presentation.palette", "media.portrait", "media.sprite",
      "settings.talkativeness", "worldName", "knowledgeRefs",
    ],
    escrowFields: [
      "backstory", "rpgStats.enabled", "rpgStats.attributes[] (STR/DEX/...)", "rpgStats.hp {value,max}",
      "rpgStats.pools[] {name,value,max,color}",
    ],
  },
  {
    id: "chub",
    label: "Chub",
    carries: [
      "identity.name", "identity.tagline", "identity.description", "persona.personality",
      "persona.scenario", "greetings.firstMessage", "greetings.alternateGreetings",
      "examples.exampleMessages", "discovery.tags", "attribution.creator", "attribution.publicNote",
      "media.portrait", "media.assets", "presentation.background", "prompts.depthInjections",
      "knowledgeRefs",
    ],
    escrowFields: ["related_lorebooks", "custom_css", "full_path", "id", "expressions", "vectorized"],
  },
  {
    id: "characterai",
    label: "Character.AI",
    carries: [
      "identity.name", "identity.tagline", "identity.description", "persona.personality",
      "persona.voice", "persona.imagePrompt", "greetings.firstMessage", "discovery.tags",
      "media.portrait", "attribution.creator",
    ],
    escrowFields: ["starter_prompts", "visibility", "copyable", "img_gen_enabled", "songs"],
  },
  {
    id: "crushon",
    label: "Crushon",
    carries: [
      "identity.name", "identity.tagline", "identity.age", "persona.personality", "persona.scenario",
      "greetings.firstMessage", "examples.exampleMessages", "discovery.tags", "discovery.genre",
      "discovery.rating", "media.portrait", "presentation.background",
    ],
    escrowFields: ["gender", "visibility"],
  },
  {
    id: "janitor",
    label: "Janitor",
    carries: [
      "identity.name", "identity.nickname", "persona.personality", "persona.scenario",
      "greetings.firstMessage", "greetings.alternateGreetings", "examples.exampleMessages",
      "discovery.tags", "discovery.rating", "attribution.creator", "attribution.creatorNotes",
      "attribution.updatedAt", "media.portrait", "knowledgeRefs", "behavior.triggerScripts",
      "behavior.virtualScript",
    ],
    escrowFields: ["allow_proxy", "is_public", "definition_visibility", "advanced script (JS)"],
  },
];
