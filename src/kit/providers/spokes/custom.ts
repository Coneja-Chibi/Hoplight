/** Custom (OpenAI-compatible): any proxy or endpoint the user pastes a base URL for. */
import type { ProviderSpoke } from "../spoke";
import { openAICompatModels } from "../models";

const custom: ProviderSpoke = {
  id: "custom",
  label: "Custom (OpenAI-compatible)",
  brand: "#E11D48",
  // No fixed host: the egress allowlist is the user's base URL.
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return createOpenAICompatible({
      name: "custom",
      baseURL: baseURL ?? "",
      apiKey,
      headers,
      fetch,
    })(model);
  },
  async listModels({ apiKey, baseURL }, fetch) {
    if (!baseURL) return [];
    return openAICompatModels(baseURL, apiKey, fetch);
  },
};

export default custom;
