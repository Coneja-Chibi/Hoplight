/**
 * Layout constants for bento/playbill: act lists and kind sets that drive field width/panel chrome.
 * Data only - presenters and Editor share these without re-declaring.
 */
export const RICH_FIELD_KINDS = new Set([
  "voice-setup",
  "structured-persona",
  "image-prompt",
  "sprite-parts",
  "response-schema",
]);

export const ACTS: ReadonlyArray<{ id: string; no: string; title: string; ids: readonly string[] }> = [
  { id: "identity", no: "Act I", title: "Identity", ids: ["name", "tagline", "fullName", "title", "age", "pronouns", "nickname", "culture", "characterVersion", "tags", "rating"] },
  { id: "persona", no: "Act II", title: "Persona", ids: ["personality", "scenario", "appearance", "structuredPersona", "voice", "imagePrompt"] },
  { id: "prompts", no: "Act III", title: "Prompts", ids: ["systemPrompt", "postHistoryInstructions", "prefill", "additionalText", "depthInjections"] },
  { id: "greetings", no: "Act IV", title: "Greetings", ids: ["firstMes", "alternateGreetings", "groupOnlyGreetings"] },
  { id: "examples", no: "Act V", title: "Examples", ids: ["mesExample"] },
  { id: "discovery", no: "Act VI", title: "Discovery", ids: ["genre", "fandom", "contentWarnings"] },
  { id: "attribution", no: "Act VII", title: "Attribution", ids: ["creator", "creatorNotes", "publicNote", "originalCreator", "source", "sourceUrl", "license", "creatorNotesMultilingual"] },
  { id: "presentation", no: "Act VIII", title: "Presentation", ids: ["gradient", "palette", "background", "spotlight", "mediaLinks", "visualKind", "sprite"] },
  { id: "settings", no: "Act IX", title: "Settings", ids: ["talkativeness", "risuSettings", "responseSchema", "bias"] },
];

export const WIDE_KINDS = new Set([
  "prose", "greetings", "list", "keyvalue", "list-subeditor", "structured-subeditor",
  "spotlight", "background", "palette", "gradient", "asset-gallery", "tags", "rating",
  "voice-setup", "structured-persona", "image-prompt", "sprite-parts", "response-schema",
  "select",
]);

export const PANEL_KINDS = new Set([
  "voice-setup",
  "structured-persona",
  "image-prompt",
  "sprite-parts",
  "response-schema",
]);
