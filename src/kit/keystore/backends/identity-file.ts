/**
 * Identity-file keystore backend: a key Kit generates for itself, so a machine with no OS keystore
 * still gets an encrypted vault instead of no vault at all.
 *
 * WHY THIS EXISTS. DPAPI covers Windows. Everywhere else the only other backend was the passphrase
 * one, and nothing in Kit has ever collected a passphrase, so saving a provider on Linux or macOS
 * failed for every provider with an error naming something the user had no way to supply. A backend
 * that needs no input is the only kind that can be a universal fallback.
 *
 * HONEST ABOUT ITS STRENGTH, because the label is what a user decides with. The key sits on disk
 * beside the vault it opens, so anyone who can read the vault can read the key. That is strictly
 * weaker than DPAPI or an OS keychain, where the key is held by the operating system and never
 * written down. What it does buy is real: an API key stops being plaintext that a backup, a synced
 * folder, a screenshot, or an idle `grep` will surrender. It is defence against exposure, not
 * against someone who already owns the account. Hence its position: below every OS-native backend
 * in the seal order, chosen only when none of them can run.
 *
 * THE MASK IS OBFUSCATION AND IS NOT LOAD-BEARING. The key is XOR'd with SHA-256(salt || tag) so the
 * file reads as 104 random-looking bytes and no tool scanning for key-shaped strings finds one. The
 * derivation tag is a constant in this file, which is open source, so anyone holding the file and
 * this source recovers the key. That is the intended level. Do not describe it as encryption, and do
 * not let a future change come to depend on it.
 *
 * Format (104 bytes), versioned so it can change without guessing:
 *   [0..3]    magic \x89HLK
 *   [4]       version
 *   [5..7]    random padding
 *   [8..39]   salt
 *   [40..71]  key XOR SHA-256(salt || DERIVATION_TAG)
 *   [72..103] HMAC-SHA256 over the key, keyed by the salt, so corruption fails loudly
 */
import { chmodSync, mkdirSync } from "node:fs";
import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { KeystoreBackend, Unlock } from "../types";
import { aesOpen, aesSeal, type AesParts } from "../aes";

const MAGIC = Buffer.from([0x89, 0x48, 0x4c, 0x4b]); // \x89HLK
const VERSION = 0x01;
const DERIVATION_TAG = Buffer.from("hoplight-kit-identity-v1", "utf8");
const FILE_SIZE = 104;

/**
 * Where the key lives. The rule is restated here rather than imported from providers/config: the
 * keystore sits BELOW the provider layer and must not depend upward on it. Both read HOPLIGHT_HOME,
 * so a test or a portable install relocates the key and the vault together.
 */
export const identityPath = (): string =>
  join(process.env["HOPLIGHT_HOME"] ?? homedir(), ".hoplight", "kit.identity");

const maskFor = (salt: Buffer): Buffer =>
  createHash("sha256").update(Buffer.concat([salt, DERIVATION_TAG])).digest();

const xor = (a: Buffer, b: Buffer): Buffer => Buffer.from(a.map((byte, i) => byte ^ b[i]!));

/** Build the on-disk representation of a raw 32-byte key. */
function encodeIdentity(key: Buffer): Buffer {
  const salt = randomBytes(32);
  const file = Buffer.alloc(FILE_SIZE);
  MAGIC.copy(file, 0);
  file[4] = VERSION;
  randomBytes(3).copy(file, 5);
  salt.copy(file, 8);
  xor(key, maskFor(salt)).copy(file, 40);
  createHmac("sha256", salt).update(key).digest().copy(file, 72);
  return file;
}

/** Recover the raw key, or throw naming what was wrong with the file. */
function decodeIdentity(file: Buffer): Buffer {
  if (file.length !== FILE_SIZE) {
    throw new Error(`keystore: identity file is ${file.length} bytes, expected ${FILE_SIZE}`);
  }
  if (!file.subarray(0, 4).equals(MAGIC)) {
    throw new Error("keystore: not a Hoplight identity file (bad magic)");
  }
  if (file[4] !== VERSION) {
    throw new Error(`keystore: unsupported identity file version ${file[4]}`);
  }
  const salt = file.subarray(8, 40);
  const key = xor(file.subarray(40, 72), maskFor(salt));
  const expected = createHmac("sha256", salt).update(key).digest();
  if (!timingSafeEqual(file.subarray(72, 104), expected)) {
    throw new Error("keystore: identity file failed its integrity check; it may be corrupted");
  }
  return key;
}

/**
 * The key for this machine, generating and persisting one on first use.
 *
 * The write is verified by reading the size back. A key that silently failed to persist would seal
 * a vault that can never be opened again, so a failed write has to be a failed write, not a
 * successful seal against a key that is gone the moment the process exits.
 */
async function loadOrCreateKey(): Promise<Buffer> {
  const path = identityPath();
  try {
    return decodeIdentity(await readFile(path));
  } catch (error) {
    // Only absence justifies generating a new key. A corrupt or unreadable file must NOT be
    // replaced: overwriting it would destroy the only means of opening an existing vault.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const key = randomBytes(32);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, encodeIdentity(key), { flag: "wx" });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Non-POSIX filesystems (Android/Termux storage, some network mounts) reject chmod. The file
    // still exists and still works; owner-only mode is defence in depth, not the mechanism.
  }
  const written = await stat(path);
  if (written.size !== FILE_SIZE) {
    throw new Error(`keystore: identity file wrote ${written.size} bytes, expected ${FILE_SIZE}`);
  }
  return key;
}

export const identityFileBackend: KeystoreBackend = {
  id: "identity-file",
  label: "Local key file",
  // Always available: it depends on nothing but a writable config directory. If that directory is
  // unwritable, seal fails with a real filesystem error, which is more useful than claiming the
  // backend is missing.
  available: async (): Promise<boolean> => true,
  seal: async (plaintext: string, _unlock: Unlock): Promise<string> => {
    const parts = aesSeal(await loadOrCreateKey(), plaintext);
    return Buffer.from(JSON.stringify(parts), "utf8").toString("base64");
  },
  open: async (payload: string, _unlock: Unlock): Promise<string> => {
    const parts = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as AesParts;
    return aesOpen(await loadOrCreateKey(), parts);
  },
};
