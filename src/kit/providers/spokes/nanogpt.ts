/** NanoGPT: many models through one OpenAI-compatible endpoint. The setup form offers the plan as
 * a choice (RC's endpoint_type): pay-as-you-go and subscription share one public model list, but
 * chat goes to a different endpoint on the subscription plan. */
import type { ProviderConfig } from "../config";
import type { ProviderSpoke } from "../spoke";
import { openAICompatModels } from "../models";

const PAYGO_BASE = "https://nano-gpt.com/api/v1";
const SUBSCRIPTION_BASE = "https://nano-gpt.com/api/subscription/v1";

/** The chat base for a config: an explicit base URL wins, else the plan decides. */
export const chatBase = (config: Pick<ProviderConfig, "baseURL" | "options">): string =>
  config.baseURL ?? (config.options?.["plan"] === "subscription" ? SUBSCRIPTION_BASE : PAYGO_BASE);

const nanogpt: ProviderSpoke = {
  id: "nanogpt",
  label: "NanoGPT",
  brand: "#34D399",
  host: "nano-gpt.com",
  defaultModel: "chatgpt-4o-latest",
  options: [
    {
      key: "plan",
      label: "Plan",
      choices: [
        { value: "paygo", label: "Pay-as-you-go" },
        { value: "subscription", label: "Subscription" },
      ],
      defaultValue: "paygo",
    },
  ],
  async model(config, fetch) {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { apiKey, headers, model } = config;
    return createOpenAICompatible({
      name: "nanogpt",
      baseURL: chatBase(config),
      apiKey,
      headers,
      fetch,
    })(model);
  },
  async listModels({ apiKey, baseURL }, fetch) {
    // One public list for both plans; detailed=true adds context lengths.
    return openAICompatModels(baseURL ?? PAYGO_BASE, apiKey, fetch);
  },
};

export default nanogpt;
