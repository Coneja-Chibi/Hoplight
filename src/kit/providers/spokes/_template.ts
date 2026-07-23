/**
 * COPY THIS FILE to add a provider. Rename it to the provider's id, set id/label/brand, and either
 * point `model` at the vendor's own @ai-sdk adapter (native) or at @ai-sdk/openai-compatible with a
 * base URL. Nothing central to edit: registry.ts discovers this folder, and the setup screen reads
 * the label and brand from here. Files starting with "_" (like this one) are skipped.
 */
import type { ProviderSpoke } from "../spoke";

const example: ProviderSpoke = {
  id: "example",
  label: "Example Provider",
  brand: "#888888",
  // Fixed host for the egress allowlist; omit it if the user supplies the base URL (like custom).
  host: "api.example.com",
  defaultModel: "example-model",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    // Native adapter:
    //   const { createExample } = await import("@ai-sdk/example");
    //   return createExample({ apiKey, baseURL, headers, fetch })(model);
    // Or OpenAI-compatible (covers most new providers):
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return createOpenAICompatible({
      name: "example",
      baseURL: baseURL ?? "https://api.example.com/v1",
      apiKey,
      headers,
      fetch,
    })(model);
  },
};

export default example;
