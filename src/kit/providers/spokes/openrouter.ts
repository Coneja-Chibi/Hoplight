/** OpenRouter: one key, many models. */
import type { ProviderSpoke } from "../spoke";

const openrouter: ProviderSpoke = {
  id: "openrouter",
  label: "OpenRouter",
  brand: "#94A3B8",
  host: "openrouter.ai",
  defaultModel: "anthropic/claude-opus-4-8",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    return createOpenRouter({ apiKey, baseURL, headers, fetch }).chat(model);
  },
};

export default openrouter;
