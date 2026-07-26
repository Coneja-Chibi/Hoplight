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
    const out: Rec = isRec(twin) ? structuredClone(twin) : {}; // folder/narrator/metadata/timestamps ride sealed
    const b = entity.body;

    // Twin-diff: write a mapped key back only when canonical drifts from the twin's own decode, and
    // never materialize a default for an optional field absent from both sides. possessive_pronoun is
    // the crux here: detect requires only subjective/objective, so it is the one pronoun that can be
    // genuinely absent, and comparing "" against "" keeps it absent rather than fabricating it.
    if (b.name !== str(out.name)) out.name = b.name;
    if (!("description" in out) || b.content !== (str(out.description) ?? "")) {
      out.description = b.content;
    }

    const twinTitle = str(out.title)?.trim() || undefined; // decoded trimmed; wire keeps whitespace
    const liveTitle = b.identity?.tagline;
    if (liveTitle !== twinTitle) {
      if (liveTitle !== undefined) out.title = liveTitle;
      else delete out.title;
    }

    const pronoun = (key: string, live: string, required = false): void => {
      if ((required && !(key in out)) || live !== (str(out[key]) ?? "")) out[key] = live;
    };
    const set = b.identity?.pronounSet;
    // These two keys are the format discriminator and are required even for a from-scratch export.
    pronoun("subjective_pronoun", set?.subjective ?? "", true);
    pronoun("objective_pronoun", set?.objective ?? "", true);
    pronoun("possessive_pronoun", set?.possessive ?? "");

    const twinBook = str(out.attached_world_book_id) || undefined;
    const liveBook = b.knowledgeRefs?.[0];
    if (liveBook !== twinBook) {
      if (liveBook !== undefined) out.attached_world_book_id = liveBook;
      else delete out.attached_world_book_id;
    }

    const twinAvatar = str(out.avatar_path) || undefined;
    const liveAvatar = b.presentation?.imageUrl;
    if (liveAvatar !== twinAvatar) {
      if (liveAvatar !== undefined) out.avatar_path = liveAvatar;
      else delete out.avatar_path;
    }

    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default adapter;
