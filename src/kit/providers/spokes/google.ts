/** Google AI (Gemini): native. */
import type { ProviderSpoke } from "../spoke";

const google: ProviderSpoke = {
  id: "google",
  label: "Google AI (Gemini)",
  brand: "#4796E3",
  host: "generativelanguage.googleapis.com",
  defaultModel: "gemini-2.5-pro",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    return createGoogleGenerativeAI({ apiKey, baseURL, headers, fetch })(model);
  },
};

export default google;
