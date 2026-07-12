/**
 * The persona injection compiler (PERSONA-JEWEL-PLAN.md P2): a faithful port of RoleCall's
 * `generatePersonaXml` (apps/rc/src/lib/personas/generatePersonaXml.ts - RC is Chi's own code,
 * reuse is free), retargeted from RC's PersonaDetails onto the canonical PersonaBody.
 *
 * Ported behaviors, verbatim by intent:
 * - identity ALWAYS first (pronouns/title/height/age), never part of sectionOrder;
 * - palette colors emit as top-level tags named from their LABEL ("Name (#hex)" values);
 * - sections render FLAT in sectionOrder (appearance/personality+traits/quirks/history; "body"
 *   folds into appearance), runs of newlines condensed to single newlines;
 * - user-authored XML inside text is PRESERVED while everything else is escaped (the nonce
 *   placeholder dance) - except the nonce here is injected for determinism (purity contract);
 * - the optional wrapper text (RC injection_prefix) is prepended as its own line.
 *
 * THE FAMILY LANDMINE: `brief` NEVER enters this compiler. Only `content`/sections/identity/
 * presentation are injectable. compileSections() is the sections -> flat-content twin used by
 * codecs whose wire has no structured sections.
 */
import type { PersonaBody, PersonaSections } from "../../entities/persona/schema";
import { SECTION_ORDER_DEFAULT } from "../../entities/persona/schema";

/** Label string -> a valid XML tag name (RC's toXmlTagName, ported). ONE deviation: a label of
 *  pure whitespace/punctuation yields "" (no tag) - RC would emit a garbage `<_>` tag there. */
export function toXmlTagName(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+$/, "");
}

const XML_TAG_PATTERN = /<\/?[\w-]+(?:\s+[\w-]+(?:="[^"]*")?)*\s*\/?>/g;

/**
 * Escape XML content while PRESERVING user-authored tags (RC's escapeXml, ported). `nonce` is
 * injected so the compiler stays pure and deterministic (RC used Math.random; tests need
 * byte-stable output). Any collision-resistant caller string works - the default suffices
 * because the placeholder alphabet (\x00) cannot appear in persona text that survived JSON.
 */
export function escapeXml(str: string, nonce = "vaud"): string {
  let result = str.replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, "&amp;");

  const tags: { placeholder: string; original: string }[] = [];
  let counter = 0;
  result = result.replace(XML_TAG_PATTERN, (match) => {
    const placeholder = `\x00XMLTAG_${nonce}_${counter}\x00`;
    tags.push({ placeholder, original: match });
    counter++;
    return placeholder;
  });

  result = result
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  for (const { placeholder, original } of tags) {
    result = result.replace(placeholder, () => original);
  }
  return result;
}

/** Condense runs of newlines to single newlines and trim (RC's per-section cleanup). */
const condense = (s: string): string => s.replace(/\n+/g, "\n").trim();

export interface InjectOptions {
  /** Indentation unit (RC default: two spaces). */
  indent?: string;
}

/**
 * Compile a canonical persona into the injected XML block (the {{user}} identity the model
 * sees). Pure; the live preview MUST render exactly this output (engine truth).
 */
export function injectPersonaXml(body: PersonaBody, opts: InjectOptions = {}): string {
  const indent = opts.indent ?? "  ";
  const i1 = indent;
  const i2 = indent + indent;
  const lines: string[] = [];

  const identity = body.identity ?? {};
  const sections = body.sections ?? {};
  const order = body.sectionOrder && body.sectionOrder.length > 0
    ? body.sectionOrder
    : [...SECTION_ORDER_DEFAULT];

  lines.push(`<persona name="${escapeXml(body.name)}">`);

  // identity - ALWAYS FIRST, never part of sectionOrder (RC rule)
  const pronounText =
    identity.pronouns ??
    (identity.pronounSet
      ? `${identity.pronounSet.subjective}/${identity.pronounSet.objective}/${identity.pronounSet.possessive}`
      : undefined);
  const hasIdentity = pronounText || identity.tagline || identity.height || identity.age;
  if (hasIdentity) {
    lines.push(`${i1}<identity>`);
    if (pronounText) lines.push(`${i2}<pronouns>${escapeXml(pronounText)}</pronouns>`);
    if (identity.tagline) lines.push(`${i2}<title>${escapeXml(identity.tagline)}</title>`);
    if (identity.height) lines.push(`${i2}<height>${escapeXml(identity.height)}</height>`);
    if (identity.age) lines.push(`${i2}<age>${escapeXml(identity.age)}</age>`);
    lines.push(`${i1}</identity>`);
  }

  for (const section of order) {
    switch (section) {
      case "appearance": {
        // palette colors first, as top-level tags named from their labels (RC rule)
        for (const color of body.presentation?.colors ?? []) {
          if (!color.label || !color.name) continue;
          const tagName = toXmlTagName(color.label);
          if (!tagName) continue;
          const value = color.hex ? `${color.name} (${color.hex})` : color.name;
          lines.push(`${i1}<${tagName}>${escapeXml(value)}</${tagName}>`);
        }
        const appearance = [sections.appearance, sections.body]
          .filter((s): s is string => typeof s === "string" && s.trim() !== "")
          .join("\n");
        if (appearance) lines.push(`${i1}<appearance>${escapeXml(condense(appearance))}</appearance>`);
        break;
      }
      case "body":
        break; // folded into appearance (RC rule)
      case "personality": {
        if (sections.personality?.trim()) {
          lines.push(`${i1}<personality>${escapeXml(condense(sections.personality))}</personality>`);
        }
        if (body.traits && body.traits.length > 0) {
          lines.push(`${i1}<traits>${body.traits.map((t) => escapeXml(t)).join(", ")}</traits>`);
        }
        break;
      }
      case "quirks":
        if (sections.quirks?.trim()) {
          lines.push(`${i1}<quirks>${escapeXml(condense(sections.quirks))}</quirks>`);
        }
        break;
      case "history":
        if (sections.history?.trim()) {
          lines.push(`${i1}<history>${escapeXml(condense(sections.history))}</history>`);
        }
        break;
      default:
        break; // unknown section names are codec territory, never invented here
    }
  }

  // flat content (personas authored without sections) rides as the body text
  if (body.content.trim() !== "" && !hasAnySection(sections)) {
    lines.push(`${i1}${escapeXml(condense(body.content))}`);
  }

  lines.push("</persona>");

  const xml = lines.join("\n");
  const wrapper = body.chatInjection?.wrapper?.trim();
  return wrapper ? `${wrapper}\n${xml}` : xml;
}

function hasAnySection(sections: PersonaSections): boolean {
  return Object.values(sections).some((s) => typeof s === "string" && s.trim() !== "");
}

/**
 * Sections -> flat content in sectionOrder (the codecs' serialize-time compile for wires with no
 * structured sections). Plain-text headings, never XML - the flat wires are prose.
 */
export function compileSections(body: PersonaBody): string {
  const sections = body.sections ?? {};
  const order = body.sectionOrder && body.sectionOrder.length > 0
    ? body.sectionOrder
    : [...SECTION_ORDER_DEFAULT];
  const parts: string[] = [];
  for (const key of order) {
    const text = (sections as Record<string, string | undefined>)[key];
    if (typeof text === "string" && text.trim() !== "") parts.push(text.trim());
  }
  return parts.join("\n\n");
}
