/**
 * Static fallback table of context-window sizes for the familiar ENV_PROVIDERS models: the third and
 * last tier of Max-Context Resolution, below the persisted ProviderConfig.context and the live sniff
 * (models.ts contextOf) the settings screen does at connect. Best-effort only; a model absent from
 * the table returns undefined, which the meter renders as count-only (deny by absence, never a fake
 * denominator). Pure: a string in, a number-or-undefined out, no I/O.
 */

// Keyed by lowercase model id. Values are the model's advertised context window in tokens. Only the
// ENV_PROVIDERS defaults (providers/config.ts) are pinned here; the live sniff covers everything else.
const CONTEXT_BY_MODEL: Readonly<Record<string, number>> = {
  "claude-opus-4-8": 1_000_000,
  "gpt-4o": 128_000,
  "chatgpt-4o-latest": 128_000,
  "llama-3.3-70b-versatile": 131_072,
  "mistral-large-latest": 131_072,
  "deepseek-chat": 65_536,
  "gemini-2.5-pro": 1_048_576,
};

/** The known context window for a model id, or undefined. Tries the id, then its last path segment
 * (so an OpenRouter-style "anthropic/claude-opus-4-8" resolves via "claude-opus-4-8"). */
export const knownContext = (modelId: string | undefined): number | undefined => {
  if (typeof modelId !== "string" || modelId.length === 0) return undefined;
  const id = modelId.trim().toLowerCase();
  return CONTEXT_BY_MODEL[id] ?? CONTEXT_BY_MODEL[id.slice(id.lastIndexOf("/") + 1)];
};
