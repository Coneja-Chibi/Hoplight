/**
 * Provider config: which model engine Kit talks to, and where its key lives. Keys are stored in a
 * local file scoped to the user's account, never written to the transcript, and only ever sent to
 * the provider the user picked (the egress gate enforces that). No server, no phone-home.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";

export interface ProviderConfig {
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

const CONFIG_DIR = join(homedir(), ".hoplight");
const CONFIG_FILE = join(CONFIG_DIR, "kit-provider.json");

/** Where the provider config lives (About/setup show it; keys never leave this file). */
export const providerConfigPath = (): string => CONFIG_FILE;

/** Read the saved provider config, or null if none is set up or the file is unreadable. */
export async function readProviderConfig(): Promise<ProviderConfig | null> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isProviderConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

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

/** The active provider: the saved config first, else a familiar env var, else null (fail-closed). */
export async function resolveProviderConfig(): Promise<ProviderConfig | null> {
  const saved = await readProviderConfig();
  if (saved) return saved;
  for (const provider of ENV_PROVIDERS) {
    const key = process.env[provider.env];
    if (key) return { kind: provider.kind, model: provider.model, apiKey: key };
  }
  return null;
}

/** Save the provider config to the user-scoped file, locked to the owner where the OS supports it. */
export async function writeProviderConfig(config: ProviderConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  try {
    await chmod(CONFIG_FILE, 0o600);
  } catch {
    // chmod is a no-op on Windows; the file already sits in the user's profile.
  }
}

/** Parse-don't-validate: a stored blob is a config only if it has a kind and a model. Whether the
 * kind matches a loaded spoke is checked when the model is built, with a clear error. */
function isProviderConfig(value: unknown): value is ProviderConfig {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["kind"] === "string"
    && record["kind"].length > 0
    && typeof record["model"] === "string"
    && record["model"].length > 0
  );
}
