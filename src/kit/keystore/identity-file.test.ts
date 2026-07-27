/**
 * The universal fallback lock, and the selection rule that reaches it.
 *
 * The bug this replaces was not a missing backend, it was a backend that CLAIMED it could work and
 * then could not. So these tests pin availability as hard as the crypto: the roster must resolve to
 * something usable on a machine with no OS keystore, without anyone supplying anything, or Kit is
 * back to failing every save on Linux and macOS.
 *
 * Every case here points HOPLIGHT_HOME at a scratch directory, so the real key file is never read,
 * written, or replaced by a test run.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { identityFileBackend, identityPath, identityStatus } from "./backends/identity-file";
import { passphraseBackend } from "./backends/passphrase";
import { pickBackend, backendById } from "./registry";
import { aesOpen, aesSeal } from "./aes";

const FILE_SIZE = 104;
const MAGIC = Buffer.from([0x89, 0x48, 0x4c, 0x4b]);

const BRUTAL =
  Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join("")
  + "\u{1f4a9}\u{1f600}é中".repeat(4)
  + "a1B2".repeat(1024);

let home = "";
let priorHome: string | undefined;

beforeEach(async () => {
  priorHome = process.env["HOPLIGHT_HOME"];
  home = await mkdtemp(join(tmpdir(), "kit-identity-"));
  process.env["HOPLIGHT_HOME"] = home;
});

afterEach(async () => {
  if (priorHome === undefined) delete process.env["HOPLIGHT_HOME"];
  else process.env["HOPLIGHT_HOME"] = priorHome;
  await rm(home, { recursive: true, force: true });
});

describe("selection reaches a usable lock without user input", () => {
  test("the passphrase backend reports itself unavailable, since nothing supplies one", async () => {
    // The original defect in one assertion: this returned true, won selection on every non-Windows
    // machine, and then threw "needs a passphrase" from inside seal.
    expect(await passphraseBackend.available()).toBe(false);
  });

  test("a machine with no OS keystore still resolves to a working backend", async () => {
    const picked = await pickBackend();
    // On Windows DPAPI outranks it; anywhere else this is the one that saves the day.
    expect(["dpapi", "identity-file"]).toContain(picked.id);
    // Whatever was picked must seal with no unlock material at all.
    expect(await picked.open(await picked.seal("hello", {}), {})).toBe("hello");
  });

  test("the passphrase backend stays resolvable by id, so old vaults still open", async () => {
    expect(backendById("passphrase")).not.toBeNull();
    const unlock = { passphrase: "correct horse battery staple" };
    const sealed = await passphraseBackend.seal("legacy", unlock);
    expect(await passphraseBackend.open(sealed, unlock)).toBe("legacy");
  });
});

describe("identity-file backend", () => {
  test("round-trips a brutal payload byte-exact, with no unlock", async () => {
    const payload = await identityFileBackend.seal(BRUTAL, {});
    expect(await identityFileBackend.open(payload, {})).toBe(BRUTAL);
  });

  test("generates its key on first use and reuses it after", async () => {
    await identityFileBackend.seal("first", {});
    const first = await readFile(identityPath());
    expect(first.length).toBe(104);

    const payload = await identityFileBackend.seal("second", {});
    expect(await readFile(identityPath())).toEqual(first);
    expect(await identityFileBackend.open(payload, {})).toBe("second");
  });

  test("the key file is a versioned blob, and no two are alike", async () => {
    // Deliberately NOT asserting that the mask hides the key: the derivation tag is a constant in
    // open source, so that is obfuscation rather than a security boundary and a test claiming
    // otherwise would be a false comfort. What IS worth pinning is the format contract and that
    // salt and key are freshly random per machine, so two installs never share a file.
    await identityFileBackend.seal("x", {});
    const first = await readFile(identityPath());
    expect(first.length).toBe(104);
    expect(first.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x48, 0x4c, 0x4b]));
    expect(first[4]).toBe(0x01);

    await rm(identityPath());
    await identityFileBackend.seal("x", {});
    expect((await readFile(identityPath())).subarray(8)).not.toEqual(first.subarray(8));
  });

  test("a damaged key file is set aside and replaced, never left blocking", async () => {
    // The key inside a file that fails its integrity check is already gone, so refusing to continue
    // protects nothing and leaves the user unable to save a provider ever again. Recover and report.
    await mkdir(join(home, ".hoplight"), { recursive: true });
    const damaged = Buffer.alloc(FILE_SIZE);
    MAGIC.copy(damaged, 0);
    damaged[4] = 0x01;
    await writeFile(identityPath(), damaged); // valid header, garbage body: HMAC cannot verify

    const payload = await identityFileBackend.seal("after recovery", {});
    expect(await identityFileBackend.open(payload, {})).toBe("after recovery");

    const status = identityStatus();
    expect(status?.source).toBe("replaced");
    expect(status?.reason).toMatch(/integrity/i);

    // The damaged bytes are preserved, not deleted: recovery from them stays possible.
    expect(status?.quarantined).toBeDefined();
    expect(await readFile(status!.quarantined!)).toEqual(damaged);
    expect((await readFile(identityPath())).length).toBe(FILE_SIZE);
  });

  test("a file of the wrong size or magic is recovered the same way", async () => {
    await mkdir(join(home, ".hoplight"), { recursive: true });
    await writeFile(identityPath(), Buffer.alloc(50));
    expect(await identityFileBackend.open(await identityFileBackend.seal("ok", {}), {})).toBe("ok");
    expect(identityStatus()?.reason).toMatch(/104/);
  });

  test("an I/O failure is NOT treated as damage, since a retry may succeed", async () => {
    // Setting aside a key because a mount was briefly unreadable would destroy a perfectly good
    // key. Only a structural fault, which is deterministic, justifies replacement.
    await mkdir(identityPath(), { recursive: true }); // a directory where the file should be
    await expect(identityFileBackend.seal("x", {})).rejects.toThrow();
    expect(identityStatus()?.source).not.toBe("replaced");
  });

  test("a payload sealed under one machine's key does not open under another's", async () => {
    const payload = await identityFileBackend.seal("secret", {});
    await rm(identityPath());
    // Fresh key, same backend: the tag must fail rather than yield plausible garbage.
    await expect(identityFileBackend.open(payload, {})).rejects.toThrow();
  });
});

describe("shared AES core", () => {
  test("round-trips with a literal key, so the crypto is provable with no keystore at all", () => {
    const key = Buffer.alloc(32, 7);
    expect(aesOpen(key, aesSeal(key, BRUTAL))).toBe(BRUTAL);
  });

  test("a wrong key fails loudly instead of returning garbage", () => {
    const parts = aesSeal(Buffer.alloc(32, 7), "secret");
    expect(() => aesOpen(Buffer.alloc(32, 8), parts)).toThrow();
  });

  test("tampered ciphertext is rejected by the authentication tag", () => {
    const key = Buffer.alloc(32, 7);
    const parts = aesSeal(key, "secret");
    const bytes = Buffer.from(parts.ct, "base64");
    bytes[0] = bytes[0]! ^ 0xff;
    expect(() => aesOpen(key, { ...parts, ct: bytes.toString("base64") })).toThrow();
  });

  test("a key of the wrong size is refused rather than truncated", () => {
    expect(() => aesSeal(Buffer.alloc(16), "x")).toThrow(/32 bytes/);
  });

  test("the same plaintext never seals to the same bytes twice", () => {
    const key = Buffer.alloc(32, 7);
    expect(aesSeal(key, "same").ct === aesSeal(key, "same").ct && aesSeal(key, "same").iv === aesSeal(key, "same").iv).toBe(false);
  });
});
