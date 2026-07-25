/** Anthropic (Claude): native Messages API. */
import type { ProviderSpoke } from "../spoke";
import { parseModelsPayload } from "../models";

const anthropic: ProviderSpoke = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  brand: "#DE7356",
  host: "api.anthropic.com",
  defaultModel: "claude-opus-4-8",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    return createAnthropic({ apiKey, baseURL, headers, fetch })(model);
  },
  async listModels({ apiKey }, fetch) {
    const response = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
      headers: { "x-api-key": apiKey ?? "", "anthropic-version": "2023-06-01" },
    });
    if (!response.ok) return [];
    return parseModelsPayload(await response.json());
  },
};

export default anthropic;
