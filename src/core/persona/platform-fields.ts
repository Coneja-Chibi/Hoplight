/**
 * Which first-class persona fields each Write-for profile OWNS on a real wire, and which
 * INJECTION stops each profile's wire can carry (the position-picker law: per-platform truth
 * lives here, never a UI literal). Grounded in design/PERSONA-LANDSCAPE.md, engine by engine:
 *
 * - RoleCall (usePersonas.ts PersonaDetails + PersonaPanel.tsx): sections + custom order,
 *   traits, tagline/title, age, height, free-text pronouns, signature color + labeled palette,
 *   image, linked lorebook, rating, injection world/character/scene/depth + wrapper prefix.
 * - SillyTavern (personas.js): avatar-first (image), per-persona title (-> tagline), the five
 *   injection stops with depth+role, and a persona lorebook (-> knowledgeRefs). Description is
 *   flat `content`.
 * - Lumiverse (types/api.ts Persona): title (-> tagline), the pronoun TRIPLET (pronounSet),
 *   attached world book (-> knowledgeRefs), avatar path (-> imageUrl). Folders/is_narrator ride
 *   extras. No injection control exists on its wire - the picker hides under this lens.
 * - Marinara (types/persona.ts): comment (-> brief), structured sections (its five map onto
 *   ours partially; scenario + theming + stat bars ride SEALED extras), avatar (-> imageUrl).
 * - Agnai (structured-persona component): an attribute-map persona compiled to content; only
 *   the core keys show.
 */
import type { PersonaFieldKey, PersonaWriteForProfile } from "./capabilities";

/** Fields every profile always shows (portable floor). `brief` is the library blurb and is
 *  NEVER injected; `content` is the injected voice - the family's never-swap landmine. */
export const PERSONA_CORE_KEYS: readonly PersonaFieldKey[] = ["name", "brief", "content"];

export const PLATFORM_OWNED_EXTRAS: Record<PersonaWriteForProfile, readonly PersonaFieldKey[]> = {
  full: [
    "sections",
    "sectionOrder",
    "traits",
    "tagline",
    "age",
    "height",
    "pronouns",
    "pronounSet",
    "signatureColor",
    "colors",
    "imageUrl",
    "knowledgeRefs",
    "rating",
    "injection",
    "wrapper",
  ],
  rolecall: [
    "sections",
    "sectionOrder",
    "traits",
    "tagline",
    "age",
    "height",
    "pronouns",
    "signatureColor",
    "colors",
    "imageUrl",
    "knowledgeRefs",
    "rating",
    "injection",
    "wrapper",
  ],
  sillytavern: ["tagline", "imageUrl", "knowledgeRefs", "injection"],
  lumiverse: ["tagline", "pronounSet", "imageUrl", "knowledgeRefs"],
  marinara: ["sections", "imageUrl"],
  agnai: [],
};

/**
 * Injection stops (PersonaChatInjection.position) in canonical display order: RoleCall's four
 * first (the port spine's defaults), then SillyTavern's five. A profile listing NO stops hides
 * the injection picker entirely (deny by absence).
 */
export const PERSONA_ALL_INJECTIONS: readonly string[] = [
  "world",
  "character",
  "scene",
  "depth",
  "prompt",
  "author_note_top",
  "author_note_bottom",
  "in_chat",
  "none",
];

export const PERSONA_INJECTIONS_BY_PROFILE: Record<PersonaWriteForProfile, readonly string[]> = {
  full: PERSONA_ALL_INJECTIONS,
  rolecall: ["world", "character", "scene", "depth"],
  sillytavern: ["prompt", "author_note_top", "author_note_bottom", "in_chat", "none"],
  lumiverse: [],
  marinara: [],
  agnai: [],
};

/** Plain-language stop labels (RC's own picker copy for its four; ST's docs wording for five). */
export const PERSONA_INJECTION_LABELS: Record<string, { label: string; hint: string }> = {
  world: { label: "World", hint: "global context at the start" },
  character: { label: "Character", hint: "after the character description" },
  scene: { label: "Scene", hint: "within the current scene" },
  depth: { label: "Depth", hint: "at a specific message depth" },
  prompt: { label: "In prompt", hint: "with the main prompt" },
  author_note_top: { label: "Note top", hint: "top of the author's note" },
  author_note_bottom: { label: "Note bottom", hint: "bottom of the author's note" },
  in_chat: { label: "In chat", hint: "as a chat message at depth, with a role" },
  none: { label: "None", hint: "not injected at all" },
};

/** The stops this profile's wire carries, in canonical display order. */
export function injectionsForProfile(profile: PersonaWriteForProfile): readonly string[] {
  const owned = PERSONA_INJECTIONS_BY_PROFILE[profile] ?? PERSONA_ALL_INJECTIONS;
  return PERSONA_ALL_INJECTIONS.filter((p) => owned.includes(p));
}

/** Every key the union editor knows. */
export function allPersonaFieldKeys(): PersonaFieldKey[] {
  const set = new Set<PersonaFieldKey>(PERSONA_CORE_KEYS);
  for (const extras of Object.values(PLATFORM_OWNED_EXTRAS)) {
    for (const k of extras) set.add(k);
  }
  return [...set];
}

/** True if this profile's wire (or the full union) should expose the control. */
export function platformOwnsField(profile: PersonaWriteForProfile, key: PersonaFieldKey): boolean {
  if (PERSONA_CORE_KEYS.includes(key)) return true;
  if (profile === "full") return true;
  return (PLATFORM_OWNED_EXTRAS[profile] ?? []).includes(key);
}
