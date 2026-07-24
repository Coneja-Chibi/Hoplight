/** Mistral AI: native. */
import type { ProviderSpoke } from "../spoke";
import { openAICompatModels } from "../models";

const mistral: ProviderSpoke = {
  id: "mistral",
  label: "Mistral AI",
  brand: "#FA500F",
  host: "api.mistral.ai",
  defaultModel: "mistral-large-latest",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createMistral } = await import("@ai-sdk/mistral");
    return createMistral({ apiKey, baseURL, headers, fetch })(model);
  },
  async listModels({ apiKey, baseURL }, fetch) {
    return openAICompatModels(baseURL ?? "https://api.mistral.ai/v1", apiKey, fetch);
  },
};

export default mistral;
