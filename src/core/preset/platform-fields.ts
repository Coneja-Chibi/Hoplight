/**
 * Which first-class preset controls each Write-for profile OWNS on a real authoring wire, and which
 * PLACEMENT stops each profile's blocks can carry (the position-picker law: per-platform truth lives
 * here, never a UI literal). Grounded engine by engine (docs/PRESET-JEWEL-PLAN.md, presets-core,
 * the verified Marinara export, RC's editor):
 *
 * - RoleCall (PresetSettingsSection + PromptListV4 + choice-groups.ts): the full settings surface
 *   (samplers/system/templates/behavior/api/media/generation), categories, ST-marker slots, the
 *   five placements, forbid-overrides, injection triggers, and the CHOICE-GROUPS walkthrough. No
 *   per-block XML wrap.
 * - SillyTavern (presets-core): the full settings surface, divider categories, marker slots,
 *   forbid-overrides, injection triggers - but only two placements (relative / in-chat) and NO
 *   walkthrough, NO per-block XML wrap.
 * - Marinara (verified TESTT.marinara.json): sections + nested groups, samplers (`parameters`),
 *   a slice of api-options, per-block XML wrap (`wrapInXml`), ST-style markers, and the
 *   CHOICE-BLOCKS walkthrough. No ST templates / full system-prompt set / media / generation.
 * - Lumiverse (primary clone, types/preset.ts + loom exportToSTPreset): category blocks one level
 *   deep, sampler overrides, behavior prompts, completion settings (api options + inline media),
 *   advanced settings (seed/stop strings -> generation), markers, injection + character-tag
 *   triggers, and two placements (its blocks are pre/post-history or in-history at depth). Its
 *   per-block promptVariables ride blocks, not a preset walkthrough, so no `choices`; its export
 *   always writes forbid_overrides false, so not authored; templates emit as fixed defaults.
 */
import type { PresetFieldKey, PresetWriteForProfile } from "./capabilities";

/** Controls every profile always shows (the portable floor: a preset has a name and blocks). */
export const PRESET_CORE_KEYS: readonly PresetFieldKey[] = ["name", "description", "prompts"];

export const PLATFORM_OWNED_EXTRAS: Record<PresetWriteForProfile, readonly PresetFieldKey[]> = {
  full: [
    "groups",
    "samplers",
    "systemPrompts",
    "templates",
    "behavior",
    "apiOptions",
    "media",
    "generation",
    "choices",
    "markers",
    "xmlWrap",
    "forbidOverrides",
    "injectionTrigger",
  ],
  rolecall: [
    "groups",
    "samplers",
    "systemPrompts",
    "templates",
    "behavior",
    "apiOptions",
    "media",
    "generation",
    "choices",
    "markers",
    "forbidOverrides",
    "injectionTrigger",
  ],
  sillytavern: [
    "groups",
    "samplers",
    "systemPrompts",
    "templates",
    "behavior",
    "apiOptions",
    "media",
    "generation",
    "markers",
    "forbidOverrides",
    "injectionTrigger",
  ],
  marinara: ["groups", "samplers", "apiOptions", "choices", "markers", "xmlWrap"],
  lumiverse: [
    "groups",
    "samplers",
    "behavior",
    "apiOptions",
    "media",
    "generation",
    "markers",
    "injectionTrigger",
  ],
};

/**
 * Placement stops (PresetPrompt.placement) in canonical display order. A profile listing only some
 * of these hides the rest of the placement rail under that lens (deny by absence); a stop set on
 * another platform's lens is kept, not carried (the persona/lore foreign-stop precedent, applied in
 * the editor at P4).
 */
export const PRESET_ALL_PLACEMENTS: readonly string[] = [
  "relative",
  "in_chat",
  "append",
  "append_preset",
  "prepend_preset",
];

export const PRESET_PLACEMENTS_BY_PROFILE: Record<PresetWriteForProfile, readonly string[]> = {
  full: PRESET_ALL_PLACEMENTS,
  rolecall: PRESET_ALL_PLACEMENTS,
  sillytavern: ["relative", "in_chat"],
  marinara: ["relative", "in_chat"],
  lumiverse: ["relative", "in_chat"],
};

/** Plain-language placement labels (RC's own picker copy). */
export const PRESET_PLACEMENT_LABELS: Record<string, { label: string; hint: string }> = {
  relative: { label: "Relative", hint: "in preset order" },
  in_chat: { label: "In-Chat", hint: "own message at depth" },
  append: { label: "Append", hint: "glue onto the message at depth" },
  append_preset: { label: "Append Preset", hint: "very bottom of the preset" },
  prepend_preset: { label: "Prepend Preset", hint: "very top of the preset" },
};

/** The placement stops this profile's wire carries, in canonical display order. */
export function placementsForProfile(profile: PresetWriteForProfile): readonly string[] {
  const owned = PRESET_PLACEMENTS_BY_PROFILE[profile] ?? PRESET_ALL_PLACEMENTS;
  return PRESET_ALL_PLACEMENTS.filter((p) => owned.includes(p));
}

/** Every control key the union editor knows. */
export function allPresetFieldKeys(): PresetFieldKey[] {
  const set = new Set<PresetFieldKey>(PRESET_CORE_KEYS);
  for (const extras of Object.values(PLATFORM_OWNED_EXTRAS)) {
    for (const k of extras) set.add(k);
  }
  return [...set];
}

/** True if this profile's wire (or the full union) should expose the control. */
export function platformOwnsField(profile: PresetWriteForProfile, key: PresetFieldKey): boolean {
  if (PRESET_CORE_KEYS.includes(key)) return true;
  if (profile === "full") return true;
  return (PLATFORM_OWNED_EXTRAS[profile] ?? []).includes(key);
}
