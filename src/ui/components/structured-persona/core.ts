/**
 * Pure normalize/mutate helpers for Agnai-style structured persona (kind + attributes).
 */
export type PersonaKind = "text" | "attributes" | "wpp" | "sbf" | "boostyle";

export const PERSONA_KINDS: readonly PersonaKind[] = [
  "text",
  "attributes",
  "wpp",
  "sbf",
  "boostyle",
];

export interface StructuredPersonaValue {
  kind: PersonaKind;
  attributes: Record<string, string[]>;
}

const isKind = (v: unknown): v is PersonaKind =>
  typeof v === "string" && (PERSONA_KINDS as readonly string[]).includes(v);

/** Tolerant read of a wire persona object. */
export function normalizePersona(raw: unknown): StructuredPersonaValue {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "text", attributes: { text: [""] } };
  }
  const r = raw as Record<string, unknown>;
  const kind: PersonaKind = isKind(r.kind) ? r.kind : "text";
  const attrs: Record<string, string[]> = {};
  if (r.attributes && typeof r.attributes === "object" && !Array.isArray(r.attributes)) {
    for (const [k, v] of Object.entries(r.attributes as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        attrs[k] = v.filter((x): x is string => typeof x === "string");
      } else if (typeof v === "string") {
        attrs[k] = [v];
      }
    }
  }
  if (kind === "text" && !attrs.text) attrs.text = [""];
  return { kind, attributes: attrs };
}

export function setKind(prev: StructuredPersonaValue, kind: PersonaKind): StructuredPersonaValue {
  if (kind === "text") {
    const text = prev.attributes.text?.[0] ?? firstAttrText(prev.attributes) ?? "";
    return { kind: "text", attributes: { text: [text] } };
  }
  const { text: _t, ...rest } = prev.attributes;
  return { kind, attributes: Object.keys(rest).length > 0 ? rest : { trait: [""] } };
}

const firstAttrText = (attrs: Record<string, string[]>): string => {
  for (const vals of Object.values(attrs)) {
    if (vals[0]) return vals[0];
  }
  return "";
};

export function setText(prev: StructuredPersonaValue, text: string): StructuredPersonaValue {
  return { kind: "text", attributes: { text: [text] } };
}

export function setAttributeKey(
  prev: StructuredPersonaValue,
  oldKey: string,
  newKey: string,
): StructuredPersonaValue {
  if (oldKey === newKey) return prev;
  const next: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(prev.attributes)) {
    if (k === oldKey) next[newKey || oldKey] = v;
    else next[k] = v;
  }
  return { ...prev, attributes: next };
}

export function setAttributeValues(
  prev: StructuredPersonaValue,
  key: string,
  values: string[],
): StructuredPersonaValue {
  return { ...prev, attributes: { ...prev.attributes, [key]: values } };
}

export function addAttribute(prev: StructuredPersonaValue): StructuredPersonaValue {
  let i = 1;
  let key = "trait";
  while (Object.hasOwn(prev.attributes, key)) {
    i += 1;
    key = `trait_${i}`;
  }
  return { ...prev, attributes: { ...prev.attributes, [key]: [""] } };
}

export function removeAttribute(prev: StructuredPersonaValue, key: string): StructuredPersonaValue {
  const next = { ...prev.attributes };
  delete next[key];
  return { ...prev, attributes: next };
}

/**
 * Canonical persona.structured: text is just { kind: "text" } (personality is the prose field);
 * attribute kinds keep their map. Callers that need the text body use the attributes.text draft
 * only while editing kind "text" in the UI.
 */
export function toWire(value: StructuredPersonaValue): Record<string, unknown> {
  if (value.kind === "text") {
    return { kind: "text" };
  }
  return { kind: value.kind, attributes: value.attributes };
}

/** Text body while editing kind "text" (sync to personality if the shell wants). */
export function textBody(value: StructuredPersonaValue): string {
  return value.attributes.text?.[0] ?? "";
}
