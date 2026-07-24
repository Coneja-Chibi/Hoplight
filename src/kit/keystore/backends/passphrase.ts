/**
 * Passphrase keystore backend: portable, dependency-free encryption at rest. Derives a 256-bit key
 * from the passphrase with scrypt (parameters stored in the blob so the cost can be retuned later
 * without breaking old vaults), then AES-256-GCM. The authentication tag makes a wrong passphrase
 * fail loudly instead of returning garbage. Always available; the universal fallback when no
 * OS-native store exists.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import type { KeystoreBackend, Unlock } from "../types";

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
  available: async (): Promise<boolean> => true,
  seal: async (plaintext: string, unlock: Unlock): Promise<string> => {
    const pass = requirePassphrase(unlock);
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = deriveKey(pass, salt, KDF);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload: Payload = { kdf: KDF, salt: b64(salt), iv: b64(iv), tag: b64(tag), ct: b64(ct) };
    return b64(Buffer.from(JSON.stringify(payload), "utf8"));
  },
  open: async (payload: string, unlock: Unlock): Promise<string> => {
    const pass = requirePassphrase(unlock);
    // Raw-payload edge: the decoded JSON is trusted only after the GCM tag verifies below.
    const parsed = JSON.parse(unb64(payload).toString("utf8")) as Payload;
    const key = deriveKey(pass, unb64(parsed.salt), parsed.kdf);
    const decipher = createDecipheriv("aes-256-gcm", key, unb64(parsed.iv));
    decipher.setAuthTag(unb64(parsed.tag));
    const pt = Buffer.concat([decipher.update(unb64(parsed.ct)), decipher.final()]);
    return pt.toString("utf8");
  },
};
