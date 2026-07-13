/**
 * Preset Write-for profiles: which first-class controls the editor shows under each lens. Full =
 * union of every authoring wire; other profiles hide only what that platform cannot serialize;
 * hiding never deletes body data. Same shape + function names as core/persona and core/regex
 * capabilities (PRESET-JEWEL-PLAN.md P0). Ownership matrix: platform-fields.ts (survey-grounded).
 *
 * LUMIVERSE IS NOT A LENS: its preset codec is one-way IMPORT (parse the wrapper into the ST shape,
 * no serialize-back - specs/formats/lumiverse-preset.md). A Write-for lens gates by EXPORT
 * capability, so there is nothing to author "for Lumiverse"; imported Lumi presets are edited under
 * the SillyTavern (or full) lens. The authoring targets are the engines with a real serialize path:
 * RoleCall (native), SillyTavern (round-trip), Marinara (sealed round-trip).
 */
import { platformOwnsField } from "./platform-fields";

export type PresetWriteForProfile =
  | "full"
  | "rolecall"
  | "sillytavern"
  | "marinara";

export type FieldVisibility = "show" | "hide";

/**
 * Editor-facing control keys. Every key gates a first-class PresetBody slot or block feature.
 * Survey-grounded: if a real authoring wire carries it, it lives here.
 */
export type PresetFieldKey =
  | "name"
  | "description"
  | "prompts"
  | "groups"
  | "samplers"
  | "systemPrompts"
  | "templates"
  | "behavior"
  | "apiOptions"
  | "media"
  | "generation"
  | "choices"
  | "markers"
  | "xmlWrap"
  | "forbidOverrides"
  | "injectionTrigger";

/** Platform lens labels (ONE platform per lens, never smushed - the lore/regex/persona precedent). */
export const PRESET_WRITE_FOR_LABELS: Record<PresetWriteForProfile, string> = {
  full: "Vaude",
  rolecall: "RoleCall",
  sillytavern: "SillyTavern",
  marinara: "Marinara",
};

export const PRESET_WRITE_FOR_PROFILES: readonly PresetWriteForProfile[] = [
  "full",
  "rolecall",
  "sillytavern",
  "marinara",
];

/** Tolerant pref reader: anything unknown falls back to full (never throws). */
export function parseWriteFor(v: unknown): PresetWriteForProfile {
  return typeof v === "string" &&
    (PRESET_WRITE_FOR_PROFILES as readonly string[]).includes(v)
    ? (v as PresetWriteForProfile)
    : "full";
}

/** Show/hide for one control under one lens (delegates to the ownership matrix). */
export function fieldVisibility(
  profile: PresetWriteForProfile,
  key: PresetFieldKey,
): FieldVisibility {
  return platformOwnsField(profile, key) ? "show" : "hide";
}
