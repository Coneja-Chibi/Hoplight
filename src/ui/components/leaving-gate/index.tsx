/**
 * LeavingGate - the full-window "you are leaving Vaude" interstitial. Mounted once at the shell so it
 * covers the dock, tabs, and footer (a hard stop, not a modal). It listens to the link-gate bus: when a
 * rendered external link is clicked, it takes over the window, shows the REAL destination host + url
 * (and warns when the link's visible text named a different host), and only on Continue hands the url
 * to POST /api/open, which re-validates and opens the OS browser. Go back or Escape dismisses.
 *
 * This is the UX half. The route is the enforcement half; this page cannot open anything the route
 * would refuse, so a styling or logic slip here degrades to "nothing opens", never "unsafe open".
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { ExternalLink } from "../../_shared/external-url";
import { subscribeExternal } from "../../_shared/link-gate";
import styles from "./styles.module.css";

export function LeavingGate(): JSX.Element | null {
  const [target, setTarget] = useState<ExternalLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const dismiss = (): void => {
    setTarget(null);
    setBusy(false);
    setFailed(false);
  };

  useEffect(
    () =>
      subscribeExternal((t) => {
        setTarget(t);
        setBusy(false);
        setFailed(false);
      }),
    [],
  );

  useEffect(() => {
    if (target === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target]);

  if (target === null) return null;

  const proceed = async (): Promise<void> => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target.url }),
      });
      if (!res.ok) throw new Error(String(res.status));
      dismiss();
    } catch {
      setBusy(false);
      setFailed(true);
    }
  };

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label="Leaving Vaude">
      <div className={styles.card}>
        <div className={styles.kicker}>You are leaving Vaude</div>
        <p className={styles.lede}>This link opens in your web browser. Vaude does not vouch for where it goes.</p>
        <div className={styles.host}>{target.host}</div>
        <div className={styles.url}>{target.url}</div>
        {target.mismatch && (
          <div className={styles.warn}>
            The link text names a different site than where it actually points. Only continue if you trust it.
          </div>
        )}
        {failed && (
          <div className={styles.warn}>Could not open the link. Copy the address above into your browser.</div>
        )}
        <div className={styles.row}>
          <button type="button" className={`stamp ${styles.back}`} onClick={dismiss} disabled={busy}>
            Go back
          </button>
          <button type="button" className={`stamp ${styles.go}`} onClick={() => void proceed()} disabled={busy}>
            {busy ? "Opening..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
