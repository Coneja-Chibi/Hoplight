/**
 * Cross-kind detection markers, extracted exactly once. The Tavern lineage ships MANY artifacts
 * that look alike at the edges (cards, worldbooks, chat-completion presets, instruct/context
 * templates, RoleCall preset exports), and several carry each other's fields: presets carry
 * `name` + `extensions`, RC preset exports bundle regex under `extensions.regex_scripts`. Every
 * adapter that reads a shared home (a flat object, an extensions block) consults these markers so
 * one kind never claims another kind's export. Pure predicates, fail-open to false.
 */

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * True when the object is a SETTINGS-FAMILY export (chat-completion preset, instruct template,
 * context template - ST's own or a RoleCall preset export, which is the same flat grammar).
 * These are never characters, books, personas, or standalone regex sets, whatever they bundle.
 */
export function looksLikeSettingsExport(o: unknown): boolean {
  if (!isRec(o)) return false;
  return (
    Array.isArray(o.prompts) ||
    "prompt_order" in o ||
    "chat_completion_source" in o ||
    "temperature" in o ||
    "input_sequence" in o || // instruct template
    "story_string" in o // context template
  );
}

/**
 * True for RoleCall's generic library wrapper ({ exportedAt, type, version, data }) - the
 * "download as JSON" envelope around presets/series items. The inner payload belongs to the
 * wrapper's declared type; nothing may claim the wrapper by scanning inside it.
 */
export function looksLikeLibraryWrapper(o: unknown): boolean {
  if (!isRec(o)) return false;
  return typeof o.type === "string" && "exportedAt" in o && isRec(o.data);
}
