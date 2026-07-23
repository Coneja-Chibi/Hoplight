/** Groq: native, very fast inference. */
import type { ProviderSpoke } from "../spoke";

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
};

export default groq;
