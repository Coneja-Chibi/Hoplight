/**
 * Where Hoplight keeps MACHINE-LOCAL support files - one owner, so two features cannot disagree.
 *
 * This is deliberately NOT the studio folder. The studio holds the user's pieces: it is theirs, it is
 * usually under Documents, and on a lot of machines that means OneDrive syncs it and backup software
 * sweeps it. Neither a crash log nor a 31 MB downloaded helper binary belongs in there - one is noise in
 * a backup, the other is 31 MB of churn syncing to the cloud for no reason.
 *
 * It also must not depend on resolving the studio folder, because that resolution is itself a boot step
 * that can throw (studio/resolve-dir.ts renames directories), and the crash reporter needs somewhere to
 * write when exactly that fails.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The per-user, per-machine support directory. Falls back to the temp dir rather than throwing: a
 * missing environment variable should cost a caller its persistence, never its ability to run.
 */
export function appDataDir(): string {
  const base =
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || tmpdir()
      : process.platform === "darwin"
        ? join(process.env.HOME || tmpdir(), "Library", "Application Support")
        : process.env.XDG_STATE_HOME || join(process.env.HOME || tmpdir(), ".local", "state");
  return join(base, "Hoplight");
}

/** Where a downloaded remote-access helper is cached. Its own folder, so clearing it is unambiguous. */
export const auxSidecarDir = (): string => join(appDataDir(), "sidecar");
