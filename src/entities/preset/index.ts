/**
 * Preset entity barrel - the canonical preset shapes (PRESET-JEWEL-PLAN.md P0). Mirrors the regex
 * entity's barrel (the other set-of-items entity with an index.ts). Folders-as-schema: this is the
 * only import surface for the preset entity.
 */
export type {
  PromptRole,
  PromptPlacement,
  PresetPrompt,
  PresetGroup,
  PresetSamplers,
  PresetSystemPrompts,
  PresetTemplates,
  PresetBehavior,
  PresetApiOptions,
  PresetMedia,
  PresetGeneration,
  PresetChoiceType,
  PresetChoiceOption,
  PresetChoice,
  PresetBody,
  CanonicalPreset,
} from "./schema";
export { emptyPresetBody } from "./schema";
