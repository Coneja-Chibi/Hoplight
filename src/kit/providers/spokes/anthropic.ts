/** Anthropic (Claude): native Messages API. */
import type { ProviderSpoke } from "../spoke";

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
};

export default anthropic;
