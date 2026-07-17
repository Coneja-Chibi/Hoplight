/**
 * Pure preset capabilities + machinery (PRESET-JEWEL-PLAN.md P0+). The assembly/build engine lands
 * in P2; folders-as-schema: this barrel is the only import surface for core/preset.
 */
export {
  fieldVisibility,
  parseWriteFor,
  PRESET_WRITE_FOR_LABELS,
  PRESET_WRITE_FOR_PROFILES,
} from "./capabilities";
export type { FieldVisibility, PresetFieldKey, PresetWriteForProfile } from "./capabilities";
export {
  allPresetFieldKeys,
  placementsForProfile,
  platformOwnsField,
  PRESET_ALL_PLACEMENTS,
  PRESET_CORE_KEYS,
  PRESET_PLACEMENT_LABELS,
  PRESET_PLACEMENTS_BY_PROFILE,
} from "./platform-fields";
export { blockTokens, buildPreview, markerLabel, MARKER_LABELS, presetWeight } from "./build";
export type { PresetBuild, PresetBuildLine, PresetWeight } from "./build";
export {
  filterByTab,
  promptCounts,
  promptMatchesSearch,
  PROMPT_FILTER_LABELS,
  PROMPT_FILTER_TABS,
  visiblePrompts,
} from "./list-view";
export type { PromptCounts, PromptFilterTab } from "./list-view";
export {
  findMacro,
  isMacroSupported,
  macroName,
  macroSupport,
  scanMacroTokens,
  supportedMacroNames,
  unsupportedIn,
} from "./macros/support";
export {
  macroGroupsForProfile,
  MARINARA_MACRO_GROUPS,
  ROLECALL_MACRO_GROUPS,
  SILLYTAVERN_MACRO_GROUPS,
} from "./macros";
export type { MacroEntry, MacroGroup } from "./macros";
