/**
 * Field-module registry - the HUB of the editor's flow system. Each editable field of a character is
 * one module: a canonical path, a plain-English question (the UX-law voice, not a terse label), and a
 * `kind` that says which control renders it. Presenters are pure VIEWS over this one list:
 *   - Interview renders one module per screen,
 *   - Callsheet renders a step's modules as rows,
 *   - the living sheet renders each module read-only.
 * One representation, many arrangements - that is what makes flows drop-in. Copy lives here as DATA so
 * a new field is a new row (folders-as-schema), and presenters render questions they do not own.
 *
 * Composite editors (tags, rating, palette, gradient, portrait, greetings) are ONE module each, not
 * atomized - their `kind` maps to the bespoke control the Editor already renders. The `sheetLabel` is
 * the short caption the read-only sheet shows; `path` is the canonical leaf and the "is it filled?"
 * probe (composites point at their primary path).
 */
import type { StepId } from "./editor-core";

/** which control renders a module. `text`/`prose` are generic; the rest reuse a bespoke editor body. */
export type FieldKind =
  | "text"
  | "prose"
  | "tags"
  | "rating"
  | "portrait"
  | "gradient"
  | "palette"
  | "greetings"
  | "background"
  | "spotlight"
  | "list";

export interface FieldModule {
  /** stable id (RC field-order id where one exists, else the field name) */
  id: string;
  /** canonical dot path: the value the control edits and the sheet reads */
  path: string;
  /** which control renders it */
  kind: FieldKind;
  /** the guided step (chapter) this module belongs to */
  step: StepId;
  /** the plain-English question shown big (Archivo Black) */
  question: string;
  /** the warm one-line helper under it (Crimson) */
  helper?: string;
  /** placeholder for text/prose inputs */
  placeholder?: string;
  /** a character must have this (only name today); presenters may flag but never block */
  required?: boolean;
  /** short caption for the read-only living-sheet row */
  sheetLabel: string;
}

/**
 * The ordered flow. Order = the natural order a creator answers in; the Interview walks it top to
 * bottom, Callsheet slices it by `step`. Ids match EDITOR_CARDS / RC field-order so a card keeps its
 * identity across presenters. Add a field = add a row here (and, only if a brand-new control, a case
 * in the Editor's controlFor).
 */
export const FIELD_MODULES: FieldModule[] = [
  // casting - who they are
  { id: "name", path: "identity.name", kind: "text", step: "casting", required: true,
    question: "What do we call them?", helper: "The name people see first. You can change it anytime.",
    placeholder: "Mosis", sheetLabel: "Name" },
  { id: "tagline", path: "identity.tagline", kind: "text", step: "casting",
    question: "Give them a one-line hook?", helper: "A short, catchy description. Skip it if nothing fits yet.",
    placeholder: "A short, catchy description...", sheetLabel: "Tagline" },
  { id: "tags", path: "discovery.tags", kind: "tags", step: "casting",
    question: "Tag them so they're findable", helper: "Type and press enter. Or auto-tag later.",
    sheetLabel: "Tags" },
  { id: "rating", path: "discovery.rating", kind: "rating", step: "casting",
    question: "What's the content rating?", helper: "Auto-calculated from tags; override it here if you like.",
    sheetLabel: "Rating" },
  { id: "genre", path: "discovery.genre", kind: "text", step: "casting",
    question: "A genre?", helper: "Romance, horror, sci-fi... Optional.", placeholder: "Genre", sheetLabel: "Genre" },
  { id: "fandom", path: "discovery.fandom", kind: "text", step: "casting",
    question: "From a fandom?", helper: "If they're fan content, name the source. Optional.", placeholder: "Fandom", sheetLabel: "Fandom" },
  { id: "contentWarnings", path: "discovery.contentWarnings", kind: "list", step: "casting",
    question: "Any content warnings?", helper: "Add each, press enter. Optional.", sheetLabel: "Content warnings" },
  { id: "fullName", path: "identity.fullName", kind: "text", step: "casting",
    question: "Their full or legal name?", helper: "Optional. The name behind the name.",
    placeholder: "Legal or birth name...", sheetLabel: "Full name" },
  { id: "title", path: "identity.title", kind: "text", step: "casting",
    question: "A title or epithet?", helper: "The Magnificent, Lord of..., etc. Optional.",
    placeholder: "The Magnificent, Lord of...", sheetLabel: "Title" },
  { id: "age", path: "identity.age", kind: "text", step: "casting",
    question: "How old are they?", helper: "Ancient, 25, Timeless... whatever fits.",
    placeholder: "Ancient, 25, Timeless...", sheetLabel: "Age" },
  { id: "pronouns", path: "identity.pronouns", kind: "text", step: "casting",
    question: "Their pronouns?", helper: "He/Him, She/Her, They... Optional.",
    placeholder: "He/Him, She/Her, They...", sheetLabel: "Pronouns" },
  { id: "nickname", path: "identity.nickname", kind: "text", step: "casting",
    question: "A nickname?", helper: "What people close to them use. Optional.",
    placeholder: "A shorter name...", sheetLabel: "Nickname" },
  { id: "culture", path: "identity.culture", kind: "text", step: "casting",
    question: "Their culture or language?", helper: "Shapes default voice and phrasing on some platforms. Optional.",
    placeholder: "e.g. Japanese, French...", sheetLabel: "Culture" },
  { id: "characterVersion", path: "identity.characterVersion", kind: "text", step: "casting",
    question: "A version label?", helper: "Free-form, e.g. v2 or 2024-final. Optional.",
    placeholder: "v1", sheetLabel: "Version" },
  { id: "portrait", path: "media.portrait", kind: "portrait", step: "casting",
    question: "Give them a face?", helper: "Add art now, or skip and add it later.", sheetLabel: "Portrait" },
  { id: "gradient", path: "presentation.gradientColors", kind: "gradient", step: "casting",
    question: "Signature colors?", helper: "Up to 3, blended left to right into their accent. Optional.",
    sheetLabel: "Signature colors" },
  { id: "palette", path: "presentation.palette", kind: "palette", step: "casting",
    question: "Name a color palette?", helper: "Hair, eyes, skin... named colors for later. Optional.",
    sheetLabel: "Palette" },

  // prompts - the words that drive them
  { id: "description", path: "identity.description", kind: "prose", step: "prompts",
    question: "Describe them.", helper: "Who they are, how they look, what they're like.", sheetLabel: "Description" },
  { id: "personality", path: "persona.personality", kind: "prose", step: "prompts",
    question: "What's their personality?", helper: "Traits, quirks, how they treat people.", sheetLabel: "Personality" },
  { id: "appearance", path: "persona.appearance", kind: "prose", step: "prompts",
    question: "What do they look like?", helper: "Their appearance, if you keep it separate from the description. Optional.", sheetLabel: "Appearance" },
  { id: "scenario", path: "persona.scenario", kind: "prose", step: "prompts",
    question: "Set the scene?", helper: "The situation the story opens in. Optional.", sheetLabel: "Scenario" },
  { id: "systemPrompt", path: "prompts.systemPrompt", kind: "prose", step: "prompts",
    question: "How should the model behave as them?", helper: "The system prompt: standing instructions for the AI. Optional but powerful.", sheetLabel: "System prompt" },
  { id: "postHistoryInstructions", path: "prompts.postHistoryInstructions", kind: "prose", step: "prompts",
    question: "Anything to reinforce every turn?", helper: "Post-history instructions, injected after the chat. The 'jailbreak' slot. Optional.", sheetLabel: "Post-history" },
  { id: "prefill", path: "prompts.prefill", kind: "prose", step: "prompts",
    question: "Start their reply for them?", helper: "Assistant prefill (Claude-style): the first words of every response. Optional.", sheetLabel: "Prefill" },
  { id: "additionalText", path: "prompts.additionalText", kind: "prose", step: "prompts",
    question: "Any extra text to append?", helper: "Plain text added to the prompt. Optional.", sheetLabel: "Additional text" },

  // advanced - how the story starts and sounds
  { id: "firstMes", path: "greetings.firstMessage", kind: "prose", step: "advanced",
    question: "How do they say hello?", helper: "Their first message to open a chat.", sheetLabel: "First message" },
  { id: "alternateGreetings", path: "greetings.alternateGreetings", kind: "greetings", step: "advanced",
    question: "Any alternate greetings?", helper: "Other ways a chat can open. Optional.", sheetLabel: "Alt greetings" },
  { id: "mesExample", path: "examples.exampleMessages", kind: "prose", step: "advanced",
    question: "Show a sample of their voice?", helper: "Example dialogue teaches the model how they talk.", sheetLabel: "Example messages" },

  // finalize - presentation
  { id: "background", path: "presentation.background", kind: "background", step: "finalize",
    question: "A default background?", helper: "An image shown when a chat with them starts. Optional.", sheetLabel: "Background" },
  { id: "spotlight", path: "presentation.spoilers", kind: "spotlight", step: "finalize",
    question: "Spotlight or hide any fields?", helper: "Choose what shows on their card. Optional.", sheetLabel: "Spotlight" },

  // finalize - attribution (who made them, where they came from)
  { id: "creator", path: "attribution.creator", kind: "text", step: "finalize",
    question: "Who made them?", helper: "Your handle, as the creator. Optional.", placeholder: "Creator handle", sheetLabel: "Creator" },
  { id: "creatorNotes", path: "attribution.creatorNotes", kind: "prose", step: "finalize",
    question: "Notes for people who use this card?", helper: "Tips, warnings, how to run them. Shown to importers. Optional.", sheetLabel: "Creator notes" },
  { id: "publicNote", path: "attribution.publicNote", kind: "prose", step: "finalize",
    question: "A public note from you?", helper: "A short 'from the creator' shown on their card. Optional.", sheetLabel: "Public note" },
  { id: "originalCreator", path: "attribution.originalCreator", kind: "text", step: "finalize",
    question: "Original creator, if this is a remix?", helper: "Credit whoever made the original. Optional.", placeholder: "Original creator", sheetLabel: "Original creator" },
  { id: "source", path: "attribution.source", kind: "list", step: "finalize",
    question: "Where did they come from?", helper: "Sites or imports they passed through. Add each, press enter. Optional.", sheetLabel: "Source" },
  { id: "sourceUrl", path: "attribution.sourceUrl", kind: "text", step: "finalize",
    question: "A link to the original?", helper: "The source URL. Optional.", placeholder: "https://...", sheetLabel: "Source URL" },
  { id: "license", path: "attribution.license", kind: "text", step: "finalize",
    question: "A license?", helper: "How others may use them, e.g. CC-BY. Optional.", placeholder: "CC-BY", sheetLabel: "License" },
];
