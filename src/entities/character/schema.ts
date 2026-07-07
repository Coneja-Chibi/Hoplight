import type { CanonicalEntity } from "../../core/canonical";

/**
 * CanonicalCharacter - the character entity schema. Seeded from RoleCall + SillyTavern + Risu,
 * widened by the format deep-dive (see design/FORMATS-LANDSCAPE.md). Only fields a real now-tier
 * format actually produces are first-classed here; everything else rides in original.
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
  // Authored identity attributes (RoleCall casting-card details + Agnai): free-form creator-set facts.
  /** full/formal name distinct from the display name (RC details.full_name) */
  fullName?: string;
  /** honorific / role title (RC details.title) */
  title?: string;
  /** free TEXT in every producer ("23", "ageless", "300+ years"), never an int (RC details.age) */
  age?: string;
  /** RC details.pronouns */
  pronouns?: string;
  /** Agnai culture: drives default language/voice selection */
  culture?: string;
}

/**
 * Per-character voice/TTS selection - the authored SELECTION/config, never the model bytes (those are
 * assets/original). Producers: Agnai `voice`+`voiceDisabled` (rich), Risu `vits` (narrow: only the vits
 * config actually serializes to .charx; Risu's other TTS fields are app-local and never hit the wire).
 */
export interface Voice {
  /** open union: "elevenlabs" | "webspeechsynthesis" | "novel" | "agnaistic" | "vits" | ... */
  provider: string;
  voiceId?: string;
  rate?: number;
  pitch?: number;
  /** creator turned voice off without discarding the config (Agnai voiceDisabled) */
  disabled?: boolean;
  /** provider-specific extras (stability, similarityBoost, model seed, vits config...) - authored, open */
  extras?: Record<string, unknown>;
}

/**
 * Authored image-generation prompt hints: the text a creator writes to steer image gen for this
 * character. Two real producers (Agnai imageSettings affixes; Risu sdData rows + newGenData), so the
 * shape covers both: shared affix fields plus open labeled rows. Sampler/provider knobs are NOT here
 * (platform config, original).
 */
export interface ImagePrompt {
  /** full base prompt (Risu newGenData.prompt) */
  prompt?: string;
  prefix?: string;
  suffix?: string;
  negative?: string;
  /** prompt template (Agnai imageSettings.template) */
  template?: string;
  /** freeform instruction text (Risu newGenData.instructions) */
  instructions?: string;
  /** emotion-pack generation instructions (Risu newGenData.emotionInstructions) */
  emotionInstructions?: string;
  /** labeled prompt rows (Risu sdData: [["always","solo, 1girl"], ...]) */
  rows?: { label: string; value: string }[];
}

export interface Persona {
  personality?: string;
  scenario?: string;
  /** Agnai-only free-text physical description (image-gen); other formats fold it into description */
  appearance?: string;
  /** per-character voice/TTS selection (Agnai voice, Risu vits) */
  voice?: Voice;
  /** authored image-gen prompt hints (Agnai imageSettings affixes, Risu sdData/newGenData) */
  imagePrompt?: ImagePrompt;
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
  /** authored plain-append prompt text (Risu additionalText) - a simple append, not a depth injection */
  additionalText?: string;
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
  /** public "from the creator" note shown on the card page (RC creators_note; DISTINCT from creatorNotes) */
  publicNote?: string;
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

/** Agnai builder-authored composite avatar: named part selections + palette. Open keys so new part
 * slots do not require a schema change; the rendered images are assets, this is the authored RECIPE. */
export interface Sprite {
  parts: Record<string, string>;
  gender?: string;
  eyeColor?: string;
  bodyColor?: string;
  hairColor?: string;
}

export interface Media {
  portrait?: MediaAsset;
  /** extra images / expression + outfit + pose packs (Risu .charx, RoleCall sprites) */
  assets?: MediaAsset[];
  /** Agnai composite-avatar recipe (visualType "sprite") */
  sprite?: Sprite;
  /** which visual mode the creator chose: "avatar" | "sprite" (open; Agnai visualType) */
  visualKind?: string;
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
  /** the character's signature color when it is a single solid (RC details.signature_color, Risu
   * theme color). A signature that is a blend rides in gradientColors instead - one concept, two
   * storage shapes. Account-level accent color is deliberately not modeled here: it belongs to the
   * user's account, not the card. */
  signatureColor?: string;
  /** the character's signature when it is a blend of 2-3 colors (RC details.gradient_colors) */
  gradientColors?: string[];
  palette?: Swatch[];
  background?: Background;
  /** creator-chosen display order of definition fields (bento layout) */
  fieldOrder?: string[];
  /**
   * spoiler / reveal-order config over the public definition fields. `fields` is the authored per-field
   * boolean map (RC publicDefinitionDisplay.spoilers) - previously collapsed to mode/order and LOST.
   */
  spoilers?: { mode?: string; order?: string[]; fields?: Record<string, boolean> };
  /** creator-supplied external reference links on the casting card (RC details.media_links) */
  mediaLinks?: string[];
}

/**
 * Creator-authored behavior dials (SillyTavern's "Advanced Definitions"): inline settings a creator
 * tunes on the character itself. Distinct from `behaviorRefs`, which LINKS to regex/script entities;
 * these are values, not references. An editable section in the forge.
 */
export interface CharacterSettings {
  /** group-chat turn-frequency weight, 0..1 (SillyTavern `extensions.talkativeness`) */
  talkativeness?: number;
  /**
   * Risu authored display/behavior toggles (single-platform but creator-set, so first-class per the
   * schema-is-editor doctrine). Grouped so the origin is obvious and other formats never emit them.
   */
  risu?: {
    /** side-screen mode: "none" | "emotion" | "imggen" (open) */
    viewScreen?: string;
    largePortrait?: boolean;
    inlayViewScreen?: boolean;
    utilityBot?: boolean;
    lorePlus?: boolean;
  };
  /**
   * Agnai structured-output config (`json` ResponseSchema): authored response-shaping the creator built
   * in Agnai's schema editor. Carried verbatim-editable; likely migrates to the Preset entity later.
   */
  responseSchema?: Record<string, unknown>;
}

/**
 * A declarative find/replace script (Risu customScripts; ST/Lumiverse standalone regex files are the
 * file-level cousins that will extract to the regex entity). Data, not code: applying one is a regex
 * replace, never an eval.
 */
export interface RegexScript {
  label?: string;
  find: string;
  replace: string;
  /** pipeline phase, open union: "edittrans" | "editoutput" | "editdisplay" | ... */
  phase: string;
  /** custom regex flags (Risu `flag`) */
  flags?: string;
  /** whether the custom flags apply (Risu `ableFlag`) */
  useFlags?: boolean;
}

/** A trigger state-machine script (Risu triggerscript): condition/effect rows, verbatim-editable. */
export interface TriggerScript {
  label?: string;
  /** the triggering event (Risu `type`: "output", "input", "start", ...) */
  event: string;
  conditions: unknown[];
  effects: unknown[];
}

/**
 * AUTHORED BEHAVIOR content - the card's scripts, first-class and editable (schema-is-editor), with a
 * hard security line: the converter/editor NEVER executes any of this. No eval, no require, no DOM
 * injection. Execution happens ONLY inside the capability sandbox (design/SANDBOX-SPEC.md: isolated
 * WASM/VM engines + narrow host bridge + structural deny-by-absence permission manifest), a later
 * milestone. Behavior never blind-copies cross-format: it re-emits only on its own format's wire.
 */
export interface CharacterBehavior {
  regexScripts?: RegexScript[];
  triggerScripts?: TriggerScript[];
  /** JS virtual-script payload, verbatim-editable text (Risu virtualscript) */
  virtualScript?: string;
  /** custom background markup/styles, verbatim-editable text (Risu backgroundHTML/backgroundCSS) */
  backgroundHTML?: string;
  backgroundCSS?: string;
  /** script-engine seed values (Risu defaultVariables), verbatim-editable */
  defaultVariables?: string;
  /** prebuilt-asset generation config (Risu prebuiltAssetCommand/Exclude/Style) */
  prebuiltAsset?: { command?: string; exclude?: string[]; style?: string };
  /** module toggle config string (Risu customModuleToggle) */
  moduleToggles?: string;
  /** the card REQUESTED the privileged low-level script API (Risu lowLevelAccess). A warning marker
   * for the UI and a sandbox gating input - never an execution trigger. */
  privileged?: boolean;
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
   * Character-level phrase/logit bias (Risu `bias` [phrase, weight] pairs). NOTE: a DIFFERENT axis than
   * NovelAI's entry/category-level loreBiasGroups (rich groups, modeled on the lorebook side when its
   * reconciled shape lands) - two homes because they are genuinely two concepts.
   */
  bias?: { phrase: string; weight: number }[];
  /**
   * authored external worldbook link by NAME (SillyTavern `extensions.world`): the creator's intent to
   * auto-load the worldbook called X. Distinct from knowledgeRefs, which links embedded books by canonical id.
   */
  worldName?: string;
  /** linked canonical lorebook id(s), ordered; embedded on export where a format requires it */
  knowledgeRefs?: string[];
  /** authored script/behavior content carried ON the card (Risu); see CharacterBehavior's security line */
  behavior?: CharacterBehavior;
  /** linked canonical regex/script entity id(s) - for STANDALONE behavior files (ST/Lumiverse regex) */
  behaviorRefs?: string[];
}

export type CanonicalCharacter = CanonicalEntity<"character", CharacterBody>;
