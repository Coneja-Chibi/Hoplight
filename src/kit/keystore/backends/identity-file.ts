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
 * A DAMAGED KEY FILE NEVER BLOCKS. It is moved aside, a fresh key is written, and the incident is
 * reported through identityStatus() for a caller to surface. See loadOrCreateKey for why refusing
 * to continue protected nothing.
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
import { readFile, rename, writeFile, stat } from "node:fs/promises";
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

/**
 * A file that is PRESENT but is not a usable identity.
 *
 * Kept distinct from an I/O failure on purpose, because the two deserve opposite treatment. A
 * structural fault is deterministic: the bytes will not become valid on a retry, and the key they
 * were holding is already unrecoverable. An I/O fault (permissions, a busy or disconnected mount)
 * may well succeed next time, and treating it as corruption would set aside a perfectly good key.
 */
class IdentityFormatError extends Error {}

/** Recover the raw key, or throw naming what was wrong with the file. */
function decodeIdentity(file: Buffer): Buffer {
  if (file.length !== FILE_SIZE) {
    throw new IdentityFormatError(`identity file is ${file.length} bytes, expected ${FILE_SIZE}`);
  }
  if (!file.subarray(0, 4).equals(MAGIC)) {
    throw new IdentityFormatError("not a Hoplight identity file (bad magic)");
  }
  if (file[4] !== VERSION) {
    throw new IdentityFormatError(`unsupported identity file version ${file[4]}`);
  }
  const salt = file.subarray(8, 40);
  const key = xor(file.subarray(40, 72), maskFor(salt));
  const expected = createHmac("sha256", salt).update(key).digest();
  if (!timingSafeEqual(file.subarray(72, 104), expected)) {
    throw new IdentityFormatError("identity file failed its integrity check");
  }
  return key;
}

/** Where the key came from on this run. `replaced` is the one a caller must tell the user about. */
export type IdentitySource = "existing" | "generated" | "replaced";

export interface IdentityStatus {
  path: string;
  source: IdentitySource;
  /** Where a damaged file was moved to. Present only for `replaced`; it is never deleted. */
  quarantined?: string;
  /** What was wrong with it, for a message worth reading. */
  reason?: string;
}

/**
 * What happened per key path. Keyed rather than a single slot because HOPLIGHT_HOME can move the
 * key (portable installs, tests), and reporting the previous location's outcome for the current one
 * would be a confidently wrong answer.
 *
 * The KEY itself is deliberately NOT cached. Holding it in memory would mean a file deleted or
 * moved underneath a running Kit goes unnoticed, and every later seal would use a key that no longer
 * exists on disk - producing a vault no future process could open. Re-reading 104 bytes per
 * operation costs nothing next to the surrounding I/O.
 */
const statuses = new Map<string, IdentityStatus>();

/** Record an outcome, without letting a later clean read erase the memory of a replacement. */
function record(status: IdentityStatus): IdentityStatus {
  const prior = statuses.get(status.path);
  if (prior?.source === "replaced" && status.source === "existing") return prior;
  statuses.set(status.path, status);
  return status;
}

/** How the key at the CURRENT path was obtained, or null before anything has needed it. */
export const identityStatus = (): IdentityStatus | null => statuses.get(identityPath()) ?? null;

/**
 * Write a fresh key, verifying it actually persisted.
 *
 * The size check matters: a key that silently failed to reach disk would seal a vault that can
 * never be opened again, so a failed write has to be a failed write rather than a successful seal
 * against a key that evaporates when the process exits.
 */
async function createKey(path: string): Promise<Buffer> {
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

/** Move a damaged file out of the way under a unique name. Never deletes. */
async function setAside(path: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = `${path}.damaged-${stamp}-${randomBytes(3).toString("hex")}`;
  await rename(path, target);
  return target;
}

/**
 * The key for this machine, generating one on first use and recovering from a damaged file.
 *
 * A STRUCTURALLY DAMAGED FILE DOES NOT BLOCK KIT, and the reasoning matters because the earlier
 * version got it backwards. Refusing to continue was meant to protect an existing vault, but a file
 * that fails its integrity check is holding a key that is already gone; the vault it sealed cannot
 * be opened by anyone, and the only thing refusing accomplished was leaving the user unable to save
 * a new provider ever again. So the damaged file is moved aside under a dated name, a fresh key is
 * written, and the incident is recorded for a caller to surface. Nothing is deleted, so a determined
 * recovery from the quarantined bytes remains possible.
 */
async function loadOrCreateKey(): Promise<Buffer> {
  const path = identityPath();

  let raw: Buffer | null = null;
  try {
    raw = await readFile(path);
  } catch (error) {
    // Absence is ordinary first-run. Anything else may be transient, so surface it rather than
    // treating a temporarily unreadable key as a damaged one.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (raw) {
    try {
      const key = decodeIdentity(raw);
      record({ path, source: "existing" });
      return key;
    } catch (error) {
      if (!(error instanceof IdentityFormatError)) throw error;
      const quarantined = await setAside(path);
      const key = await createKey(path);
      record({ path, source: "replaced", quarantined, reason: error.message });
      return key;
    }
  }

  const key = await createKey(path);
  record({ path, source: "generated" });
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
