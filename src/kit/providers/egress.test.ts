/** The registry discovers the drop-in providers, and the egress gate fails closed and host-locks. */
import { expect, test } from "bun:test";
import type { ProviderConfig } from "./config";
import { allowedHost, assertReady, EgressBlocked, guardedFetch } from "./egress";
import { loadSpokes } from "./registry";

const registry = await loadSpokes();
const anthropicSpoke = registry.get("anthropic")!;
const localSpoke = registry.get("local")!;

const anthropic: ProviderConfig = { kind: "anthropic", model: "claude-opus-4-8", apiKey: "sk-ant-x" };
const local: ProviderConfig = { kind: "local", model: "llama3.1", baseURL: "http://localhost:11434/v1" };

test("registry discovers every drop-in provider and skips the template", () => {
  expect([...registry.keys()].sort()).toEqual([
    "anthropic",
    "custom",
    "deepseek",
    "google",
    "groq",
    "local",
    "mistral",
    "nanogpt",
    "openai",
    "openrouter",
  ]);
});

test("unknown provider fails closed", () => {
  expect(() => assertReady({ kind: "nope", model: "x" }, undefined)).toThrow(EgressBlocked);
});

test("keyed providers need a key; a configured one passes", () => {
  expect(() => assertReady({ kind: "anthropic", model: "claude-opus-4-8" }, anthropicSpoke)).toThrow(EgressBlocked);
  expect(() => assertReady(anthropic, anthropicSpoke)).not.toThrow();
});

test("keyless local is allowed without a key", () => {
  expect(() => assertReady(local, localSpoke)).not.toThrow();
});

test("allowed host is the spoke's fixed host, or the user's base URL host", () => {
  expect(allowedHost(anthropic, anthropicSpoke)).toBe("api.anthropic.com");
  expect(allowedHost(local, localSpoke)).toBe("localhost:11434");
});

test("guardedFetch refuses any host but the configured one, before touching the network", async () => {
  await expect(guardedFetch("api.anthropic.com")("https://evil.example.com/steal")).rejects.toThrow(EgressBlocked);
});

test("guardedFetch blocks a redirect before it can leave the configured host", async () => {
  const reached: string[] = [];
  const fakeFetch = async (input: RequestInfo | URL): Promise<Response> => {
    reached.push(input instanceof Request ? input.url : String(input));
    return new Response(null, {
      status: 302,
      headers: { location: "https://evil.example.com/steal" },
    });
  };

  await expect(
    guardedFetch("api.anthropic.com", fakeFetch)("https://api.anthropic.com/v1/models"),
  ).rejects.toThrow(EgressBlocked);
  expect(reached).toEqual(["https://api.anthropic.com/v1/models"]);
});

test("guardedFetch follows a bounded redirect on the configured host", async () => {
  const reached: string[] = [];
  const fakeFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    reached.push(url);
    return reached.length === 1
      ? new Response(null, { status: 307, headers: { location: "/v1/models?page=2" } })
      : Response.json({ data: [] });
  };

  const response = await guardedFetch("api.anthropic.com", fakeFetch)(
    "https://api.anthropic.com/v1/models",
  );
  expect(response.status).toBe(200);
  expect(reached).toEqual([
    "https://api.anthropic.com/v1/models",
    "https://api.anthropic.com/v1/models?page=2",
  ]);
});

test("guardedFetch rejects an HTTPS redirect downgrade", async () => {
  const fakeFetch = async (): Promise<Response> =>
    new Response(null, {
      status: 302,
      headers: { location: "http://api.anthropic.com/v1/models" },
    });

  await expect(
    guardedFetch("api.anthropic.com", fakeFetch)("https://api.anthropic.com/v1/models"),
  ).rejects.toThrow("downgrade");
});
