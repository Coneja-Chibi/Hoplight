/**
 * Read-only field extraction for the Workbench inspector - the pure core behind the "read everything"
 * pane. Given a canonical entity body, return its authored fields as an ordered, display-ready list:
 * present fields in reading order, empties skipped, lists flattened. No DOM, no fetch - the shell
 * (index.ts) fetches the entity and renders whatever this returns.
 *
 * Tolerant by construction: the body arrives as parsed JSON, so every path is read as `unknown` and
 * narrowed. A missing or malformed field is simply absent from the result, never a throw. Kinds beyond
 * character return [] until their own extractor is wired (the pane still shows its honest "soon" note).
 */

export interface InspectField {
  /** short lowercase label (mono, uppercased by the view) */
  k: string;
  /** the field's text, trimmed and non-empty */
  v: string;
}

const rec = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

/** A non-empty trimmed string, or null. */
const str = (x: unknown): string | null => {
  if (typeof x !== "string") return null;
  const t = x.trim();
  return t.length ? t : null;
};

/** A string[] joined for display, or null when empty / not a list of strings. */
const joined = (x: unknown): string | null => {
  if (!Array.isArray(x)) return null;
  const items = x.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  return items.length ? items.join(", ") : null;
};

/** Ordered readable fields of a canonical character body. Empties skip; nothing throws. */
export function characterFields(body: unknown): InspectField[] {
  const b = rec(body);
  const identity = rec(b.identity);
  const persona = rec(b.persona);
  const prompts = rec(b.prompts);
  const greetings = rec(b.greetings);
  const examples = rec(b.examples);
  const attribution = rec(b.attribution);
  const discovery = rec(b.discovery);

  const out: InspectField[] = [];
  const add = (k: string, v: string | null): void => {
    if (v) out.push({ k, v });
  };

  // the words, in reading order
  add("tagline", str(identity.tagline));
  add("description", str(identity.description));
  add("personality", str(persona.personality));
  add("scenario", str(persona.scenario));
  add("appearance", str(persona.appearance));
  add("first message", str(greetings.firstMessage));

  const alts = Array.isArray(greetings.alternateGreetings) ? greetings.alternateGreetings : [];
  alts.forEach((g, i) => {
    const gr = rec(g);
    const text = str(gr.text);
    const title = str(gr.title);
    add(title ? `alt greeting · ${title}` : `alt greeting ${i + 1}`, text);
  });

  add("example messages", str(examples.exampleMessages));

  // the prompt slots
  add("system prompt", str(prompts.systemPrompt));
  add("post-history instructions", str(prompts.postHistoryInstructions));
  add("prefill", str(prompts.prefill));
  add("additional text", str(prompts.additionalText));

  // authored identity facts
  add("full name", str(identity.fullName));
  add("title", str(identity.title));
  add("age", str(identity.age));
  add("pronouns", str(identity.pronouns));
  add("nickname", str(identity.nickname));
  add("culture", str(identity.culture));
  add("character version", str(identity.characterVersion));

  // attribution + notes
  add("creator notes", str(attribution.creatorNotes));
  add("public note", str(attribution.publicNote));
  add("creator", str(attribution.creator));
  add("original creator", str(attribution.originalCreator));
  add("source", joined(attribution.source));
  add("source url", str(attribution.sourceUrl));
  add("license", str(attribution.license));

  // discovery
  add("tags", joined(discovery.tags));
  add("genre", str(discovery.genre));
  add("fandom", str(discovery.fandom));
  add("rating", str(discovery.rating));
  add("content warnings", joined(discovery.contentWarnings));

  return out;
}

/** Dispatch the readable fields for an entity kind. Character today; other kinds as they are wired. */
export function fieldsFor(kind: string, body: unknown): InspectField[] {
  return kind === "character" ? characterFields(body) : [];
}
