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
import { identityStatus } from "../keystore/backends/identity-file";
import type { Sealed, Unlock } from "../keystore/types";

export interface Vault {
  providers: ProviderConfig[];
  activeId: string | null;
  /**
   * Set when a previous vault could not be recovered and was set aside. Callers MUST surface it:
   * a user whose saved providers silently vanished needs to be told why, and where the old files
   * went, rather than finding an empty list and assuming Kit lost them.
   */
  notice?: string;
}

const EMPTY: Vault = { providers: [], activeId: null };

// In-memory cache of the decrypted vault, keyed by path so a changed HOPLIGHT_HOME (tests, portable
// installs) invalidates it. This keeps the key unlocked once per process rather than spawning the
// OS keystore (a PowerShell DPAPI call) on every turn; the plaintext lives in process memory only.
let cache: { path: string; vault: Vault } | null = null;

/** The decrypted vault. Empty when no vault file exists; THROWS if a present vault will not open
 * (wrong passphrase or tampering) so callers surface it rather than silently losing the keys. */
export async function readVault(unlock: Unlock = {}): Promise<Vault> {
  const path = vaultPath();
  if (cache && cache.path === path) return cache.vault;
  const sealed = await readSealed();
  let vault: Vault;
  if (!sealed) {
    vault = { ...EMPTY };
  } else {
    try {
      vault = toVault(JSON.parse(await open(sealed, unlock)) as unknown);
    } catch (error) {
      vault = await recoverUnopenable(sealed, error as Error);
    }
  }
  cache = { path, vault };
  return vault;
}

/**
 * What to do with a vault that will not open.
 *
 * Exactly ONE case is safe to move past: Kit's own key file was found damaged and replaced during
 * this very open. The vault was sealed under a key that no longer exists anywhere, so no caller,
 * retry, or passphrase will ever recover it - and leaving the dead file in place would fail every
 * future read, which is what would trap the user with no way to save a provider again. It is set
 * aside beside the quarantined key, both preserved, and the run continues with an empty vault and a
 * notice explaining it.
 *
 * Every other failure is rethrown untouched. A wrong passphrase, a DPAPI refusal, or a vault from
 * another Windows profile are all states where the data is still recoverable by the right caller,
 * and discarding them would turn a fixable problem into real loss.
 */
async function recoverUnopenable(sealed: Sealed, cause: Error): Promise<Vault> {
  const identity = identityStatus();
  if (sealed.backend !== "identity-file" || identity?.source !== "replaced") throw cause;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const setAside = `${vaultPath()}.unopenable-${stamp}`;
  await rename(vaultPath(), setAside);
  return {
    ...EMPTY,
    notice:
      `Kit's key file was damaged (${identity.reason ?? "unreadable"}), so it was set aside as `
      + `${identity.quarantined} and a new key was created. The providers saved under the old key `
      + `could not be decrypted; that vault was kept at ${setAside}. Neither file was deleted. `
      + "Re-enter your provider keys to continue.",
  };
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
  const plaintext = JSON.stringify(vault);
  const sealed = await seal(plaintext, unlock);

  // Prove the seal is reversible BEFORE the rename makes it the only copy. seal() re-picks the best
  // backend every write, so a vault can legitimately change locks between saves - and if the new
  // lock cannot open what it just wrote, the rename would replace working keys with unreadable
  // ones. Verifying first turns silent, permanent key loss into an ordinary failed write.
  if ((await open(sealed, unlock)) !== plaintext) {
    throw new Error(
      `vault: the ${sealed.backend} lock could not reopen what it just sealed; nothing was written`,
    );
  }

  const tmp = `${vaultPath()}.${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(sealed)}\n`, "utf8");
  try {
    await chmod(tmp, 0o600);
  } catch {
    // ACL-based on Windows; the encryption is the real lock, this is only defense-in-depth.
  }
  await rename(tmp, vaultPath()); // atomic replace
  cache = { path: vaultPath(), vault }; // keep the in-memory copy in step with disk
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
