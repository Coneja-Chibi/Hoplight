/** OpenRouter: one key, many models. */
import type { ProviderSpoke } from "../spoke";
import { openAICompatModels } from "../models";

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
  async listModels({ apiKey, baseURL }, fetch) {
    return openAICompatModels(baseURL ?? "https://openrouter.ai/api/v1", apiKey, fetch);
  },
};

export default openrouter;
