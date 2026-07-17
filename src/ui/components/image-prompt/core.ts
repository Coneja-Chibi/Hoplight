/**
 * Pure normalize/emit for canonical ImagePrompt (persona.imagePrompt).
 * Affixes + full prompt text + labeled rows (Agnai + Risu coverage in one shape).
 */
export interface ImagePromptValue {
  prompt: string;
  prefix: string;
  suffix: string;
  negative: string;
  template: string;
  instructions: string;
  emotionInstructions: string;
  rows: { label: string; value: string }[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function normalizeImagePrompt(raw: unknown): ImagePromptValue {
  const r =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const rows: { label: string; value: string }[] = [];
  if (Array.isArray(r.rows)) {
    for (const row of r.rows) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      rows.push({ label: str(o.label), value: str(o.value) });
    }
  }
  return {
    prompt: str(r.prompt),
    prefix: str(r.prefix),
    suffix: str(r.suffix),
    negative: str(r.negative),
    template: str(r.template),
    instructions: str(r.instructions),
    emotionInstructions: str(r.emotionInstructions),
    rows,
  };
}

/** Emit canonical ImagePrompt; omit empty leaves. */
export function imagePromptToCanonical(v: ImagePromptValue): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (v.prompt) out.prompt = v.prompt;
  if (v.prefix) out.prefix = v.prefix;
  if (v.suffix) out.suffix = v.suffix;
  if (v.negative) out.negative = v.negative;
  if (v.template) out.template = v.template;
  if (v.instructions) out.instructions = v.instructions;
  if (v.emotionInstructions) out.emotionInstructions = v.emotionInstructions;
  const rows = v.rows.filter((r) => r.label || r.value);
  if (rows.length > 0) out.rows = rows;
  return Object.keys(out).length > 0 ? out : undefined;
}
