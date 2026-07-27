/**
 * Passphrase keystore backend: portable, dependency-free encryption at rest. Derives a 256-bit key
 * from the passphrase with scrypt (parameters stored in the blob so the cost can be retuned later
 * without breaking old vaults), then AES-256-GCM. The authentication tag makes a wrong passphrase
 * fail loudly instead of returning garbage. Always available; the universal fallback when no
 * OS-native store exists.
 */
import { randomBytes, scryptSync } from "node:crypto";
import type { KeystoreBackend, Unlock } from "../types";
import { aesOpen, aesSeal } from "../aes";

interface Kdf {
  readonly N: number;
  readonly r: number;
  readonly p: number;
  readonly keylen: number;
}

interface Payload {
  readonly kdf: Kdf;
  readonly salt: string;
  readonly iv: string;
  readonly tag: string;
  readonly ct: string;
}

const KDF: Kdf = { N: 2 ** 15, r: 8, p: 1, keylen: 32 };
const MAXMEM = 128 * 1024 * 1024;

const b64 = (buf: Buffer): string => buf.toString("base64");
const unb64 = (value: string): Buffer => Buffer.from(value, "base64");

const deriveKey = (passphrase: string, salt: Buffer, kdf: Kdf): Buffer =>
  scryptSync(passphrase, salt, kdf.keylen, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: MAXMEM });

const requirePassphrase = (unlock: Unlock): string => {
  const pass = unlock.passphrase ?? "";
  if (!pass) throw new Error("keystore: passphrase backend needs a passphrase");
  return pass;
};

export const passphraseBackend: KeystoreBackend = {
  id: "passphrase",
  label: "Master passphrase",
  /**
   * FALSE, deliberately, and this is the correction that fixes the original defect. This backend
   * cannot seal or open without a passphrase, and no caller in Kit collects one. Reporting itself as
   * available meant auto-selection picked it on every non-Windows machine and then failed deep in
   * seal, demanding something the user had no way to give. Availability has to mean "will work",
   * not "is compiled in". Existing blobs still open: open() is driven by the backend id recorded in
   * the blob, never by this list, so a passphrase-sealed vault is unaffected.
   */
  available: async (): Promise<boolean> => false,
  seal: async (plaintext: string, unlock: Unlock): Promise<string> => {
    const salt = randomBytes(16);
    const key = deriveKey(requirePassphrase(unlock), salt, KDF);
    const payload: Payload = { kdf: KDF, salt: b64(salt), ...aesSeal(key, plaintext) };
    return b64(Buffer.from(JSON.stringify(payload), "utf8"));
  },
  open: async (payload: string, unlock: Unlock): Promise<string> => {
    // Raw-payload edge: the decoded JSON is trusted only after the GCM tag verifies inside aesOpen.
    const parsed = JSON.parse(unb64(payload).toString("utf8")) as Payload;
    const key = deriveKey(requirePassphrase(unlock), unb64(parsed.salt), parsed.kdf);
    return aesOpen(key, parsed);
  },
};
