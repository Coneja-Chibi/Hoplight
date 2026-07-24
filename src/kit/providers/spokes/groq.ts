/** Groq: native, very fast inference. */
import type { ProviderSpoke } from "../spoke";
import { openAICompatModels } from "../models";

const groq: ProviderSpoke = {
  id: "groq",
  label: "Groq",
  brand: "#F55036",
  host: "api.groq.com",
  defaultModel: "llama-3.3-70b-versatile",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createGroq } = await import("@ai-sdk/groq");
    return createGroq({ apiKey, baseURL, headers, fetch })(model);
  },
  async listModels({ apiKey, baseURL }, fetch) {
    return openAICompatModels(baseURL ?? "https://api.groq.com/openai/v1", apiKey, fetch);
  },
};

export default groq;
