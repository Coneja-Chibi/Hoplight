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

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

function assertDestination(url: URL, host: string, previous?: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new EgressBlocked(`refused ${url.protocol} provider URL.`);
  }
  if (url.host !== host) {
    throw new EgressBlocked(`refused to reach ${url.host}; Kit only talks to ${host}.`);
  }
  if (previous?.protocol === "https:" && url.protocol !== "https:") {
    throw new EgressBlocked("refused to downgrade a provider redirect from HTTPS.");
  }
}

function redirectedRequest(request: Request, url: URL, status: number): Request {
  const becomesGet =
    (status === 303 && request.method !== "HEAD") ||
    ((status === 301 || status === 302) && request.method === "POST");
  if (!becomesGet) return new Request(url, request);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("content-type");
  return new Request(url, { method: "GET", headers, signal: request.signal });
}

/** A fetch that validates the configured host before every network hop. */
export function guardedFetch(host: string, fetchImpl: FetchLike = globalThis.fetch): FetchFunction {
  const wrapped = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let request = new Request(input, init);
    let previous: URL | undefined;
    for (let redirects = 0; ; redirects += 1) {
      const target = new URL(request.url);
      assertDestination(target, host, previous);
      const response = await fetchImpl(request.clone(), { redirect: "manual" });
      if (!REDIRECTS.has(response.status)) return response;
      const location = response.headers.get("location");
      if (!location) return response;
      if (redirects >= MAX_REDIRECTS) {
        throw new EgressBlocked(`refused more than ${MAX_REDIRECTS} provider redirects.`);
      }
      const next = new URL(location, target);
      assertDestination(next, host, target);
      request = redirectedRequest(request, next, response.status);
      previous = target;
    }
  };
  // Bun's `typeof fetch` requires a `preconnect` method the AI SDK request path never calls.
  return wrapped as unknown as FetchFunction;
}
