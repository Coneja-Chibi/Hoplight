/**
 * Preset Write-for profiles: which first-class controls the editor shows under each lens. Full =
 * union of every authoring wire; other profiles hide only what that platform cannot serialize;
 * hiding never deletes body data. Same shape + function names as core/persona and core/regex
 * capabilities (PRESET-JEWEL-PLAN.md P0). Ownership matrix: platform-fields.ts (survey-grounded).
 *
 * LUMIVERSE IS NOT A LENS *YET*, AND THE OLD REASON HERE WAS WRONG. This used to claim there is
 * "nothing to author for Lumiverse" because the codec is import-only. That is a fact about OUR
 * code, not about Lumiverse, and it was laundered from a draft spec whose only cited reference is
 * RC's `packages/presets-core/src/lumiverse-converter.ts` - which exports exactly
 * isLumiversePreset() + convertLumiversePreset() and no serializer. "RC never wrote an exporter"
 * became "the platform cannot be authored for". It cannot support that weight.
 *
 * What the evidence actually shows: Lumiverse ships a clean, writable block-based JSON wrapper
 * ({type, schemaVersion, cover_url, preset:{blocks[], promptBehavior, completionSettings,
 * samplerOverrides, advancedSettings}}), its own {{...}} macro dialect ({{if::}}, {{rcounter}},
 * group-card macros, lumia tokens) that RC implements in apps/rc/src/lib/macros/handlers/
 * lumiverse-compat.ts, and a macro engine that LumiRealm's risu-macros.json records colliding with
 * Risu on 36 names, 28 of them behaviourally INCOMPATIBLE. Nothing there blocks a serialize path.
 *
 * So Lumiverse is absent because the export codec is UNBUILT, not because it is unauthorable. Do
 * not re-justify it on capability. Before promoting it to a lens, get primary sources - the
 * Lumiverse app is NOT among the local clones (_reference/ has LumiRealm, which is a RisuAI compat
 * PORT for Lumiverse by another author, not Lumiverse itself) and RC's wrapper types are marked
 * "as observed in the wild", i.e. reverse-engineered.
 *
 * The current authoring targets are the engines vaud can really serialize: RoleCall (native),
 * SillyTavern (round-trip), Marinara (sealed round-trip).
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
