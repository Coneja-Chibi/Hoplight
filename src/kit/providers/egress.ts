/**
 * The egress gate: fail-closed. Kit sends nothing until a provider is set up with what it needs, and
 * then only to that provider's host. Every adapter is handed the guardedFetch below, so it is the one
 * choke point where a request leaves the machine, the place to lock the destination and redact logs.
 */
import type { FetchFunction } from "@ai-sdk/provider-utils";
import type { ProviderConfig } from "./config";
import type { ProviderSpoke } from "./spoke";

/** Thrown when Kit would send before setup, or anywhere it must not. Fails closed, loudly. */
export class EgressBlocked extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EgressBlocked";
  }
}

/** Fail closed: the config must point at a known provider that has what it needs to send. */
export function assertReady(
  config: ProviderConfig,
  spoke: ProviderSpoke | undefined,
): asserts spoke is ProviderSpoke {
  if (!spoke) {
    throw new EgressBlocked(`unknown provider "${config.kind}".`);
  }
  if (!spoke.keyless && !config.apiKey) {
    throw new EgressBlocked(`${config.name ?? spoke.label} needs an API key before it can send.`);
  }
}

/** The one host this config may reach: the spoke's fixed host, else the user's base URL host. */
export function allowedHost(config: ProviderConfig, spoke: ProviderSpoke): string {
  const url = spoke.host ? `https://${spoke.host}` : config.baseURL;
  if (!url) {
    throw new EgressBlocked("a custom endpoint needs a base URL.");
  }
  return new URL(url).host;
}

const requestHost = (input: RequestInfo | URL): string => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return new URL(href).host;
};

/** A fetch that only reaches `host`; any other destination is blocked before the network. */
export function guardedFetch(host: string): FetchFunction {
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
