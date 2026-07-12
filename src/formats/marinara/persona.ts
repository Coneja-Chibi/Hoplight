/**
 * Marinara-Engine persona codec (kind "persona"): one Persona object (packages/shared/src/types/
 * persona.ts, read 2026-07-12) - structured sections (description/personality/scenario/backstory/
 * appearance), comment (-> brief), avatar path + CROP, per-persona chat THEMING (name/dialogue/
 * box colors, tracker paint) and STAT BARS. Section map: appearance -> appearance, personality ->
 * personality, backstory -> history; description is the persona's main text (-> content);
 * scenario has no canonical home. Theming, stats, crop, tags, scenario and the rest ride SEALED
 * in extras/original (never rendered, never dropped) - the game layer is Marinara's, the identity
 * is portable.
 */
import type { AdapterInput, AdapterOutput, PersonaAdapter } from "../../core/adapter";
import type { CanonicalPersona, PersonaBody } from "../../entities/persona/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Marinara signal: id + name + the section keys + a theming key (disjoint from Lumi/ST/RC). */
function readMarinaraPersona(input: AdapterInput): Rec | null {
  const o = readJsonObject(input);
  if (!o) return null;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  if (typeof o.description !== "string" || typeof o.personality !== "string") return null;
  if (!("nameColor" in o) && !("boxColor" in o) && !("personaStats" in o)) return null;
  return o;
}

const adapter: PersonaAdapter = {
  id: "marinara-persona",
  label: "Marinara persona (theming and stat bars ride sealed)",
  outputExtensions: ["json"],
  kind: "persona",

  detect(input: AdapterInput): number {
    return readMarinaraPersona(input) ? 0.95 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPersona {
    const w = readMarinaraPersona(input);
    if (!w) throw new Error("marinara-persona: not a recognizable Marinara persona");
    const body: PersonaBody = {
      name: w.name as string,
      content: (w.description as string) ?? "",
    };
    const brief = str(w.comment)?.trim();
    if (brief) body.brief = brief;
    const sections: NonNullable<PersonaBody["sections"]> = {};
    if (str(w.appearance)?.trim()) sections.appearance = w.appearance as string;
    if (str(w.personality)?.trim()) sections.personality = w.personality as string;
    if (str(w.backstory)?.trim()) sections.history = w.backstory as string;
    if (Object.keys(sections).length > 0) body.sections = sections;
    const avatar = str(w.avatarPath);
    if (avatar) body.presentation = { imageUrl: avatar };
    body.attribution = { source: "marinara" };
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "persona",
      id: canonicalId(body.name),
      body,
      original: { "marinara-persona": { raw: w } },
    };
  },

  fromCanonical(entity: CanonicalPersona): AdapterOutput {
    const twin = entity.original?.["marinara-persona"]?.raw;
    const base: Rec = isRec(twin) ? structuredClone(twin) : {};
    const b = entity.body;
    const out: Rec = {
      ...base, // theming, stats, crop, tags, scenario, timestamps - sealed, byte-true
      id: str(base.id) ?? canonicalId(b.name),
      name: b.name,
      comment: b.brief ?? str(base.comment) ?? "",
      description: b.content,
      personality: b.sections?.personality ?? str(base.personality) ?? "",
      appearance: b.sections?.appearance ?? str(base.appearance) ?? "",
      backstory: b.sections?.history ?? str(base.backstory) ?? "",
      avatarPath: b.presentation?.imageUrl ?? str(base.avatarPath) ?? null,
    };
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default adapter;
