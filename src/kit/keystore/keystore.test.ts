/**
 * Keystore round-trip: the security gate. Every backend must return the exact input it sealed, for
 * a brutal payload (all byte values plus multibyte and a long tail), and must fail loudly on a
 * wrong passphrase, a missing secret, or an unknown backend tag. Nothing is built on the keystore
 * until this is green on the real machine (the DPAPI case runs only on Windows).
 */
import { describe, expect, test } from "bun:test";
import { passphraseBackend } from "./backends/passphrase";
import { dpapiBackend } from "./backends/dpapi";
import { open, seal } from "./keystore";
import type { Sealed } from "./types";

const BRUTAL =
  Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join("") +
  "\u{1f4a9}\u{1f600}é中".repeat(4) +
  "a1B2".repeat(4096);

describe("passphrase backend", () => {
  const unlock = { passphrase: "correct horse battery staple" };

  test("round-trips a brutal payload byte-exact", async () => {
    const payload = await passphraseBackend.seal(BRUTAL, unlock);
    expect(await passphraseBackend.open(payload, unlock)).toBe(BRUTAL);
  });

  test("wrong passphrase fails loudly", async () => {
    const payload = await passphraseBackend.seal("secret", unlock);
    await expect(passphraseBackend.open(payload, { passphrase: "wrong" })).rejects.toThrow();
  });

  test("sealing without a passphrase throws", async () => {
    await expect(passphraseBackend.seal("secret", {})).rejects.toThrow();
  });
});

describe("dpapi backend", () => {
  test.if(process.platform === "win32")("round-trips a brutal payload byte-exact", async () => {
    const payload = await dpapiBackend.seal(BRUTAL, {});
    expect(await dpapiBackend.open(payload, {})).toBe(BRUTAL);
  });
});

describe("keystore facade", () => {
  test("open is driven by the blob tag, never by availability", async () => {
    const bogus: Sealed = { v: 1, backend: "nonexistent", payload: "x" };
    await expect(open(bogus, {})).rejects.toThrow(/no backend/);
  });

  test("seal then open round-trips via the auto-picked backend", async () => {
    const unlock = { passphrase: "pw-for-non-windows-hosts" };
    const sealed = await seal("hello studio", unlock);
    expect(await open(sealed, unlock)).toBe("hello studio");
  });
});
