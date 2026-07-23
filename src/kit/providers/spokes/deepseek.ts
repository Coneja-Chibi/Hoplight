/** DeepSeek: OpenAI-compatible endpoint at a fixed base. */
import type { ProviderSpoke } from "../spoke";

const deepseek: ProviderSpoke = {
  id: "deepseek",
  label: "DeepSeek",
  brand: "#4D6BFE",
  host: "api.deepseek.com",
  defaultModel: "deepseek-chat",
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
};

export default deepseek;
