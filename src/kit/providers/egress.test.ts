/** The egress gate must fail closed: no config -> no send; and never reach a host but the chosen one. */
import { expect, test } from "bun:test";
import type { ProviderConfig } from "./config";
import { allowedHost, assertConfigured, EgressBlocked, guardedFetch } from "./egress";

const anthropic: ProviderConfig = { kind: "anthropic", model: "claude-opus-4-8", apiKey: "sk-ant-x" };
const local: ProviderConfig = { kind: "openai-compatible", model: "llama", baseURL: "http://localhost:11434/v1" };

test("fails closed when no provider is set up", () => {
  expect(() => assertConfigured(null)).toThrow(EgressBlocked);
});

test("keyed providers need a key; a configured one passes", () => {
  expect(() => assertConfigured({ kind: "anthropic", model: "claude-opus-4-8" })).toThrow(EgressBlocked);
  expect(() => assertConfigured(anthropic)).not.toThrow();
});

test("keyless local (openai-compatible) is allowed without a key", () => {
  expect(() => assertConfigured(local)).not.toThrow();
});

test("allowed host is the vendor's, or the custom base URL's", () => {
  expect(allowedHost(anthropic)).toBe("api.anthropic.com");
  expect(allowedHost(local)).toBe("localhost:11434");
});

test("guardedFetch refuses any host but the configured one, before touching the network", async () => {
  const send = guardedFetch(anthropic);
  await expect(send("https://evil.example.com/steal")).rejects.toThrow(EgressBlocked);
});
