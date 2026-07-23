/**
 * Provider config: which model engine Kit talks to, the env-var fallback, and where the vault lives.
 * This file stays free of crypto so the type and the env fallback have no dependency on the keystore;
 * the encrypted key storage lives in vault.ts. Keys are only ever sent to the provider the user
 * picked (the egress gate enforces that). No server, no phone-home.
 */
import { homedir } from "node:os";
import { join } from "node:path";

export interface ProviderConfig {
  /** Stable id for a saved provider (absent for env-derived configs). */
  id?: string;
  /** The provider id, matching a drop-in spoke in spokes/ (e.g. "anthropic", "local", "custom"). */
  kind: string;
  /** The model id to call, e.g. "claude-opus-4-8" or "gpt-4o". */
  model: string;
  /** Absent only for keyless local endpoints (openai-compatible against localhost). */
  apiKey?: string;
  /** Base URL for openai-compatible endpoints, proxies, and local servers. */
  baseURL?: string;
  /** Extra headers a proxy might require. */
  headers?: Record<string, string>;
  /** Optional human label (e.g. "Personal", "Work"). */
  name?: string;
}

/** The Hoplight home dir; HOPLIGHT_HOME overrides it for portable installs and tests. */
export const configDir = (): string => join(process.env.HOPLIGHT_HOME ?? homedir(), ".hoplight");

/** Where the encrypted vault lives (About/setup show it; keys never leave it in the clear). */
export const vaultPath = (): string => join(configDir(), "kit-vault.json");

/** Familiar env vars that stand in for a saved config, so a key can be set without the setup screen. */
const ENV_PROVIDERS: ReadonlyArray<{ env: string; kind: string; model: string }> = [
  { env: "ANTHROPIC_API_KEY", kind: "anthropic", model: "claude-opus-4-8" },
  { env: "OPENAI_API_KEY", kind: "openai", model: "gpt-4o" },
  { env: "OPENROUTER_API_KEY", kind: "openrouter", model: "anthropic/claude-opus-4-8" },
  { env: "GROQ_API_KEY", kind: "groq", model: "llama-3.3-70b-versatile" },
  { env: "MISTRAL_API_KEY", kind: "mistral", model: "mistral-large-latest" },
  { env: "DEEPSEEK_API_KEY", kind: "deepseek", model: "deepseek-chat" },
  { env: "NANOGPT_API_KEY", kind: "nanogpt", model: "chatgpt-4o-latest" },
  { env: "GEMINI_API_KEY", kind: "google", model: "gemini-2.5-pro" },
];

/** A provider derived from a familiar env var, or null. Never persisted; the key stays in the env. */
export function envProvider(): ProviderConfig | null {
  for (const provider of ENV_PROVIDERS) {
    const key = process.env[provider.env];
    if (key) return { kind: provider.kind, model: provider.model, apiKey: key };
  }
  return null;
}

/** Parse-don't-validate: a stored blob is a config only if it has a kind and a model. Whether the
 * kind matches a loaded spoke is checked when the model is built, with a clear error. */
export function isProviderConfig(value: unknown): value is ProviderConfig {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["kind"] === "string"
    && record["kind"].length > 0
    && typeof record["model"] === "string"
    && record["model"].length > 0
  );
}
