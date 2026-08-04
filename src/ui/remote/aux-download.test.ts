/**
 * Contract for the aux-package download. This is a DOWNLOAD-AND-EXECUTE path, so the tests are mostly
 * about refusals: what must never reach the disk the spawner reads from.
 *
 * The hash pin is the integrity control. The host rules are defence in depth. Both are asserted, and the
 * mismatch case is asserted to produce NOTHING rather than a quarantined-but-present file, because the
 * resolver looks for a path, not for a verdict.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertAuxDestination,
  auxAssetUrl,
  AuxDownloadError,
  fetchPinnedAux,
  MAX_AUX_BYTES,
  platformKey,
  sha256Hex,
  type SidecarPin,
} from "./aux-download";
import { installAuxSidecar, auxSidecarPath, removeAuxSidecar, auxSidecarInstalled } from "./aux-install";

const REPO = "Coneja-Chibi/Hoplight";
const payload = new TextEncoder().encode("pretend this is 31MB of Go");
const digest = createHash("sha256").update(payload).digest("hex");
const pin = (over: Partial<SidecarPin> = {}): SidecarPin => ({
  asset: "sidecar-windows-x64.exe",
  sha256: digest,
  tag: "v0.1.26",
  ...over,
});

/** A copy whose backing store is a plain ArrayBuffer, which is what BodyInit accepts. */
const asBody = (u: Uint8Array): ArrayBuffer => u.slice().buffer;

const ok = (body: Uint8Array): Response =>
  new Response(asBody(body), { status: 200, headers: { "content-length": String(body.byteLength) } });
const redirect = (to: string, status = 302): Response =>
  new Response(null, { status, headers: { location: to } });

const ASSET_HOST = "https://release-assets.githubusercontent.com/x/y?sig=abc";

describe("the URL is built, never interpolated blindly", () => {
  test("points at the release asset on github.com", () => {
    expect(auxAssetUrl(REPO, pin())).toBe(
      "https://github.com/Coneja-Chibi/Hoplight/releases/download/v0.1.26/sidecar-windows-x64.exe",
    );
  });

  test("a tag or asset carrying path separators is refused, not escaped", () => {
    // These become URL path segments. A permissive pin would let a bad generated module aim this
    // fetcher at some other file, or off the release entirely.
    expect(() => auxAssetUrl(REPO, pin({ tag: "../../../etc" }))).toThrow(AuxDownloadError);
    expect(() => auxAssetUrl(REPO, pin({ asset: "a/b" }))).toThrow(AuxDownloadError);
    expect(() => auxAssetUrl("not-a-repo", pin())).toThrow(AuxDownloadError);
  });

  test("a pin that is not a SHA-256 digest is refused up front", () => {
    expect(() => auxAssetUrl(REPO, pin({ sha256: "deadbeef" }))).toThrow(/SHA-256/);
    // Uppercase is refused too: the comparison is exact, so accepting it here would fail later anyway.
    expect(() => auxAssetUrl(REPO, pin({ sha256: digest.toUpperCase() }))).toThrow(AuxDownloadError);
  });
});

describe("every hop is inspected", () => {
  test("plain http is refused, at the first hop and at a redirect", () => {
    expect(() => assertAuxDestination("http://github.com/a", 0)).toThrow(/HTTPS only/);
    expect(() => assertAuxDestination("http://release-assets.githubusercontent.com/a", 1)).toThrow(
      /HTTPS only/,
    );
  });

  test("the first hop must be github.com itself", () => {
    expect(() => assertAuxDestination("https://example.com/a", 0)).toThrow(/refused to fetch/);
    expect(assertAuxDestination("https://github.com/a", 0).host).toBe("github.com");
  });

  test("a redirect may land on GitHub's asset family and nowhere else", () => {
    // GitHub really does redirect release downloads to a signed subdomain, so this hop is required.
    expect(assertAuxDestination(ASSET_HOST, 1).host).toBe("release-assets.githubusercontent.com");
    expect(() => assertAuxDestination("https://evil.example/a", 1)).toThrow(/refused to fetch/);
    // A lookalike that merely CONTAINS the suffix must not pass.
    expect(() => assertAuxDestination("https://githubusercontent.com.evil.example/a", 1)).toThrow(
      /refused to fetch/,
    );
  });

  test("a relative Location cannot smuggle in a host change", async () => {
    const seen: string[] = [];
    const bytes = await fetchPinnedAux(REPO, pin(), async (url) => {
      seen.push(url);
      return seen.length === 1 ? redirect("/other/path") : ok(payload);
    });
    expect(sha256Hex(bytes)).toBe(digest);
    expect(new URL(seen[1]!).host).toBe("github.com");
  });

  test("an endless redirect chain gives up instead of looping", async () => {
    await expect(
      fetchPinnedAux(REPO, pin(), async () => redirect(ASSET_HOST)),
    ).rejects.toThrow(/redirected too many times/);
  });

  test("a redirect with no location is a failure, not a silent stop", async () => {
    await expect(
      fetchPinnedAux(REPO, pin(), async () => new Response(null, { status: 302 })),
    ).rejects.toThrow(/carried no location/);
  });
});

describe("the pin is the integrity control", () => {
  test("matching bytes come back", async () => {
    const bytes = await fetchPinnedAux(REPO, pin(), async () => ok(payload));
    expect(sha256Hex(bytes)).toBe(digest);
  });

  test("one flipped byte is refused, and both digests are named", async () => {
    const tampered = new Uint8Array(payload);
    tampered[0] = tampered[0]! ^ 0xff;
    const err = await fetchPinnedAux(REPO, pin(), async () => ok(tampered)).catch((e) => e);
    expect(err).toBeInstanceOf(AuxDownloadError);
    expect((err as AuxDownloadError).reason).toBe("hash-mismatch");
    // A stale pin after a re-release looks identical to tampering unless both digests are reported.
    expect((err as Error).message).toContain(digest);
    expect((err as Error).message).toContain(sha256Hex(tampered));
  });

  test("a truncated download is a mismatch, not a partial success", async () => {
    await expect(
      fetchPinnedAux(REPO, pin(), async () => ok(payload.slice(0, 4))),
    ).rejects.toThrow(/fingerprint/);
  });

  test("an HTTP error never becomes empty success", async () => {
    await expect(
      fetchPinnedAux(REPO, pin(), async () => new Response("nope", { status: 404 })),
    ).rejects.toThrow(/status 404/);
  });
});

describe("size is bounded", () => {
  test("an overstated content-length is refused before the body is read", async () => {
    let read = false;
    await expect(
      fetchPinnedAux(REPO, pin(), async () => {
        read = true;
        return new Response(payload, {
          status: 200,
          headers: { "content-length": String(MAX_AUX_BYTES + 1) },
        });
      }),
    ).rejects.toThrow(/larger than expected/);
    expect(read).toBe(true); // the request happened; the BODY was refused on the header
  });

  test("a lying content-length does not get past the real measurement", async () => {
    // The header is a courtesy, not a bound: a hostile server can understate it.
    const big = new Uint8Array(MAX_AUX_BYTES + 8);
    await expect(
      fetchPinnedAux(REPO, pin(), async () =>
        new Response(asBody(big), { status: 200, headers: { "content-length": "10" } }),
      ),
    ).rejects.toThrow(/larger than expected/);
  });

  test("the cap stops the READ, so an unbounded body is never fully buffered", async () => {
    // The bound has to apply while reading. Checking a length after arrayBuffer() would already have
    // cost the memory the cap exists to protect - and a response with NO content-length (this one) is
    // exactly the case that slips past a header check.
    const chunk = new Uint8Array(1024 * 1024); // 1 MiB per pull
    let pulls = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(chunk));
      },
    });
    await expect(
      fetchPinnedAux(REPO, pin(), async () => new Response(endless, { status: 200 })),
    ).rejects.toThrow(/larger than expected/);
    // It gave up shortly past the cap rather than reading forever.
    const capInMiB = MAX_AUX_BYTES / (1024 * 1024);
    expect(pulls).toBeGreaterThan(0);
    expect(pulls).toBeLessThanOrEqual(capInMiB + 4);
  });
});

describe("installing is atomic", () => {
  /** Redirect appDataDir() at a throwaway folder so tests never touch the real install location. */
  function withScratchHome<T>(run: () => T): T {
    const home = mkdtempSync(join(tmpdir(), "hoplight-aux-"));
    const keys = ["LOCALAPPDATA", "XDG_STATE_HOME", "HOME"] as const;
    const saved = keys.map((k) => [k, process.env[k]] as const);
    for (const k of keys) process.env[k] = home;
    try {
      return run();
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  test("verified bytes land at the path the resolver reads", () => {
    withScratchHome(() => {
      const path = installAuxSidecar(payload);
      expect(path).toBe(auxSidecarPath());
      expect(readFileSync(path)).toEqual(Buffer.from(payload));
      expect(auxSidecarInstalled()).toBe(true);
    });
  });

  test("no .partial file survives a successful install", () => {
    withScratchHome(() => {
      const path = installAuxSidecar(payload);
      expect(existsSync(`${path}.partial`)).toBe(false);
      expect(existsSync(join(path, "..", `.sidecar.partial`))).toBe(false);
    });
  });

  test("re-installing replaces cleanly rather than failing on an existing file", () => {
    withScratchHome(() => {
      installAuxSidecar(payload);
      const second = new TextEncoder().encode("a newer helper");
      installAuxSidecar(second);
      expect(readFileSync(auxSidecarPath())).toEqual(Buffer.from(second));
    });
  });

  test("removal takes it back out of the resolver's way", () => {
    withScratchHome(() => {
      installAuxSidecar(payload);
      removeAuxSidecar();
      expect(auxSidecarInstalled()).toBe(false);
      // And removing what is not there is not an error - recovery must be idempotent.
      expect(() => removeAuxSidecar()).not.toThrow();
    });
  });

  test.skipIf(process.platform === "win32")("owner-only execute, not world-executable", () => {
    withScratchHome(() => {
      // The helper carries a per-boot shared secret and proxies into an untrusted local port; no other
      // account on the machine has a reason to run it.
      const mode = statSync(installAuxSidecar(payload)).mode & 0o777;
      expect(mode & 0o077).toBe(0);
      expect(mode & 0o100).toBe(0o100);
    });
  });
});

describe("platform key", () => {
  test("matches the shape the generated pins are keyed by", () => {
    expect(platformKey()).toBe(`${process.platform}-${process.arch}`);
    expect(platformKey()).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });
});
