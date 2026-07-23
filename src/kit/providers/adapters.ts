/**
 * The provider spokes: one config kind to one AI SDK language model, lazy-loaded so only the
 * provider the user picked is ever imported. Every adapter is handed the egress-guarded fetch, so
 * the request cannot reach any host but the configured one. openai-compatible swallows OpenAI-style
 * proxies, local servers, and anything with a base URL; the natives cover the vendors that differ.
 */
import type { LanguageModel } from "ai";
import { type ProviderConfig } from "./config";
import { assertConfigured, guardedFetch } from "./egress";

/** Build the AI SDK model for a config, wiring the guarded fetch. Throws (fail-closed) if unset. */
export async function buildModel(config: ProviderConfig | null): Promise<LanguageModel> {
  assertConfigured(config);
  const fetch = guardedFetch(config);
  const { apiKey, baseURL, headers, model } = config;

  switch (config.kind) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey, baseURL, headers, fetch })(model);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey, baseURL, headers, fetch })(model);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey, baseURL, headers, fetch })(model);
    }
    case "groq": {
      const { createGroq } = await import("@ai-sdk/groq");
      return createGroq({ apiKey, baseURL, headers, fetch })(model);
    }
    case "mistral": {
      const { createMistral } = await import("@ai-sdk/mistral");
      return createMistral({ apiKey, baseURL, headers, fetch })(model);
    }
    case "openrouter": {
      const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
      return createOpenRouter({ apiKey, baseURL, headers, fetch }).chat(model);
    }
    case "openai-compatible": {
      const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
      return createOpenAICompatible({
        name: config.name ?? "custom",
        baseURL: baseURL ?? "",
        apiKey,
        headers,
        fetch,
      })(model);
    }
  }
}
