/**
 * Provider config: which model engine Kit talks to, and where its key lives. Keys are stored in a
 * local file scoped to the user's account, never written to the transcript, and only ever sent to
 * the provider the user picked (the egress gate enforces that). No server, no phone-home.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";

export type ProviderKind =
  | "anthropic"
  | "openai"
  | "google"
  | "groq"
  | "mistral"
  | "openrouter"
  | "openai-compatible";

export interface ProviderConfig {
  kind: ProviderKind;
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

/** The one host each native provider talks to, so the egress gate can allowlist it. */
export const DEFAULT_ENDPOINTS: Record<Exclude<ProviderKind, "openai-compatible">, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  google: "https://generativelanguage.googleapis.com",
  groq: "https://api.groq.com",
  mistral: "https://api.mistral.ai",
  openrouter: "https://openrouter.ai",
};

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

const KINDS = new Set<ProviderKind>([
  "anthropic",
  "openai",
  "google",
  "groq",
  "mistral",
  "openrouter",
  "openai-compatible",
]);

/** Parse-don't-validate: a stored blob is a config only if it has a known kind and a model. */
function isProviderConfig(value: unknown): value is ProviderConfig {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["kind"] === "string"
    && KINDS.has(record["kind"] as ProviderKind)
    && typeof record["model"] === "string"
    && record["model"].length > 0
  );
}
