/**
 * Resolve a provider config to an AI SDK model: find its drop-in spoke, gate egress, build lazily.
 * There is no central provider switch anymore, the spokes/ folder is the registry, so this file
 * never changes when a provider is added. Live model listing rides the same gate.
 */
import type { FetchFunction } from "@ai-sdk/provider-utils";
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

/** Whether the spoke requires assistant thinking to be echoed back onto the wire. Absent means no,
 * so only a spoke that DECLARED the capability (its adapter carries reasoning parts back) ever does. */
export async function spokeEchoesReasoning(config: ProviderConfig | null): Promise<boolean> {
  if (!config) return false;
  const spoke = (await spokes()).get(config.kind);
  return spoke?.reasoningEcho === true;
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
  /**
   * A NON-HTTP SPOKE NEVER GOES THROUGH THE EGRESS GATE, and this is the rule the spoke contract
   * already states: "a spoke that sets `chat` is asked for its chat and never for its model."
   * listModelsFor did not honour it. It built `guardedFetch(allowedHost(...))` unconditionally, and
   * `allowedHost` throws for any spoke with no `host` - which the Claude subscription provider has
   * none of BY DESIGN, because it drives a local CLI and makes no request at all. The visible result
   * was "Model lookup failed: a custom endpoint needs a base URL" on a provider that has no endpoint
   * to name, which reads as a misconfiguration a person cannot fix.
   *
   * It still gets a fetch, and that fetch REFUSES. Fail closed: a chat-spoke listing static aliases
   * has no use for it, and one that ever tried to reach the network would be blocked rather than
   * quietly granted the access the gate exists to withhold.
   */
  const refusing = (() => {
    const f = (): never => {
      throw new EgressBlocked(`${spoke.label} runs locally and may not make requests.`);
    };
    // The DOM fetch type carries `preconnect`; a refusing stand-in must satisfy the shape without
    // pretending to implement a hint that would also be a request.
    f.preconnect = (): void => {};
    return f as unknown as FetchFunction;
  });
  const fetch = spoke.chat && !spoke.model ? refusing() : guardedFetch(allowedHost(config, spoke));
  return spoke.listModels(config, fetch);
}
