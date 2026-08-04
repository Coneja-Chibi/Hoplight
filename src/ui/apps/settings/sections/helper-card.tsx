/**
 * The downloadable remote-access helper (the "aux package"), as its own concept.
 *
 * The mesh link needs a compiled Go helper that is NOT inside the app: it is roughly 31 MB, and bundling
 * it would charge every download for a feature most people never turn on. So it is a release asset the
 * owner fetches with one explicit click, verified against a fingerprint baked into this build before a
 * single byte is written to the path that gets spawned (src/ui/remote/aux-download.ts).
 *
 * Two surfaces, because the helper is visible in two different states:
 *   - MISSING: the panel is in the `unavailable` phase, and this card is the whole offer.
 *   - PRESENT: having a helper puts the panel in `off`, so the only place a downloaded helper can be seen
 *     or replaced is a line on that card. Without it the download would be a one-way door.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { AuxHelperStatus } from "../../../remote/sidecar-status";
import { ApiError } from "../../../api";
import styles from "./remote-access.module.css";

export interface HelperControls {
  status: AuxHelperStatus | null;
  busy: boolean;
  error: string;
  download: () => void;
}

/**
 * Owns the helper's status and its one action.
 *
 * Status is fetched ONCE rather than on the remote-access poll: whether a download exists for this
 * platform is a property of the build, so re-asking every 1.5s would be pure noise. It is refreshed from
 * the download's own response.
 *
 * `onFirstInstall` fires only when the helper was previously absent. Turning remote access on is the
 * natural next step for someone who just pressed a button on the "cannot run here" card, but re-fetching
 * from the off card is maintenance and must not flip remote access on behind their back.
 */
export function useHelper(ctx: AppContext, onFirstInstall: () => void): HelperControls {
  const [status, setStatus] = useState<AuxHelperStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void ctx.api
      .remoteHelperStatus()
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch(() => {}); // a 403 means a remote session, which cannot manage this anyway
    return () => {
      alive = false;
    };
  }, [ctx]);

  const download = (): void => {
    const wasMissing = !status?.installed;
    setBusy(true);
    setError("");
    ctx.api
      .remoteHelperDownload()
      .then((s) => {
        setStatus(s);
        if (wasMissing) onFirstInstall();
      })
      .catch((e: unknown) => {
        setError(
          e instanceof ApiError && e.message
            ? e.message
            : "The download did not finish. Nothing was installed.",
        );
      })
      .finally(() => setBusy(false));
  };

  return { status, busy, error, download };
}

function HelperError({ h }: { h: HelperControls }): JSX.Element | null {
  if (!h.error) return null;
  return (
    <span className={`${styles.status} ${styles.bad}`}>
      <span className={styles.dot} />
      {h.error}
    </span>
  );
}

/**
 * The `unavailable` card. NOT an error card and it never offers "Try again": the helper is absent from
 * this build, so a retry would reproduce the same nothing. Either it can be fetched for this platform, or
 * the honest thing to say is that LAN mode below needs no helper at all.
 */
export function HelperMissingCard({ detail, h }: { detail?: string; h: HelperControls }): JSX.Element {
  const offered = h.status?.offered ?? false;
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        {offered ? "Add the private-mesh link" : "Private-mesh link not available in this copy"}
      </div>
      <div className={styles.cardBody}>
        {offered
          ? "The private-mesh link needs one extra piece that is not bundled with the app, to keep the download small. Hoplight can fetch it for you now, once."
          : (detail ?? "This copy of Hoplight was built without the Tailscale helper.")}
      </div>
      {offered && (
        <div className={styles.actions}>
          <button type="button" className={styles.btn} disabled={h.busy} onClick={() => h.download()}>
            {h.busy ? "Downloading..." : "Download the extra piece"}
          </button>
          {h.busy && (
            <span className={styles.status}>
              <span className={`${styles.dot} ${styles.busy}`} />
              About 31 MB. This takes a moment.
            </span>
          )}
        </div>
      )}
      <HelperError h={h} />
      <div className={styles.subtle}>
        {offered ? (
          <>
            It is downloaded from Hoplight's own releases and checked against a fingerprint built into this
            copy; a file that does not match is thrown away rather than used. You can skip this entirely and
            use <b>LAN mode</b> below, which needs no download.
          </>
        ) : (
          <>
            Nothing is wrong with your studio, and nothing else is affected. Use <b>LAN mode</b> below to
            reach this studio from another device on the same network.
          </>
        )}
      </div>
    </div>
  );
}

/** Shown on the `off` card: which helper is installed, and a way to fetch it again. */
export function HelperInstalledLine({ h }: { h: HelperControls }): JSX.Element | null {
  if (!h.status?.installed) return <HelperError h={h} />;
  return (
    <>
      <div className={styles.subtle}>
        Mesh helper downloaded
        {h.status.installedTag ? ` with ${h.status.installedTag}` : ""}.{" "}
        <button
          type="button"
          className={styles.btnGhost}
          disabled={h.busy}
          onClick={() => h.download()}
        >
          {h.busy ? "Downloading..." : "Get it again"}
        </button>
      </div>
      <HelperError h={h} />
    </>
  );
}
