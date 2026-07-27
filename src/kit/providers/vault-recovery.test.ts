/**
 * What happens to a vault whose key file was destroyed.
 *
 * THE RULE THIS PINS: a user must never be permanently unable to save a provider. The first version
 * of the identity backend refused to continue past a damaged key file, reasoning that replacing it
 * would destroy an existing vault. That was backwards - a file failing its integrity check is
 * holding a key that is already gone, so the vault was unopenable either way, and refusing only
 * meant every future save failed too. These tests hold the corrected behaviour: recover, preserve
 * both files, and say so out loud.
 *
 * The counterpart matters just as much: a vault that fails for any OTHER reason is still
 * recoverable by the right caller and must NOT be swept aside.
 *
 * The vault here is sealed through identityFileBackend DIRECTLY rather than through saveProvider,
 * because seal() picks the strongest backend for the host and on Windows that is DPAPI - which
 * would leave this suite silently testing nothing on the maintainer's own machine.
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { identityFileBackend } from "../keystore/backends/identity-file";

let home = "";
let priorHome: string | undefined;

beforeEach(async () => {
  priorHome = process.env["HOPLIGHT_HOME"];
  home = await mkdtemp(join(tmpdir(), "kit-vault-recovery-"));
  process.env["HOPLIGHT_HOME"] = home;
});

afterEach(async () => {
  if (priorHome === undefined) delete process.env["HOPLIGHT_HOME"];
  else process.env["HOPLIGHT_HOME"] = priorHome;
  await rm(home, { recursive: true, force: true });
});

/** Fresh module instances, so the vault's in-memory cache never hides a re-read. */
async function freshVault(): Promise<typeof import("./vault")> {
  const url = `./vault?recovery=${Math.random().toString(36).slice(2)}`;
  return import(url) as Promise<typeof import("./vault")>;
}

const dir = (): string => join(home, ".hoplight");
const KEY_PATH = (): string => join(dir(), "kit.identity");
const VAULT_PATH = (): string => join(dir(), "kit-vault.json");

const DAMAGED = (): Buffer => {
  const file = Buffer.alloc(104); // valid header, garbage body: the HMAC cannot verify
  Buffer.from([0x89, 0x48, 0x4c, 0x4b]).copy(file, 0);
  file[4] = 0x01;
  return file;
};

/** Seal a vault under the identity-file backend, creating that key file as a side effect. */
async function seedIdentityVault(apiKey: string): Promise<void> {
  const body = JSON.stringify({ providers: [{ id: "p1", kind: "anthropic", model: "m", apiKey }], activeId: "p1" });
  const payload = await identityFileBackend.seal(body, {});
  await mkdir(dir(), { recursive: true });
  await writeFile(VAULT_PATH(), `${JSON.stringify({ v: 1, backend: "identity-file", payload })}\n`);
}

test("a destroyed key file does not lock the user out of saving again", async () => {
  await seedIdentityVault("sk-original");
  await writeFile(KEY_PATH(), DAMAGED());

  const kit = await freshVault();
  const vault = await kit.readVault();

  // Not a throw, and not a silent empty: an explained empty.
  expect(vault.providers).toEqual([]);
  expect(vault.notice).toContain("key file was damaged");
  expect(vault.notice).toContain("Neither file was deleted");

  // And the whole point: saving works immediately afterwards.
  const saved = await kit.saveProvider({ kind: "openai", model: "gpt-4o", apiKey: "sk-replacement" });
  const reread = await kit.readVault();
  expect(reread.providers.map((p) => p.apiKey)).toEqual(["sk-replacement"]);
  expect(saved.id).toBeDefined();
  expect(reread.activeId).toBe(saved.id!);
});

test("both the dead key and the dead vault are preserved, never deleted", async () => {
  await seedIdentityVault("sk-original");
  const originalVaultBytes = await readFile(VAULT_PATH());
  const damaged = DAMAGED();
  await writeFile(KEY_PATH(), damaged);

  await (await freshVault()).readVault();

  const files = await readdir(dir());
  const quarantinedKey = files.find((f) => f.includes(".damaged-"));
  const quarantinedVault = files.find((f) => f.includes(".unopenable-"));
  expect(quarantinedKey).toBeDefined();
  expect(quarantinedVault).toBeDefined();

  // Byte-for-byte, so a determined recovery from the originals stays possible.
  expect((await readFile(join(dir(), quarantinedKey!))).equals(damaged)).toBe(true);
  expect((await readFile(join(dir(), quarantinedVault!))).equals(originalVaultBytes)).toBe(true);
});

test("an unopenable vault whose key is FINE is never swept aside", async () => {
  // Tampered ciphertext with a healthy key file: the data may still be recoverable and the failure
  // is not ours to discard. This must throw, and must leave the vault file exactly where it is.
  await seedIdentityVault("sk-original");

  const sealed = JSON.parse(await readFile(VAULT_PATH(), "utf8")) as { payload: string };
  const parts = JSON.parse(Buffer.from(sealed.payload, "base64").toString("utf8")) as { ct: string };
  const ct = Buffer.from(parts.ct, "base64");
  ct[0] = ct[0]! ^ 0xff;
  const tampered = {
    ...sealed,
    payload: Buffer.from(JSON.stringify({ ...parts, ct: ct.toString("base64") })).toString("base64"),
  };
  await writeFile(VAULT_PATH(), JSON.stringify(tampered));

  const kit = await freshVault();
  await expect(kit.readVault()).rejects.toThrow();

  const files = await readdir(dir());
  expect(files.some((f) => f.includes(".unopenable-"))).toBe(false);
  expect(JSON.parse(await readFile(VAULT_PATH(), "utf8"))).toEqual(tampered);
});

test("a healthy vault reports no notice and keeps its providers", async () => {
  await seedIdentityVault("sk-fine");
  const vault = await (await freshVault()).readVault();
  expect(vault.notice).toBeUndefined();
  expect(vault.providers.map((p) => p.apiKey)).toEqual(["sk-fine"]);
});
