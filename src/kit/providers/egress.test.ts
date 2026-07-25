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
