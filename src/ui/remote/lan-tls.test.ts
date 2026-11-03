/** Prove installed certificate discovery and the real isolated LAN HTTPS approval boundary. */
import { expect, test } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { X509Certificate } from "node:crypto";
import { findLanOpenSsl, startLanServer } from "./lan-server";
import { LanHost } from "./lan-host";

test("LAN certificate command discovers only installed OpenSSL and reports a missing dependency", () => {
  expect(findLanOpenSsl(() => "installed", () => false)).toBe("installed");
  const expected = join("trusted", "Git", "mingw64", "bin", "openssl.exe");
  expect(findLanOpenSsl(() => null, (path) => path === expected, "win32", "trusted")).toBe(expected);
  expect(() => findLanOpenSsl(() => null, () => false, "win32", "trusted")).toThrow("Install OpenSSL");
  expect(() => findLanOpenSsl(() => null, () => true, "linux", "trusted")).toThrow("Install OpenSSL");
});

test("installed OpenSSL starts real HTTPS with an IP certificate and keeps unapproved devices gated", async () => {
  const certDir = await mkdtemp(join(tmpdir(), "lan-tls-fixture-"));
  const host = new LanHost({ now: () => 1 });
  await host.reset();
  let served = false;
  let listener: Awaited<ReturnType<typeof startLanServer>> | undefined;
  try {
    listener = await startLanServer({ lanHost: host, appHandler: async () => { served = true; return new Response("private"); }, port: 0, certDir, hostIp: "127.0.0.1" });
    const certificate = new X509Certificate(await readFile(join(certDir, "lan-cert.pem")));
    expect(certificate.checkIP("127.0.0.1")).toBe("127.0.0.1");
    expect(listener.fingerprint).toBe(certificate.fingerprint256);
    // This self-signed fixture is confined to the test listener; production TLS is unchanged.
    const response = await fetch(listener.origin, { tls: { rejectUnauthorized: false } });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("code");
    expect(served).toBe(false);
  } finally {
    listener?.stop();
    await rm(certDir, { recursive: true, force: true });
  }
}, 15000);
