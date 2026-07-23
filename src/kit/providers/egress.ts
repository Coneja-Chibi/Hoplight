/**
 * The egress gate: fail-closed. Kit sends nothing until a provider is set up, and then only to that
 * provider's host. Every adapter is handed the guardedFetch below, so it is the one choke point
 * where a request leaves the machine, the place to lock the destination and (later) redact logs.
 */
import type { FetchFunction } from "@ai-sdk/provider-utils";
import { DEFAULT_ENDPOINTS, type ProviderConfig } from "./config";

/** Thrown when Kit would send before setup, or anywhere it must not. Fails closed, loudly. */
export class EgressBlocked extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EgressBlocked";
  }
}

/** Refuse to send until a provider is configured with what it needs (a key, unless keyless local). */
export function assertConfigured(config: ProviderConfig | null): asserts config is ProviderConfig {
  if (!config) {
    throw new EgressBlocked("no provider is set up yet. Connect one before sending.");
  }
  if (config.kind !== "openai-compatible" && !config.apiKey) {
    throw new EgressBlocked(`${config.name ?? config.kind} needs an API key before it can send.`);
  }
}

/** The one host this config may reach: its custom base URL, else the provider's own endpoint. */
export function allowedHost(config: ProviderConfig): string {
  const url = config.baseURL
    ?? (config.kind === "openai-compatible" ? undefined : DEFAULT_ENDPOINTS[config.kind]);
  if (!url) {
    throw new EgressBlocked("a custom endpoint needs a base URL.");
  }
  return new URL(url).host;
}

const requestHost = (input: RequestInfo | URL): string => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return new URL(href).host;
};

/** A fetch that only reaches the configured provider's host; any other destination is blocked. */
export function guardedFetch(config: ProviderConfig): FetchFunction {
  const host = allowedHost(config);
  const wrapped = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const target = requestHost(input);
    if (target !== host) {
      throw new EgressBlocked(`refused to reach ${target}; Kit only talks to ${host}.`);
    }
    return fetch(input, init);
  };
  // Bun's `typeof fetch` requires a `preconnect` method the AI SDK request path never calls.
  return wrapped as unknown as FetchFunction;
}
