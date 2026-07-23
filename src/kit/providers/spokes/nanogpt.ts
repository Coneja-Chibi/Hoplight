/** NanoGPT: pay-as-you-go access to many models through one OpenAI-compatible endpoint. */
import type { ProviderSpoke } from "../spoke";

const nanogpt: ProviderSpoke = {
  id: "nanogpt",
  label: "NanoGPT",
  brand: "#34D399",
  host: "nano-gpt.com",
  defaultModel: "chatgpt-4o-latest",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return createOpenAICompatible({
      name: "nanogpt",
      baseURL: baseURL ?? "https://nano-gpt.com/api/v1",
      apiKey,
      headers,
      fetch,
    })(model);
  },
};

export default nanogpt;
