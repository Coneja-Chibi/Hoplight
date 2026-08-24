/** DeepSeek: OpenAI-compatible endpoint at a fixed base. */
import type { ProviderSpoke } from "../spoke";
import { openAICompatModels } from "../models";

const deepseek: ProviderSpoke = {
  id: "deepseek",
  label: "DeepSeek",
  brand: "#4D6BFE",
  host: "api.deepseek.com",
  defaultModel: "deepseek-chat",
  // DeepSeek's reasoner REQUIRES thinking to be passed back: its API rejects a history whose
  // assistant turns lack the reasoning_content they originally carried.
  reasoningEcho: true,
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return createOpenAICompatible({
      name: "deepseek",
      baseURL: baseURL ?? "https://api.deepseek.com/v1",
      apiKey,
      headers,
      fetch,
    })(model);
  },
  async listModels({ apiKey, baseURL }, fetch) {
    return openAICompatModels(baseURL ?? "https://api.deepseek.com/v1", apiKey, fetch);
  },
};

export default deepseek;
