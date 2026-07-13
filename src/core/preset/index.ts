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
