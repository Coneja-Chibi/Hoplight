/**
 * Keystore: seal and open secrets. seal picks the best backend for this machine and tags the blob
 * with it; open is driven by that tag alone and fails loudly if the tagged backend is missing or
 * the ciphertext does not verify. It never silently falls back to a different backend.
 */
import type { Sealed, Unlock } from "./types";
import { backendById, pickBackend } from "./registry";

export async function seal(plaintext: string, unlock: Unlock = {}): Promise<Sealed> {
  const backend = await pickBackend();
  const payload = await backend.seal(plaintext, unlock);
  return { v: 1, backend: backend.id, payload };
}

export async function open(sealed: Sealed, unlock: Unlock = {}): Promise<string> {
  const backend = backendById(sealed.backend);
  if (!backend) throw new Error(`keystore: no backend '${sealed.backend}' to open this vault`);
  return backend.open(sealed.payload, unlock);
}

/** The backend that seal would use right now (what the setup screen labels the lock as). */
export async function activeBackendId(): Promise<string> {
  return (await pickBackend()).id;
}
