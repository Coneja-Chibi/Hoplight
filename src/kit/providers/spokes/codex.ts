/**
 * ChatGPT through the Codex login already on this machine, so a subscription pays for the turn
 * instead of an API key.
 *
 * Keyless by design: the setup form must not ask for a key, because there isn't one to give. The
 * credential is whatever `codex login` left in `~/.codex/auth.json`, and if that is absent the spoke
 * refuses with the command to run rather than failing somewhere further down.
 *
 * THE RESPONSES API, NOT CHAT COMPLETIONS, and that is measured rather than assumed: this endpoint
 * answers 404 on `/chat/completions` and 200 on `/responses`. So this spoke builds the model through
 * `@ai-sdk/openai`'s responses adapter. Reaching for `@ai-sdk/openai-compatible` (the usual choice
 * for a new provider, and what the template suggests) yields a provider that cannot make one
 * successful call.
 *
 * Ordinary HTTP the whole way, which is why this still fits the same seam every other provider uses:
 * the guarded fetch locks the destination and the egress ledger counts what left. See codex-auth.ts
 * for the one wrinkle, a second host used only for token refresh.
 */
import type { ProviderSpoke } from "../spoke";
import type { ModelInfo } from "../models";
import { CODEX_CHAT_BASE, CODEX_CHAT_HOST, codexClientVersion, codexHeaders, readCodexAuth } from "../codex-auth";

/**
 * The models a ChatGPT subscription may drive here are the service's own, not OpenAI's public API
 * names: `gpt-5` and every `*-codex` id is refused outright. The live list is fetched below, so this
 * default only has to be a reasonable pre-fill for the setup form.
 */
const DEFAULT_MODEL = "gpt-5.6-sol";

const codex: ProviderSpoke = {
  id: "codex",
  label: "ChatGPT (Codex login)",
  brand: "#000000",
  host: CODEX_CHAT_HOST,
  defaultModel: DEFAULT_MODEL,
  keyless: true,
  async model({ model, headers }, fetch) {
    const [auth, clientVersion] = await Promise.all([readCodexAuth(), codexClientVersion()]);
    const [{ createOpenAI }, { defaultSettingsMiddleware, wrapLanguageModel }] = await Promise.all([
      import("@ai-sdk/openai"),
      import("ai"),
    ]);
    const provider = createOpenAI({
      apiKey: auth.accessToken,
      baseURL: CODEX_CHAT_BASE,
      headers: { ...codexHeaders(auth, clientVersion), ...headers },
      fetch,
    });
    /**
     * `store: false` is mandatory here, not a preference: the endpoint answers
     * "Store must be set to false" and refuses the call otherwise. It is a per-call provider option,
     * so it is pinned with the SDK's own settings middleware rather than by rewriting the request
     * body underneath the adapter.
     */
    return wrapLanguageModel({
      model: provider.responses(model || DEFAULT_MODEL),
      middleware: defaultSettingsMiddleware({ settings: { providerOptions: { openai: { store: false } } } }),
    });
  },
  /**
   * The endpoint answers with its own `{ models: [...] }` shape keyed on `slug`, not the OpenAI
   * `{ data }` list, so this cannot reuse openAICompatModels. `client_version` is required: without
   * it the request is a 400 rather than an empty list.
   */
  async listModels(_config, fetch) {
    const [auth, clientVersion] = await Promise.all([readCodexAuth(), codexClientVersion()]);
    const response = await fetch(
      `${CODEX_CHAT_BASE}/models?client_version=${encodeURIComponent(clientVersion)}`,
      { headers: { Authorization: `Bearer ${auth.accessToken}`, ...codexHeaders(auth, clientVersion) } },
    );
    if (!response.ok) return [];
    return readCodexModels(await response.json());
  },
};

/** Tolerant reader for the model payload: an unrecognised shape yields [], never a throw. */
export function readCodexModels(body: unknown): ModelInfo[] {
  const raw = (body as { models?: unknown } | null)?.models;
  if (!Array.isArray(raw)) return [];
  const models: ModelInfo[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = typeof record["slug"] === "string" ? record["slug"]
      : typeof record["id"] === "string" ? record["id"] : null;
    if (!id) continue;
    const context = record["context_window"];
    models.push(typeof context === "number" && context > 0 ? { id, context } : { id });
  }
  return models;
}

export default codex;
