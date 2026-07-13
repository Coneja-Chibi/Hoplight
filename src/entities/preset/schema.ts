import type { CanonicalEntity } from "../../core/canonical";

/**
 * CanonicalPreset - the AI-behavior-recipe entity (same hub-spoke shape as lorebook/persona/regex:
 * body is the authored content; stored under studio/preset/<id>.json). This models ONE member of
 * the SillyTavern "preset" FAMILY: the chat-completion PROMPT-MANAGER preset (prompt blocks +
 * ordering + samplers + settings groups), the shape all four surveyed engines center on and the one
 * canonical-model.md declares. ST's other subtypes (context / instruct / sysprompt / text-completion
 * / reasoning) are out of scope - escrow or their own kinds later, never merged in. Field map +
 * survey: docs/PRESET-JEWEL-PLAN.md, specs/formats/st-preset.md, specs/formats/lumiverse-preset.md,
 * presets-core (the RC parser this canonical shape is distilled from).
 *
 * DESIGN PRINCIPLE (advisor-locked P0): model CANONICALLY what the editor/domain authors; ESCROW
 * what is pure source-wire fidelity no editor touches. So `groups` and `choices` are canonical
 * (Marinara + RC have them natively and the editor authors them); ST's per-character `prompt_order`
 * overrides and Marinara's variable layer live in escrow (wire-only, unauthored).
 *
 * A preset is a named, ordered collection of PROMPT BLOCKS, optionally grouped, plus its sampler +
 * behavior settings and (novel) a CHOICES walkthrough. One block maps 1:1 to an ST prompt / RC
 * prompt / Marinara section; one preset maps to an ST completion-preset file, an RC preset, a
 * Lumiverse preset wrapper (import-only), or a Marinara preset export.
 *
 * SAFETY: a block is DATA. Assembling a preset is string composition, never eval - the build engine
 * (core/preset, P2) resolves order, splices markers, and applies macros against a rehearsal context.
 */

/** OpenAI-standard message role; the triplet every engine shares. */
export type PromptRole = "system" | "user" | "assistant";

/**
 * Where a block lands in the assembled request. Named OPEN union (the position-picker law: raw
 * vocabulary here, per-platform legality in core/preset/platform-fields.ts, never a UI literal).
 * Canonical display order: relative (in preset order), in_chat (own message at depth), append (glue
 * onto the message at depth), append_preset (very bottom), prepend_preset (very top). Codecs map
 * wire encodings onto these: ST's numeric `injection_position` 0/1, RC's 0-4, Marinara's "ordered".
 */
export type PromptPlacement =
  | "relative"
  | "in_chat"
  | "append"
  | "append_preset"
  | "prepend_preset"
  | (string & {});

/**
 * One prompt block - the row in the manuscript.
 */
export interface PresetPrompt {
  /**
   * Stable block id = the VERBATIM source identifier (ST `identifier`, Marinara section
   * `identifier`). NEVER a fresh vaud-minted id: prompt-order refs, marker resolution, and
   * `isDefault` all key off it, and re-minting would break every round-trip. This field is EXEMPT
   * from the UUID regeneration the other entities apply.
   */
  id: string;
  name: string;
  content: string;
  role: PromptRole;
  enabled: boolean;
  /** ST `system_prompt`: rendered as a system-role prompt-manager entry. */
  systemPrompt: boolean;
  /** structural placeholder (chat history / world info / examples) with no content of its own. */
  marker: boolean;
  /**
   * When `marker`, the ST-compatible slot identity (chatHistory, worldInfoBefore, worldInfoAfter,
   * dialogueExamples, personaDescription). RC surfaces these as its named marker slots.
   */
  markerSlot?: string;
  placement: PromptPlacement;
  /** message depth for in_chat/append placements (0 = most recent; ST `injection_depth`, def 4). */
  injectionDepth: number;
  /** relative-order weight; lower appears first (ST `injection_order`, default 100). */
  injectionOrder: number;
  /** ST `forbid_overrides`: a character may not override this prompt. */
  forbidOverrides: boolean;
  /** generation types that trigger this injection ("normal", "continue", "impersonate", ...). */
  injectionTrigger?: string[];
  /** true iff a built-in ST default identifier (not a user-authored prompt). */
  isDefault?: boolean;
  /** id of the containing group (PresetGroup.id); absent = top-level / uncategorized. */
  groupId?: string;
  /** Marinara: wrap this block's content in an XML tag on build. */
  wrapInXml?: boolean;
  xmlTagName?: string;
  /** per-platform leftovers with no first-class home; sealed, round-trips untouched. */
  extras?: Record<string, unknown>;
}

/**
 * A category / folder of blocks. Canonical because Marinara `groups` and RC categories are
 * first-class and the editor authors them. ST has no real groups - it encodes them as divider
 * PROMPTS; the ST codec bridges by DERIVING a divider identifier deterministically from this `id`
 * for vaud-authored groups and ESCROWING the original divider identifier only for imported ST
 * presets. That keeps the Round-Trip Law under EDITS (add/rename/move a group), not just import -
 * a user-added group must never gain an escrow entry it lacked (PRESET-JEWEL-PLAN.md).
 */
export interface PresetGroup {
  /** stable canonical id; the ST codec derives its divider identifier from this deterministically. */
  id: string;
  name: string;
  /** nemo-wiki dividers may carry content; legacy ST + Marinara groups do not. */
  content?: string;
  /** parent group id for nesting (Marinara `parentGroupId` / RC subcategories); absent = top. */
  parentGroupId?: string;
  order?: number;
  enabled?: boolean;
  extras?: Record<string, unknown>;
}

/**
 * Sampler + context settings. ALL optional: absent stays absent (the Round-Trip Law forbids
 * emitting a value the source never had); the build engine applies defaults at compile time, never
 * stored. Field surface = presets-core `SamplerSettings`.
 */
export interface PresetSamplers {
  temperature?: number;
  topP?: number;
  topK?: number;
  topA?: number;
  minP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  maxContext?: number;
  maxTokens?: number;
  promptPostProcessing?: "none" | "merge" | "semi" | "strict" | "single";
  /** how the window is bounded; default "tokens" when absent. */
  contextMode?: "tokens" | "messages";
  /** message-count budget when contextMode = "messages". */
  maxMessages?: number;
}

/** The always-on utility prompts (presets-core `SystemPrompts`); all optional. */
export interface PresetSystemPrompts {
  impersonation?: string;
  newChat?: string;
  newGroupChat?: string;
  newExampleChat?: string;
  continueNudge?: string;
  groupNudge?: string;
  assistantPrefill?: string;
  assistantImpersonation?: string;
}

/** Handlebars-ish format strings for card fields (presets-core `TemplateFormats`). */
export interface PresetTemplates {
  worldInfoFormat?: string;
  scenarioFormat?: string;
  personalityFormat?: string;
}

/** Message-assembly behavior flags (presets-core `BehaviorSettings`). */
export interface PresetBehavior {
  wrapInQuotes?: boolean;
  /** ST `names_behavior`: how char names prefix messages (numeric enum, kept verbatim). */
  namesBehavior?: number;
  sendIfEmpty?: string;
  continuePrefill?: boolean;
  continuePostfix?: string;
}

/** Provider/API request options (presets-core `APIOptions`). */
export interface PresetApiOptions {
  streamResponses?: boolean;
  claudeUseSystemPrompt?: boolean;
  useMakerSuiteSystemPrompt?: boolean;
  squashSystemMessages?: boolean;
  functionCalling?: boolean;
  showThoughts?: boolean;
  reasoningEffort?: string;
  enableWebSearch?: boolean;
  requestImages?: boolean;
}

/** Image/video inlining (presets-core `MediaSettings`). */
export interface PresetMedia {
  imageInlining?: boolean;
  inlineImageQuality?: string;
  videoInlining?: boolean;
}

/** Generation-shape settings (presets-core `GenerationSettings`). */
export interface PresetGeneration {
  seed?: number;
  /** number of completions to request (presets-core `n`). */
  completions?: number;
  maxContextUnlocked?: boolean;
  biasPreset?: string;
}

/** How a walkthrough choice is answered. */
export type PresetChoiceType = "one" | "many" | "toggle" | "input";

/**
 * One option in a walkthrough choice. Carries BOTH source effects first-class (verified against
 * Marinara `choiceBlock` + RC `ChoiceGroup`): `value` SETS the choice's variable (Marinara);
 * `enablesPrompts` gates blocks on while selected (RC `option.prompts`); `set` writes scoped state
 * (RC `option.set`). A source that uses only one effect leaves the others empty.
 */
export interface PresetChoiceOption {
  id: string;
  label: string;
  description?: string;
  /** Marinara: the string injected into the choice's variable when this option is selected. */
  value?: string;
  /** RC: block ids (PresetPrompt.id) enabled while this option is selected. */
  enablesPrompts?: string[];
  /** RC: scoped state writes applied while selected (scope:key -> value). */
  set?: Record<string, string>;
}

/**
 * A CHOICES-walkthrough entry - the novel construct (Marinara `choiceBlock` + RC `ChoiceGroup`
 * unified). Authored NOW; RUN later: vaud presents these questions and captures answers at setup
 * time once a run surface exists (the north-star, PRESET-JEWEL-PLAN.md). An answer feeds
 * `{{getvar::key}}` and/or gates blocks via the options above.
 */
export interface PresetChoice {
  id: string;
  /** variable this choice sets (Marinara `variableName`); `{{getvar::key}}` reads it. */
  key?: string;
  /** the question/title shown to the user (Marinara `question` / RC `label`). */
  label: string;
  /** long-form prose behind a "read more" (RC `readme`). */
  readme?: string;
  type: PresetChoiceType;
  options: PresetChoiceOption[];
  /** one: option id; many: option ids; toggle: boolean; input: string. */
  default?: string | string[] | boolean;
  /** many: fewest options that must stay selected. */
  min?: number;
  /** input: empty-field hint. */
  placeholder?: string;
  /** input: tappable example answers. */
  suggestions?: string[];
  /** many: how selected values join when injected (Marinara `separator`). */
  separator?: string;
  /** Marinara: pick an option at random instead of asking. */
  randomPick?: boolean;
  sortOrder?: number;
  extras?: Record<string, unknown>;
}

export interface PresetBody {
  name: string;
  description?: string;
  /**
   * Set-level on/off (the Library shelf switch; the lorebook/regex `enabled?` precedent). Absent =
   * on; always read as `enabled !== false`. An off preset skips export the way an off set does.
   */
  enabled?: boolean;
  /** the ordered real prompt blocks (divider rows are never blocks; `groups` model structure). */
  prompts: PresetPrompt[];
  /** categories / folders; canonical because Marinara + RC author them (see PresetGroup). */
  groups?: PresetGroup[];
  samplers?: PresetSamplers;
  systemPrompts?: PresetSystemPrompts;
  templates?: PresetTemplates;
  behavior?: PresetBehavior;
  apiOptions?: PresetApiOptions;
  media?: PresetMedia;
  generation?: PresetGeneration;
  /** the CHOICES walkthrough (novel; authored now, run later). */
  choices?: PresetChoice[];
}

export type CanonicalPreset = CanonicalEntity<"preset", PresetBody>;

/** A blank preset (no blocks yet) - the seed the Library's "new preset" flow saves and opens. */
export const emptyPresetBody = (name: string): PresetBody => ({
  name,
  prompts: [],
});
