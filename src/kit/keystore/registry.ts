/**
 * Keystore registry: the known backends in seal-priority order, plus lookup by tag. Auto-selection
 * (for sealing new secrets) walks this list and takes the first backend available on this machine,
 * so OS-native locks win over the portable passphrase. Opening an existing blob never consults this
 * order; it looks up the exact backend that sealed it (see keystore.open). Backends are registered
 * explicitly rather than discovered from disk: this layer handles the raw key, so it fails closed.
 */
import type { KeystoreBackend } from "./types";
import { dpapiBackend } from "./backends/dpapi";
import { identityFileBackend } from "./backends/identity-file";
import { passphraseBackend } from "./backends/passphrase";

/**
 * Seal priority, strongest lock first.
 *
 * OS-native backends win because they let the operating system hold the key, so it never lands on
 * disk. `identity-file` sits under them as the universal fallback: weaker, because its key is a file
 * beside the vault, but it needs no input and therefore always works. That ordering is what keeps a
 * machine without an OS keystore encrypted rather than broken - the previous order fell through to
 * `passphrase`, which nothing supplies, so every non-Windows save failed.
 *
 * `passphrase` stays last and reports itself unavailable, so it is never auto-selected. It remains
 * registered because open() resolves by the id recorded in the blob, and a vault sealed with it must
 * still open.
 */
const BACKENDS: readonly KeystoreBackend[] = [dpapiBackend, identityFileBackend, passphraseBackend];

export function backendById(id: string): KeystoreBackend | null {
  return BACKENDS.find((backend) => backend.id === id) ?? null;
}

export async function pickBackend(): Promise<KeystoreBackend> {
  for (const backend of BACKENDS) {
    if (await backend.available()) return backend;
  }
  throw new Error("keystore: no backend available");
}
