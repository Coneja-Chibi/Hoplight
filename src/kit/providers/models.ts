/**
 * Live model discovery: the shared core every spoke's listModels leans on. Transcribed from RC's
 * proven fetcher: an OpenAI-compatible URL ladder (detailed=true first so routers like NanoGPT
 * return context lengths), a tolerant payload parser that reads every wire shape RC saw in the wild
 * ({data:[...]}, bare arrays, Google's {models:[...]}), and broad context-length sniffing. Tolerant
 * readers: bad payloads yield [], never a throw. Fetches happen only through the egress-guarded
 * fetch a spoke is handed.
 */
import type { FetchFunction } from "@ai-sdk/provider-utils";

export interface ModelInfo {
  id: string;
  label?: string;
  context?: number;
}

/** The context-length field names seen across providers (RC's sniff list). */
const CONTEXT_KEYS = [
  "context_length",
  "context_window",
  "max_context_length",
  "max_tokens",
  "contextLength",
  "contextWindow",
  "inputTokenLimit",
] as const;

const contextOf = (record: Record<string, unknown>): number | undefined => {
  for (const key of CONTEXT_KEYS) {
    const value = record[key];
    if (typeof value === "number" && value > 0) return value;
  }
  return undefined;
};

const toModel = (value: unknown): ModelInfo | null => {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = typeof record["id"] === "string" ? record["id"] : typeof record["name"] === "string" ? record["name"] : "";
  if (!id) return null;
  const label =
    typeof record["display_name"] === "string"
      ? record["display_name"]
      : typeof record["displayName"] === "string"
        ? record["displayName"]
        : undefined;
  return { id, ...(label ? { label } : {}), ...(contextOf(record) !== undefined ? { context: contextOf(record) } : {}) };
};

/** Parse any known models-list wire shape into a deduped, sorted list. Garbage in, [] out. */
export function parseModelsPayload(payload: unknown): ModelInfo[] {
  const items = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && Array.isArray((payload as Record<string, unknown>)["data"])
      ? ((payload as Record<string, unknown>)["data"] as unknown[])
      : typeof payload === "object" && payload !== null && Array.isArray((payload as Record<string, unknown>)["models"])
        ? ((payload as Record<string, unknown>)["models"] as unknown[])
        : [];
  const seen = new Set<string>();
  const models: ModelInfo[] = [];
  for (const item of items) {
    const model = toModel(item);
    if (model && !seen.has(model.id)) {
      seen.add(model.id);
      models.push(model);
    }
  }
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/** The URL candidates for an OpenAI-compatible base, in RC's order: an explicit /models URL is used
 * as-is; a versioned base skips the /v1 insert; detailed=true is tried first for context lengths. */
export function modelsUrlLadder(rawBase: string): string[] {
  const base = rawBase.replace(/\/+$/, "").replace(/\/(chat\/completions|completions|messages)$/, "");
  if (/\/models(\?.*)?$/.test(base)) return [base];
  if (/\/v\d+[a-z]*$/.test(base)) return [`${base}/models?detailed=true`, `${base}/models`];
  return [`${base}/v1/models?detailed=true`, `${base}/v1/models`, `${base}/models`];
}

/** Walk the ladder until a URL yields models. 401/403 means the key is bad; stop, do not hammer. */
export async function openAICompatModels(
  base: string,
  apiKey: string | undefined,
  fetchFn: FetchFunction,
): Promise<ModelInfo[]> {
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  for (const url of modelsUrlLadder(base)) {
    try {
      const response = await fetchFn(url, { headers });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return [];
        continue;
      }
      const models = parseModelsPayload(await response.json());
      if (models.length > 0) return models;
    } catch {
      // unreachable URL or bad JSON: try the next rung
    }
  }
  return [];
}

/** "128K" / "1M" chips for the picker, RC-style. */
export function formatContext(context: number | undefined): string {
  if (!context || context <= 0) return "";
  if (context >= 1_000_000) return `${Math.round(context / 1_000_000)}M`;
  if (context >= 1_000) return `${Math.round(context / 1_000)}K`;
  return String(context);
}
