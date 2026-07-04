import type { CanonicalEntity } from "../../core/canonical";

/**
 * CanonicalCharacter - the character entity schema. Seeded from RoleCall + SillyTavern + Risu,
 * widened by the format deep-dive (see design/FORMATS-LANDSCAPE.md). Only fields a real now-tier
 * format actually produces are first-classed here; everything else rides in escrow.
 *
 * This folder IS the character entity. Drop a sibling folder in src/entities/ to add a new
 * content type (lorebook, preset, persona, regex) the same way.
 */

export interface Identity {
  name: string;
  /** {{char}} override that does NOT change the canonical name (Risu/Backyard aiName, CCv3 nickname) */
  nickname?: string;
  /** short one-liner / creator comment */
  tagline?: string;
  /** the main character description / persona block (CCv2/v3 `description`) */
  description?: string;
  characterVersion?: string;
}

export interface Persona {
  personality?: string;
  scenario?: string;
  /** Agnai-only free-text physical description (image-gen); other formats fold it into description */
  appearance?: string;
  /**
   * structured persona encoding (Agnai persona.kind + attributes); preserves W++/attribute maps.
   * Discriminated so illegal states are unrepresentable: plain "text" carries no attributes;
   * every attribute-map kind requires its attributes.
   */
  structured?:
    | { kind: "text" }
    | { kind: "attributes" | "wpp" | "sbf" | "boostyle"; attributes: Record<string, string[]> };
}

export interface DepthInjection {
  text: string;
  depth: number;
  role?: "system" | "user" | "assistant";
  /** which source mechanism produced this, so it re-emits to its original home on export */
  origin?: "depth_prompt" | "rolecall_details" | "worldinfo";
  /** creator toggle; undefined = enabled */
  enabled?: boolean;
}

export interface Prompts {
  systemPrompt?: string;
  /** the "jailbreak" / post-history slot in SillyTavern */
  postHistoryInstructions?: string;
  depthInjections?: DepthInjection[];
  /** assistant-response prefill, prepended to the model reply (Agnai; common with Claude) */
  prefill?: string;
}

/** A greeting with an optional creator-given title (RoleCall alternate_greeting_titles, Backyard scenarios). */
export interface Greeting {
  text: string;
  title?: string;
}

export interface Greetings {
  firstMessage?: string;
  alternateGreetings?: Greeting[];
  /** CCv3 group-chat-only greetings, distinct from alternateGreetings */
  groupOnlyGreetings?: Greeting[];
}

export interface Examples {
  /** mes_example */
  exampleMessages?: string;
}

export interface Attribution {
  creator?: string;
  originalCreator?: string;
  source?: string[];
  /** canonical/origin URL for the card (RoleCall source_url) */
  sourceUrl?: string;
  license?: string;
  /** single-language creator notes about the card (CCv2/v3 `creator_notes`) */
  creatorNotes?: string;
  /** localized creator notes, map<ISO 639-1, text> (CCv3 prefers this over single-language notes) */
  creatorNotesMultilingual?: Record<string, string>;
  /** unix seconds */
  createdAt?: number;
  updatedAt?: number;
}

/** Graded content rating (RoleCall all_hours/late_night/after_dark; boolean nsfw maps to all-ages/explicit). */
export type ContentRating = "all-ages" | "mature" | "explicit";

export interface Discovery {
  tags?: string[];
  genre?: string;
  fandom?: string;
  /** explicit content rating; keep out of free-text tags */
  rating?: ContentRating;
  /** optional trigger/content warnings, card-portable */
  contentWarnings?: string[];
}

export interface MediaAsset {
  role: "portrait" | "emotion" | "outfit" | "pose" | "background" | "other";
  name?: string;
  /** human label for an expression/outfit/pose variant (RoleCall sprite label) */
  label?: string;
  /** the primary asset of its role (e.g. the "main" portrait among many) */
  primary?: boolean;
  /** reference into the entity's asset store, or a data URI */
  ref: string;
  mime?: string;
}

export interface Media {
  portrait?: MediaAsset;
  /** extra images / expression + outfit + pose packs (Risu .charx, RoleCall sprites) */
  assets?: MediaAsset[];
}

/** A named color swatch in a card's palette (RoleCall casting-card colors[]). */
export interface Swatch {
  label?: string;
  name?: string;
  hex: string;
}

/** A creator-curated background, optionally a video with playback controls (RoleCall default_background). */
export interface Background {
  ref: string;
  overlayOpacity?: number;
  videoPlaybackRate?: number;
}

/**
 * The casting-card presentation layer: a creator's visual identity for the character
 * (RoleCall signature palette, curated background, field order, definition spoilers).
 * Optional; formats without a presentation concept simply omit it.
 */
export interface Presentation {
  accentColor?: string;
  gradientColors?: string[];
  palette?: Swatch[];
  background?: Background;
  /** creator-chosen display order of definition fields (bento layout) */
  fieldOrder?: string[];
  /** spoiler / reveal-order config over the public definition fields */
  spoilers?: { mode?: string; order?: string[] };
}

/**
 * Creator-authored behavior dials (SillyTavern's "Advanced Definitions"): inline settings a creator
 * tunes on the character itself. Distinct from `behaviorRefs`, which LINKS to regex/script entities;
 * these are values, not references. An editable section in the forge.
 */
export interface CharacterSettings {
  /** group-chat turn-frequency weight, 0..1 (SillyTavern `extensions.talkativeness`) */
  talkativeness?: number;
}

export interface CharacterBody {
  identity: Identity;
  persona: Persona;
  prompts: Prompts;
  greetings: Greetings;
  examples: Examples;
  media: Media;
  attribution: Attribution;
  discovery: Discovery;
  /** creator's visual identity for the card, when the source format carries one */
  presentation?: Presentation;
  /** authored inline behavior dials (talkativeness, ...) */
  settings?: CharacterSettings;
  /**
   * authored external worldbook link by NAME (SillyTavern `extensions.world`): the creator's intent to
   * auto-load the worldbook called X. Distinct from knowledgeRefs, which links embedded books by canonical id.
   */
  worldName?: string;
  /** linked canonical lorebook id(s), ordered; embedded on export where a format requires it */
  knowledgeRefs?: string[];
  /** linked canonical regex/script id(s) */
  behaviorRefs?: string[];
}

export type CanonicalCharacter = CanonicalEntity<"character", CharacterBody>;
