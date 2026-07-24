/**
 * Keystore registry: the known backends in seal-priority order, plus lookup by tag. Auto-selection
 * (for sealing new secrets) walks this list and takes the first backend available on this machine,
 * so OS-native locks win over the portable passphrase. Opening an existing blob never consults this
 * order; it looks up the exact backend that sealed it (see keystore.open). Backends are registered
 * explicitly rather than discovered from disk: this layer handles the raw key, so it fails closed.
 */
import type { KeystoreBackend } from "./types";
import { dpapiBackend } from "./backends/dpapi";
import { passphraseBackend } from "./backends/passphrase";

// Order matters: OS-native backends first, portable passphrase last as the universal fallback.
const BACKENDS: readonly KeystoreBackend[] = [dpapiBackend, passphraseBackend];

export function backendById(id: string): KeystoreBackend | null {
  return BACKENDS.find((backend) => backend.id === id) ?? null;
}

export async function pickBackend(): Promise<KeystoreBackend> {
  for (const backend of BACKENDS) {
    if (await backend.available()) return backend;
  }
  throw new Error("keystore: no backend available");
}
