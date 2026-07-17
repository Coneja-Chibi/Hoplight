/**
 * Pure Agnai ResponseSchema normalize.
 */
export interface SchemaField {
  name: string;
  type: string;
  description: string;
}

export interface ResponseSchemaValue {
  fields: SchemaField[];
  systemPrompt: string;
  jailbreak: string;
  history: string;
  imageCaption: string;
  response: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function normalizeSchema(raw: unknown): ResponseSchemaValue {
  const r =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const fields: SchemaField[] = [];
  if (Array.isArray(r.schema)) {
    for (const row of r.schema) {
      if (!row || typeof row !== "object") continue;
      const f = row as Record<string, unknown>;
      fields.push({
        name: str(f.name ?? f.key ?? f.id),
        type: str(f.type) || "string",
        description: str(f.description ?? f.desc ?? f.prompt),
      });
    }
  }
  return {
    fields,
    systemPrompt: str(r.systemPrompt),
    jailbreak: str(r.jailbreak),
    history: str(r.history),
    imageCaption: str(r.imageCaption),
    response: str(r.response),
  };
}

export function schemaToWire(v: ResponseSchemaValue): Record<string, unknown> {
  return {
    schema: v.fields.map((f) => ({
      name: f.name,
      type: f.type,
      description: f.description,
    })),
    systemPrompt: v.systemPrompt,
    jailbreak: v.jailbreak,
    history: v.history,
    imageCaption: v.imageCaption,
    response: v.response,
  };
}
