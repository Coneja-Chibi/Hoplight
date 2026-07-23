/** Local (Ollama / LM Studio): an OpenAI-compatible server on your machine. Keyless, zero egress. */
import type { ProviderSpoke } from "../spoke";

const local: ProviderSpoke = {
  id: "local",
  label: "Local (Ollama / LM Studio)",
  brand: "#5AD07A",
  // No fixed host: the egress allowlist is derived from the user's base URL (localhost).
  defaultModel: "llama3.1",
  keyless: true,
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return createOpenAICompatible({
      name: "local",
      baseURL: baseURL ?? "http://localhost:11434/v1",
      apiKey,
      headers,
      fetch,
    })(model);
  },
};

export default local;
