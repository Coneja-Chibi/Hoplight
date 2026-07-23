/** OpenAI: native. */
import type { ProviderSpoke } from "../spoke";

const openai: ProviderSpoke = {
  id: "openai",
  label: "OpenAI",
  brand: "#10A37F",
  host: "api.openai.com",
  defaultModel: "gpt-4o",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createOpenAI } = await import("@ai-sdk/openai");
    return createOpenAI({ apiKey, baseURL, headers, fetch })(model);
  },
};

export default openai;
