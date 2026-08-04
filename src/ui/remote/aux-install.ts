/**
 * Putting a verified helper binary on disk - the imperative half of the aux download.
 *
 * Split from aux-download.ts so the ordering is impossible to get wrong by accident: that module returns
 * VERIFIED BYTES and never opens a file, this one only ever receives bytes that already matched their
 * pin. There is no code path that writes an unverified download to the location the spawner reads.
 *
 * The write is atomic by rename. A helper that half-exists is worse than one that does not: the resolver
 * finds an executable at the expected path, spawns it, and the user gets a native crash instead of an
 * honest "not downloaded yet".
 */
import { mkdirSync, renameSync, rmSync, writeFileSync, existsSync, chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auxSidecarDir } from "../../app-data";
import type { SidecarPin } from "./aux-download";

/** The helper's filename on disk. Fixed per platform so the resolver needs no lookup to find it. */
export const auxSidecarName = (): string => (process.platform === "win32" ? "sidecar.exe" : "sidecar");

/** The path the resolver checks and the spawner runs. */
export const auxSidecarPath = (): string => join(auxSidecarDir(), auxSidecarName());

/** Is a downloaded helper already in place? */
export const auxSidecarInstalled = (): boolean => existsSync(auxSidecarPath());

/**
 * Write verified bytes to the helper path, atomically. Returns the final path.
 *
 * The temp file is a SIBLING, not in the system temp dir, because rename is only atomic within a
 * filesystem - across one (a temp dir on another volume) it silently degrades to copy-then-delete, which
 * is the torn-file case this is meant to prevent.
 */
export function installAuxSidecar(verified: Uint8Array, pin?: SidecarPin): string {
  const dir = auxSidecarDir();
  const final = auxSidecarPath();
  const staging = join(dir, `.${auxSidecarName()}.partial`);

  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(staging, verified);
    // Executable for the owner only. The helper carries a per-boot shared secret and proxies into an
    // untrusted local port; there is no reason for other accounts on the machine to run it.
    if (process.platform !== "win32") chmodSync(staging, 0o700);
    renameSync(staging, final);
  } catch (err) {
    // Never leave a partial behind to be mistaken for an install.
    rmSync(staging, { force: true });
    throw err;
  }
  // After the rename, so a marker never describes a helper that is not there. The reverse would have the
  // panel report an installed version for a file that failed to land.
  if (pin) writeFileSync(markerPath(), JSON.stringify(pin), "utf8");
  return final;
}

const markerPath = (): string => join(auxSidecarDir(), "installed.json");

/**
 * Which release the installed helper came from, or null when unknown. Lets the panel say "you have the
 * v0.1.25 helper and this build expects v0.1.26" instead of silently running a mismatched one forever.
 * Tolerant: a hand-edited or truncated marker reads as unknown, never throws.
 */
export function readAuxMarker(): SidecarPin | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(markerPath(), "utf8"));
    if (raw === null || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.asset !== "string" || typeof r.sha256 !== "string" || typeof r.tag !== "string") {
      return null;
    }
    return { asset: r.asset, sha256: r.sha256, tag: r.tag };
  } catch {
    return null;
  }
}

/**
 * Remove a downloaded helper and its marker. Used to recover from a bad or superseded download.
 *
 * NOT re-verified before every spawn, and that is deliberate. This file sits in the user's own
 * per-account support directory, so anyone able to rewrite it can equally rewrite Hoplight.exe itself -
 * re-hashing 31 MB on each launch would defend against an attacker who already owns the account. The pin
 * is checked where it means something: before the bytes are ever written.
 */
export function removeAuxSidecar(): void {
  rmSync(auxSidecarPath(), { force: true });
  rmSync(markerPath(), { force: true });
}
