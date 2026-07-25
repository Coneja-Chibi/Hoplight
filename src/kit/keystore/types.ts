/**
 * Keystore types: the sealed-blob envelope and the backend contract. A Sealed blob is opaque
 * ciphertext tagged with the backend that wrote it; decryption is driven by that tag, never by
 * whatever backend happens to be available now. Unlock carries what a backend needs to derive its
 * key (a passphrase for the portable backend, nothing for an OS-native one).
 */

export interface Sealed {
  readonly v: 1;
  readonly backend: string;
  readonly payload: string; // base64, backend-defined inner format
}

export interface Unlock {
  readonly passphrase?: string;
}

export interface KeystoreBackend {
  readonly id: string;
  readonly label: string;
  /** True when this backend can run on the current machine. */
  available(): Promise<boolean>;
  /** Encrypt plaintext into an opaque base64 payload. Throws if it lacks what it needs to seal. */
  seal(plaintext: string, unlock: Unlock): Promise<string>;
  /** Decrypt a payload this backend produced. Throws on any failure; never returns garbage. */
  open(payload: string, unlock: Unlock): Promise<string>;
}
