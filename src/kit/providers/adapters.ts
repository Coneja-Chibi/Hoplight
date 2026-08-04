/**
 * Resolve a provider config to an AI SDK model: find its drop-in spoke, gate egress, build lazily.
 * There is no central provider switch anymore, the spokes/ folder is the registry, so this file
 * never changes when a provider is added. Live model listing rides the same gate.
 */
import type { LanguageModel } from "ai";
import type { ProviderConfig } from "./config";
import type { ChatFn } from "./provider";
import type { ModelInfo } from "./models";
import { allowedHost, assertReady, EgressBlocked, guardedFetch } from "./egress";
import { spokes } from "./registry";

/**
 * A spoke's own chat, when it has one, or null for the ordinary HTTP case.
 *
 * Resolved through the same registry and the same readiness check as a model, so a provider that is
 * not an HTTP model still cannot send before it is set up. There is no guarded fetch here because
 * there is no fetch: such a spoke states its own egress story in its own file.
 */
export async function spokeChat(
  config: ProviderConfig | null,
  signal?: AbortSignal,
): Promise<ChatFn | null> {
  if (!config) return null;
  const spoke = (await spokes()).get(config.kind);
  if (!spoke?.chat) return null;
  assertReady(config, spoke);
  return spoke.chat(config, signal);
}

/** Build the model for a config, or fail closed if it is unset, unknown, or missing a key. */
export async function buildModel(config: ProviderConfig | null): Promise<LanguageModel> {
  if (!config) {
    throw new EgressBlocked("no provider is set up yet. Connect one before sending.");
  }
  const spoke = (await spokes()).get(config.kind);
  assertReady(config, spoke);
  if (!spoke.model) {
    // A spoke with neither model nor chat is a wiring mistake, and it must fail closed here rather
    // than at the wire. Reached only if spokeChat was not consulted first.
    throw new EgressBlocked(`${spoke.label} does not build a model; it supplies its own chat.`);
  }
  const fetch = guardedFetch(allowedHost(config, spoke));
  return spoke.model(config, fetch);
}

/** Query the provider's live model list through the same egress gate. Returns null when the spoke
 * has no models endpoint (manual entry). Request failures remain errors so setup can explain and
 * retry them instead of misreporting every failure as an empty model list. */
export async function listModelsFor(config: ProviderConfig): Promise<ModelInfo[] | null> {
  const spoke = (await spokes()).get(config.kind);
  if (!spoke?.listModels) return null;
  assertReady(config, spoke);
  const fetch = guardedFetch(allowedHost(config, spoke));
  return spoke.listModels(config, fetch);
}
