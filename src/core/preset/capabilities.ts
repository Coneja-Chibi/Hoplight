/**
 * Preset Write-for profiles: which first-class controls the editor shows under each lens. Full =
 * union of every authoring wire; other profiles hide only what that platform cannot serialize;
 * hiding never deletes body data. Same shape + function names as core/persona and core/regex
 * capabilities. Ownership matrix: platform-fields.ts (survey-grounded).
 *
 * The Lumiverse lens is grounded in its upstream engine rather than secondhand import behavior:
 * - The app's own preset export is FLAT ST GRAMMAR (frontend loom service, exportToSTPreset), with
 *   category blocks, marker mapping, and `lumiverse_character_tag_trigger` on triggered prompts.
 *   The `{type:"lumiverse_preset"}` wrapper is what LumiHub serves; the app reads both. So our
 *   sillytavern-shaped emit is exactly what Lumiverse itself round-trips.
 * - Ownership facts for platform-fields.ts come from its Preset assembly types (PromptBlock,
 *   PromptBehavior, CompletionSettings, SamplerOverrides, AdvancedSettings): categories one level
 *   deep, in-history depth placement, behavior prompts, sampler overrides, inline media, triggers.
 *   Its per-block promptVariables system is real but rides BLOCKS, not a preset-level walkthrough,
 *   so the `choices` control stays off this lens (the import codec maps them to guarded setvar
 *   prompts instead).
 * - The macro dialect lives in src/macros (lexer/parser/registry, 239 definitions); the catalog in
 *   ./macros/lumiverse.ts is registry-dumped and source-pinned (VAUD_LUMI_MACRO_SRC).
 *
 * The authoring targets are the engines vaud can really serialize: RoleCall (native), SillyTavern
 * (round-trip), Marinara (sealed round-trip), Lumiverse (ST-grammar round-trip, its own app's
 * export shape).
 */
import { platformOwnsField } from "./platform-fields";

export type PresetWriteForProfile =
  | "full"
  | "rolecall"
  | "sillytavern"
  | "marinara"
  | "lumiverse";

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
  full: "Hoplight",
  rolecall: "RoleCall",
  sillytavern: "SillyTavern",
  marinara: "Marinara",
  lumiverse: "Lumiverse",
};

export const PRESET_WRITE_FOR_PROFILES: readonly PresetWriteForProfile[] = [
  "full",
  "rolecall",
  "sillytavern",
  "marinara",
  "lumiverse",
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
