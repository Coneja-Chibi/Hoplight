/**
 * Encrypted vault: the saved providers, sealed at rest by the keystore. The file on disk holds only
 * a Sealed blob; the plaintext list (keys included) exists in memory only after open. Writes are
 * atomic (temp file, then rename) so a crash mid-write never shreds saved keys. resolveProviderConfig
 * returns the active saved provider, falling back to a familiar env var, else null (fail-closed).
 */
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { configDir, envProvider, isProviderConfig, vaultPath, type ProviderConfig } from "./config";
import { open, seal } from "../keystore/keystore";
import type { Sealed, Unlock } from "../keystore/types";

export interface Vault {
  providers: ProviderConfig[];
  activeId: string | null;
}

const EMPTY: Vault = { providers: [], activeId: null };

/** The decrypted vault. Empty when no vault file exists; THROWS if a present vault will not open
 * (wrong passphrase or tampering) so callers surface it rather than silently losing the keys. */
export async function readVault(unlock: Unlock = {}): Promise<Vault> {
  const sealed = await readSealed();
  if (!sealed) return { providers: [], activeId: null };
  const plain = await open(sealed, unlock);
  return toVault(JSON.parse(plain) as unknown);
}

/** Add or replace a provider (by id) and make it active. Returns the saved provider with its id. */
export async function saveProvider(config: ProviderConfig, unlock: Unlock = {}): Promise<ProviderConfig> {
  const vault = await readVault(unlock);
  const id = config.id ?? randomUUID();
  const saved: ProviderConfig = { ...config, id };
  const providers = [...vault.providers.filter((p) => p.id !== id), saved];
  await writeVault({ providers, activeId: id }, unlock);
  return saved;
}

export async function setActive(id: string, unlock: Unlock = {}): Promise<void> {
  const vault = await readVault(unlock);
  if (!vault.providers.some((p) => p.id === id)) throw new Error(`vault: no provider '${id}'`);
  await writeVault({ ...vault, activeId: id }, unlock);
}

export async function removeProvider(id: string, unlock: Unlock = {}): Promise<void> {
  const vault = await readVault(unlock);
  const providers = vault.providers.filter((p) => p.id !== id);
  const activeId = vault.activeId === id ? (providers[0]?.id ?? null) : vault.activeId;
  await writeVault({ providers, activeId }, unlock);
}

export async function activeProvider(unlock: Unlock = {}): Promise<ProviderConfig | null> {
  const vault = await readVault(unlock);
  if (!vault.activeId) return null;
  return vault.providers.find((p) => p.id === vault.activeId) ?? null;
}

/** The active provider: the saved+active one first, else a familiar env var, else null (fail-closed). */
export async function resolveProviderConfig(unlock: Unlock = {}): Promise<ProviderConfig | null> {
  const active = await activeProvider(unlock);
  return active ?? envProvider();
}

async function readSealed(): Promise<Sealed | null> {
  try {
    const raw = await readFile(vaultPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isSealed(parsed) ? parsed : null;
  } catch {
    return null; // no vault yet, or unreadable: treat as empty
  }
}

async function writeVault(vault: Vault, unlock: Unlock): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  const sealed = await seal(JSON.stringify(vault), unlock);
  const tmp = `${vaultPath()}.${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(sealed)}\n`, "utf8");
  try {
    await chmod(tmp, 0o600);
  } catch {
    // ACL-based on Windows; the encryption is the real lock, this is only defense-in-depth.
  }
  await rename(tmp, vaultPath()); // atomic replace
}

function isSealed(value: unknown): value is Sealed {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record["v"] === 1 && typeof record["backend"] === "string" && typeof record["payload"] === "string";
}

function toVault(value: unknown): Vault {
  if (typeof value !== "object" || value === null) return EMPTY;
  const record = value as Record<string, unknown>;
  const providers = Array.isArray(record["providers"]) ? record["providers"].filter(isProviderConfig) : [];
  const activeId = typeof record["activeId"] === "string" ? record["activeId"] : null;
  return { providers, activeId };
}
