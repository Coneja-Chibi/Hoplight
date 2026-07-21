/**
 * RoleCall persona codec (kind "persona"): the two shapes real RC users produce today.
 *  1. `rcpersona` - the native lossless envelope { spec: "rolecall_persona", spec_version, data }.
 *  2. The production export shape - a chara_card_v2 lookalike whose `extensions.rolecall.type` is
 *     the literal "persona" (this is what RC's live export route emits, and the discriminator that
 *     keeps it out of the CHARACTER codecs' hands).
 * Field maps from specs/formats/personas.md, pinned by RC's own persona-roundtrip tests (RC is ours;
 * reuse is free). The load-bearing rule: `brief` (short blurb) and `content` (injected {{user}} text)
 * must never swap - every source has some short/long split and swapping them was a live RC bug.
 * Lossless: the whole original rides in original; unedited fields re-emit from the twin.
 */
import type { PersonaAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalPersona,
  PersonaBody,
  PersonaSections,
} from "../../entities/persona/schema";
import { SECTION_ORDER_DEFAULT } from "../../entities/persona/schema";
import type { ContentRating, Swatch } from "../../entities/character/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readCardJson } from "../_shared/card-io";
import { CARD_SPEC_V2, CARD_SPEC_V3 } from "../_shared/tavern-fields";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const nonEmpty = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v : undefined;

export const PERSONA_SPEC = "rolecall_persona";

// -- envelope unwrapping (two legacy wrapper layers, OUTER first - order matters) -------------------

/** Peel { exportedAt, type, data } then { persona } wrappers; returns the innermost object. */
export function unwrapPersonaJson(v: unknown): Rec | null {
  if (!isRec(v)) return null;
  let o: Rec = v;
  if (isRec(o.data) && ("exportedAt" in o || "type" in o) && o.spec === undefined) o = o.data;
  if (isRec(o.persona)) o = o.persona as Rec;
  return o;
}

// -- shape detection --------------------------------------------------------------------------------

type Shape = "rcpersona" | "rc-v2-export";

/** The V2-card side-channel block, when this card is an RC PERSONA export (type discriminator). */
function personaRcExt(card: Rec): Rec | null {
  if (card.spec !== CARD_SPEC_V2 && card.spec !== CARD_SPEC_V3) return null;
  if (!isRec(card.data)) return null;
  const ext = (card.data as Rec).extensions;
  if (!isRec(ext) || !isRec(ext.rolecall)) return null;
  return (ext.rolecall as Rec).type === "persona" ? (ext.rolecall as Rec) : null;
}

function detectShape(v: unknown): { shape: Shape; root: Rec } | null {
  const root = unwrapPersonaJson(v);
  if (!root) return null;
  if (root.spec === PERSONA_SPEC && isRec(root.data)) return { shape: "rcpersona", root };
  if (personaRcExt(root)) return { shape: "rc-v2-export", root };
  return null;
}

// -- shared bits ------------------------------------------------------------------------------------

const RATING_IN: Record<string, ContentRating> = { all_hours: "all-ages", after_dark: "explicit" };

/** Compile sections into flat content text, fixed order, "<Label>: <text>" blocks (RC's own rule). */
export function compileSections(s: PersonaSections): string {
  const label: Record<string, string> = {
    appearance: "Appearance",
    body: "Body",
    personality: "Personality",
    quirks: "Quirks",
    history: "History",
  };
  return SECTION_ORDER_DEFAULT.filter((k) => nonEmpty(s[k]))
    .map((k) => `${label[k]}: ${s[k]}`)
    .join("\n\n");
}

function readSections(v: unknown): PersonaSections | undefined {
  if (!isRec(v)) return undefined;
  const out: PersonaSections = {};
  for (const k of SECTION_ORDER_DEFAULT) if (nonEmpty(v[k])) out[k] = v[k] as string;
  return Object.keys(out).length > 0 ? out : undefined;
}

const strList = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : undefined;

// -- shape 1: rcpersona envelope <-> canonical ------------------------------------------------------

function rcpersonaToBody(data: Rec): PersonaBody {
  const sections = readSections(data.sections);
  const content = nonEmpty(data.content) ?? (sections ? compileSections(sections) : "");
  const meta = isRec(data.metadata) ? data.metadata : {};
  const rating = typeof meta.content_rating === "string" ? RATING_IN[meta.content_rating] : undefined;
  return {
    name: str(data.name) ?? "",
    brief: nonEmpty(data.description),
    content,
    sections,
    traits: undefined, // metadata.tags is a related-but-separate concept (open question); it rides original
    attribution:
      meta.creator || meta.version || meta.created_at || meta.source
        ? {
            creator: str(meta.creator),
            version: str(meta.version),
            createdAt: str(meta.created_at),
            source: str(meta.source),
          }
        : undefined,
    rating,
  };
}

const RATING_OUT: Record<ContentRating, string> = {
  "all-ages": "all_hours",
  mature: "after_dark", // rcpersona has no middle tier; mature narrows to after_dark (documented loss)
  explicit: "after_dark",
};

function bodyToRcpersona(b: PersonaBody, twin: Rec | undefined): Rec {
  const base: Rec = twin ? (structuredClone(twin) as Rec) : { spec: PERSONA_SPEC, spec_version: "1.0" };
  const data: Rec = isRec(base.data) ? (base.data as Rec) : {};
  base.data = data;
  data.name = b.name;
  if (b.brief !== undefined) data.description = b.brief;
  data.content = b.content || (b.sections ? compileSections(b.sections) : "");
  if (b.sections) data.sections = { ...b.sections };
  const meta: Rec = isRec(data.metadata) ? (data.metadata as Rec) : {};
  if (b.attribution?.creator !== undefined) meta.creator = b.attribution.creator;
  if (b.attribution?.version !== undefined) meta.version = b.attribution.version;
  if (b.attribution?.createdAt !== undefined) meta.created_at = b.attribution.createdAt;
  if (b.attribution?.source !== undefined) meta.source = b.attribution.source;
  if (b.rating !== undefined) meta.content_rating = RATING_OUT[b.rating];
  if (Object.keys(meta).length > 0) data.metadata = meta;
  return base;
}

// -- shape 2: RC V2-export card <-> canonical -------------------------------------------------------

/**
 * Reverse RC's description fold: paragraphs prefixed "Appearance:" / "Body:" split out to sections,
 * the rest (order preserved) is the content. Lossy by construction for content that legitimately
 * starts with those literals - inherited from the live RC implementation, replicated exactly.
 */
export function unfoldDescription(desc: string): { content: string; appearance?: string; body?: string } {
  const parts = desc.split(/\n{2,}/);
  const contentParts: string[] = [];
  let appearance: string | undefined;
  let body: string | undefined;
  for (const p of parts) {
    const a = /^Appearance:\s*/.exec(p);
    const bm = /^Body:\s*/.exec(p);
    if (a && appearance === undefined) appearance = p.slice(a[0].length);
    else if (bm && body === undefined) body = p.slice(bm[0].length);
    else contentParts.push(p);
  }
  return { content: contentParts.join("\n\n"), appearance, body };
}

function v2ExportToBody(card: Rec): PersonaBody {
  const data = card.data as Rec;
  const rc = personaRcExt(card)!;
  const unfolded = unfoldDescription(str(data.description) ?? "");

  const sections: PersonaSections = {};
  if (unfolded.appearance !== undefined) sections.appearance = unfolded.appearance;
  if (unfolded.body !== undefined) sections.body = unfolded.body;
  if (nonEmpty(data.personality)) sections.personality = data.personality as string;
  if (nonEmpty(data.scenario)) sections.history = data.scenario as string;
  if (nonEmpty(rc.quirks)) sections.quirks = rc.quirks as string;

  const colors = Array.isArray(rc.colors)
    ? (rc.colors as Rec[]).filter(isRec).map(
        (c): Swatch => ({ label: str(c.label), name: str(c.name), hex: str(c.hex) ?? "" }),
      )
    : undefined;

  return {
    name: str(data.name) ?? "",
    brief: nonEmpty(data.creator_notes),
    content: unfolded.content,
    sections: Object.keys(sections).length > 0 ? sections : undefined,
    sectionOrder: strList(rc.section_order),
    traits: strList(data.tags),
    identity:
      rc.tagline || rc.age || rc.height || rc.pronouns
        ? { tagline: str(rc.tagline), age: str(rc.age), height: str(rc.height), pronouns: str(rc.pronouns) }
        : undefined,
    presentation:
      rc.signature_color || colors || rc.image_url
        ? { signatureColor: str(rc.signature_color), colors, imageUrl: str(rc.image_url) }
        : undefined,
    knowledgeRefs: nonEmpty(rc.lorebook_id) ? [rc.lorebook_id as string] : undefined,
    rating: rc.is_after_dark === true ? "explicit" : "all-ages",
  };
}

/** Fold content + appearance/body sections back into the single V2 description slot (RC's own fold). */
function foldDescription(b: PersonaBody): string {
  const parts = [b.content];
  if (nonEmpty(b.sections?.appearance)) parts.push(`Appearance: ${b.sections!.appearance}`);
  if (nonEmpty(b.sections?.body)) parts.push(`Body: ${b.sections!.body}`);
  return parts.filter((p) => p.length > 0).join("\n\n");
}

function bodyToV2Export(b: PersonaBody, twin: Rec): Rec {
  const card = structuredClone(twin) as Rec;
  const data = card.data as Rec;
  const ext = data.extensions as Rec;
  const rc = ext.rolecall as Rec;
  const decoded = v2ExportToBody(twin);

  // Twin-diff: guard each write against the twin's own decode so an unedited card re-emits byte-true.
  // foldDescription is lossy, so the description is kept verbatim unless the fields that fold INTO it
  // (content / appearance / body) actually changed. The V2 slots below are standard card fields the
  // twin always carries, so a cleared section writes "" (V2 convention) rather than deleting the key.
  if (b.name !== decoded.name) data.name = b.name;
  if (
    b.content !== decoded.content ||
    b.sections?.appearance !== decoded.sections?.appearance ||
    b.sections?.body !== decoded.sections?.body
  ) {
    data.description = foldDescription(b);
  }
  if (b.sections?.personality !== decoded.sections?.personality) {
    data.personality = b.sections?.personality ?? "";
  }
  if (b.sections?.history !== decoded.sections?.history) {
    data.scenario = b.sections?.history ?? "";
  }
  if (b.brief !== decoded.brief) data.creator_notes = b.brief ?? "";
  if (b.traits !== undefined) data.tags = b.traits;

  const setRc = (k: string, v: unknown): void => {
    if (v !== undefined) rc[k] = v;
  };
  setRc("tagline", b.identity?.tagline);
  setRc("age", b.identity?.age);
  setRc("height", b.identity?.height);
  setRc("pronouns", b.identity?.pronouns);
  setRc("quirks", b.sections?.quirks);
  setRc("signature_color", b.presentation?.signatureColor);
  if (b.presentation?.colors) {
    rc.colors = b.presentation.colors.map((c) => ({ hex: c.hex, name: c.name, label: c.label }));
  }
  setRc("section_order", b.sectionOrder);
  setRc("image_url", b.presentation?.imageUrl);
  setRc("lorebook_id", b.knowledgeRefs?.[0]);
  // wire habit: is_after_dark is OMITTED (not false) when not explicit
  if (b.rating === "explicit" || b.rating === "mature") rc.is_after_dark = true;
  else delete rc.is_after_dark;
  return card;
}

// -- adapter ----------------------------------------------------------------------------------------

const adapter: PersonaAdapter = {
  id: "rolecall-persona",
  label: "RoleCall persona (rcpersona / RC persona-card export)",
  outputExtensions: ["json"],
  kind: "persona",

  // 1.0 on both shapes: the rolecall_persona spec tag and the type:"persona" discriminator are
  // unambiguous. The RC/ST CHARACTER adapters explicitly step aside for the discriminator (firewall).
  detect(input: AdapterInput): number {
    return detectShape(readCardJson(input)) ? 1 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPersona {
    const json = readCardJson(input);
    const det = json ? detectShape(json) : null;
    if (!det) throw new Error("rolecall-persona: not an RC persona (no rcpersona spec or persona-type card)");
    const body =
      det.shape === "rcpersona" ? rcpersonaToBody(det.root.data as Rec) : v2ExportToBody(det.root);
    if (!body.name) throw new Error("rolecall-persona: persona has no name (required, never synthesized)");
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "persona",
      id: canonicalId(body.name),
      body,
      original: { "rolecall-persona": { raw: det.root, unmapped: { shape: det.shape } } },
    };
  },

  fromCanonical(entity: CanonicalPersona): AdapterOutput {
    const esc = entity.original?.["rolecall-persona"];
    const raw = isRec(esc?.raw) ? (esc.raw as Rec) : undefined;
    const shape = esc?.unmapped?.["shape"];
    // Same-shape round-trip re-emits the source shape from its twin; anything else (cross-format,
    // authored fresh) emits the native lossless rcpersona envelope.
    const out =
      shape === "rc-v2-export" && raw
        ? bodyToV2Export(entity.body, raw)
        : bodyToRcpersona(entity.body, shape === "rcpersona" ? raw : undefined);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default adapter;
