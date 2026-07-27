/**
 * The authenticated-encryption primitive every key-holding backend shares.
 *
 * WHY THIS IS EXTRACTED. Two backends now hold a 256-bit key and need the same envelope around it:
 * the passphrase backend derives its key with scrypt, the identity-file backend reads its key off
 * disk. Only the DERIVATION differs, and duplicating AES-GCM per backend is how two copies of one
 * cipher drift apart. Keeping it here also means the crypto is unit-tested once, with a literal key,
 * on a machine with no keystore of any kind - which is what lets it run in CI.
 *
 * GCM, not CBC: the authentication tag makes a wrong key or altered ciphertext fail loudly instead
 * of returning plausible garbage. A fresh random IV per seal means the same plaintext never encrypts
 * to the same bytes twice.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** The ciphertext and everything needed to reverse it, given the key. Base64 throughout. */
export interface AesParts {
  readonly iv: string;
  readonly tag: string;
  readonly ct: string;
}

const b64 = (buf: Buffer): string => buf.toString("base64");
const unb64 = (value: string): Buffer => Buffer.from(value, "base64");

/** Encrypt with a 32-byte key. Throws rather than truncating if the key is the wrong size. */
export function aesSeal(key: Buffer, plaintext: string): AesParts {
  if (key.length !== 32) throw new Error(`keystore: AES key must be 32 bytes, got ${key.length}`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { iv: b64(iv), tag: b64(cipher.getAuthTag()), ct: b64(ct) };
}

/** Decrypt with a 32-byte key. Throws on a wrong key or tampered ciphertext; never returns garbage. */
export function aesOpen(key: Buffer, parts: AesParts): string {
  if (key.length !== 32) throw new Error(`keystore: AES key must be 32 bytes, got ${key.length}`);
  const decipher = createDecipheriv("aes-256-gcm", key, unb64(parts.iv));
  decipher.setAuthTag(unb64(parts.tag));
  return Buffer.concat([decipher.update(unb64(parts.ct)), decipher.final()]).toString("utf8");
}
