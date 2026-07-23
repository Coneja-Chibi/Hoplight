/**
 * Resolve a provider config to an AI SDK model: find its drop-in spoke, gate egress, build lazily.
 * There is no central provider switch anymore, the spokes/ folder is the registry, so this file
 * never changes when a provider is added.
 */
import type { LanguageModel } from "ai";
import type { ProviderConfig } from "./config";
import { allowedHost, assertReady, EgressBlocked, guardedFetch } from "./egress";
import { spokes } from "./registry";

/** Build the model for a config, or fail closed if it is unset, unknown, or missing a key. */
export async function buildModel(config: ProviderConfig | null): Promise<LanguageModel> {
  if (!config) {
    throw new EgressBlocked("no provider is set up yet. Connect one before sending.");
  }
  const spoke = (await spokes()).get(config.kind);
  assertReady(config, spoke);
  const fetch = guardedFetch(allowedHost(config, spoke));
  return spoke.model(config, fetch);
}
