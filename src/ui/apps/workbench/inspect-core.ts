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

import type { RenderFormat } from "../../_shared/render-policy";

export interface InspectField {
  /** short lowercase label (mono, uppercased by the view) */
  k: string;
  /** the field's text, trimmed and non-empty */
  v: string;
  /** how the value should render: authored prose is markdown, HTML notes are html, facts are plain */
  format: RenderFormat;
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
  const add = (k: string, v: string | null, format: RenderFormat = "plain"): void => {
    if (v) out.push({ k, v, format });
  };

  // the words, in reading order (authored prose renders as markdown)
  add("tagline", str(identity.tagline), "markdown");
  add("description", str(identity.description), "markdown");
  add("personality", str(persona.personality), "markdown");
  add("scenario", str(persona.scenario), "markdown");
  add("appearance", str(persona.appearance), "markdown");
  add("first message", str(greetings.firstMessage), "markdown");

  const alts = Array.isArray(greetings.alternateGreetings) ? greetings.alternateGreetings : [];
  alts.forEach((g, i) => {
    const gr = rec(g);
    const text = str(gr.text);
    const title = str(gr.title);
    add(title ? `alt greeting · ${title}` : `alt greeting ${i + 1}`, text, "markdown");
  });

  add("example messages", str(examples.exampleMessages), "markdown");

  // the prompt slots (authored prose)
  add("system prompt", str(prompts.systemPrompt), "markdown");
  add("post-history instructions", str(prompts.postHistoryInstructions), "markdown");
  add("prefill", str(prompts.prefill), "markdown");
  add("additional text", str(prompts.additionalText), "markdown");

  // authored identity facts (short strings, no markup)
  add("full name", str(identity.fullName));
  add("title", str(identity.title));
  add("age", str(identity.age));
  add("pronouns", str(identity.pronouns));
  add("nickname", str(identity.nickname));
  add("culture", str(identity.culture));
  add("character version", str(identity.characterVersion));

  // attribution + notes (creator notes / public note arrive as authored HTML in most tools)
  add("creator notes", str(attribution.creatorNotes), "html");
  add("public note", str(attribution.publicNote), "html");
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

function packFields(body: unknown): InspectField[] {
  const b = rec(body);
  const out: InspectField[] = [];
  const add = (k: string, v: string | null, format: InspectField["format"] = "plain"): void => {
    if (v) out.push({ k, v, format });
  };
  add("name", str(b.name));
  add("brief", str(b.brief));
  const pack = rec(b.pack);
  const items = Array.isArray(pack.items) ? pack.items : [];
  add("faces", items.length > 0 ? String(items.length) : null);
  add("default", str(pack.defaultLabel));
  const labels = items
    .map((it) => str(rec(it).label))
    .filter((x): x is string => Boolean(x))
    .join(", ");
  add("labels", labels || null);
  return out;
}

/** Dispatch the readable fields for an entity kind. Character + pack; others as wired. */
export function fieldsFor(kind: string, body: unknown): InspectField[] {
  if (kind === "character") return characterFields(body);
  if (kind === "pack") return packFields(body);
  return [];
}
