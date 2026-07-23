/** Mistral AI: native. */
import type { ProviderSpoke } from "../spoke";

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
};

export default mistral;
