/**
 * Lumiverse persona codec (kind "persona"): one account Persona object (frontend/src/types/
 * api.ts:633, staging, read 2026-07-12) - name, title, description, the PRONOUN TRIPLET
 * (subjective/objective/possessive - the only wire with structured pronouns), avatar_path,
 * attached_world_book_id, folder, is_default, is_narrator, metadata, timestamps. File home: an
 * API dump of one persona (Lumiverse has no file import/export UI; the API object is the only
 * standalone form, the marinara-regex precedent). Lossless: wire-only fields ride extras/original
 * and re-emit from the twin.
 */
import type { AdapterInput, AdapterOutput, PersonaAdapter } from "../../core/adapter";
import type { CanonicalPersona, PersonaBody } from "../../entities/persona/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** The Lumi signal: name + description + the pronoun triplet keys (required on its wire). */
function readLumiPersona(input: AdapterInput): Rec | null {
  const o = readJsonObject(input);
  if (!o) return null;
  if (typeof o.name !== "string" || typeof o.description !== "string") return null;
  if (typeof o.subjective_pronoun !== "string" || typeof o.objective_pronoun !== "string") return null;
  return o;
}

const adapter: PersonaAdapter = {
  id: "lumiverse-persona",
  label: "Lumiverse persona (account object)",
  outputExtensions: ["json"],
  kind: "persona",

  // 0.95: a Lumi persona also satisfies the ST character adapter's v1-card heuristic (name +
  // description), which bids 0.9 - the pronoun TRIPLET is the distinct signal that outbids it.
  detect(input: AdapterInput): number {
    return readLumiPersona(input) ? 0.95 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPersona {
    const w = readLumiPersona(input);
    if (!w) throw new Error("lumiverse-persona: not a recognizable Lumiverse persona");
    const body: PersonaBody = {
      name: w.name as string,
      content: w.description as string,
    };
    const tagline = str(w.title)?.trim();
    body.identity = {
      ...(tagline ? { tagline } : {}),
      pronounSet: {
        subjective: str(w.subjective_pronoun) ?? "",
        objective: str(w.objective_pronoun) ?? "",
        possessive: str(w.possessive_pronoun) ?? "",
      },
    };
    const book = str(w.attached_world_book_id);
    if (book) body.knowledgeRefs = [book];
    const avatar = str(w.avatar_path);
    if (avatar) body.presentation = { imageUrl: avatar };
    body.attribution = { source: "lumiverse" };
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "persona",
      id: canonicalId(body.name),
      body,
      original: { "lumiverse-persona": { raw: w } },
    };
  },

  fromCanonical(entity: CanonicalPersona): AdapterOutput {
    const twin = entity.original?.["lumiverse-persona"]?.raw;
    const base: Rec = isRec(twin) ? structuredClone(twin) : {};
    const b = entity.body;
    const out: Rec = {
      ...base,
      name: b.name,
      title: b.identity?.tagline ?? str(base.title) ?? "",
      description: b.content,
      subjective_pronoun: b.identity?.pronounSet?.subjective ?? str(base.subjective_pronoun) ?? "",
      objective_pronoun: b.identity?.pronounSet?.objective ?? str(base.objective_pronoun) ?? "",
      possessive_pronoun: b.identity?.pronounSet?.possessive ?? str(base.possessive_pronoun) ?? "",
      attached_world_book_id: b.knowledgeRefs?.[0] ?? null,
      avatar_path: b.presentation?.imageUrl ?? str(base.avatar_path) ?? null,
    };
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default adapter;
