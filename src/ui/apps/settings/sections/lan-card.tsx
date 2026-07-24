/**
 * LAN mode card for the Remote access tab: the connect-code + host-approval path for reaching the studio
 * from devices on the same network without a Tailscale account. Host-only, it polls /api/remote/lan/*,
 * which is refused on any tailed-in listener. Rendered null when the parent detects a remote session.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { LanStatus } from "../../../remote/sidecar-status";
import { mask } from "./redact";
import styles from "./remote-access.module.css";

const OFF: LanStatus = { on: false, code: "", url: "", fingerprint: "", pending: [], connected: [] };

export function LanCard({
  ctx,
  hidden,
  redacted,
}: {
  ctx: AppContext;
  hidden: boolean;
  redacted: boolean;
}): JSX.Element | null {
  const [lan, setLan] = useState<LanStatus>(OFF);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hidden) return;
    let alive = true;
    const poll = async (): Promise<void> => {
      try {
        const s = await ctx.api.remoteLanStatus();
        if (alive) setLan(s);
      } catch {
        /* a remote session (403) or a transient error; the parent hides this card in the 403 case */
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ctx, hidden]);

  if (hidden) return null;

  const run = (p: Promise<LanStatus>): void => {
    setBusy(true);
    p.then(setLan)
      .catch(() => {})
      .finally(() => setBusy(false));
  };
  const settle = (p: Promise<LanStatus>): void => {
    p.then(setLan).catch(() => {});
  };

  if (!lan.on) {
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>Local network access</div>
        <div className={styles.cardBody}>
          A no-account option: reach this studio from devices on the <b>same network</b> (home or office
          Wi-Fi), with no Tailscale sign-in. Each device enters a connect code, and you approve it here
          before it gets in.
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} disabled={busy} onClick={() => run(ctx.api.remoteLanEnable())}>
            Enable local access
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        <span className={styles.status}>
          <span className={`${styles.dot} ${styles.on}`} />
          Local access on
        </span>
      </div>
      <div className={styles.cardBody}>
        On a device on this network, open the link and enter this code. Only enable on a network you trust.
      </div>
      <div className={styles.code}>{redacted ? mask(lan.code) : lan.code}</div>
      {lan.url && <span className={styles.urlbar}>{redacted ? mask(lan.url) : lan.url}</span>}
      {lan.fingerprint && (
        <div className={styles.subtle}>
          Certificate fingerprint (verify on first connect):{" "}
          {redacted ? mask(lan.fingerprint) : lan.fingerprint}
        </div>
      )}

      {lan.pending.length > 0 && (
        <div className={styles.devices}>
          <div className={styles.devicesTitle}>Wants to connect</div>
          {lan.pending.map((d) => (
            <div key={d.id} className={styles.deviceRow}>
              <span className={styles.deviceName}>{redacted ? mask(d.label) : d.label}</span>
              <div className={styles.actions}>
                <button type="button" className={styles.btn} onClick={() => settle(ctx.api.remoteLanApprove(d.id))}>
                  Approve
                </button>
                <button
                  type="button"
                  className={`${styles.btnGhost} ${styles.btnDanger}`}
                  onClick={() => settle(ctx.api.remoteLanDeny(d.id))}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lan.connected.length > 0 && (
        <div className={styles.devices}>
          <div className={styles.devicesTitle}>Connected devices</div>
          {lan.connected.map((d) => (
            <div key={d.id} className={styles.deviceRow}>
              <span className={styles.deviceName}>{redacted ? mask(d.label) : d.label}</span>
              <button
                type="button"
                className={`${styles.btnGhost} ${styles.btnDanger}`}
                onClick={() => settle(ctx.api.remoteLanKick(d.id))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btnGhost} ${styles.btnDanger}`}
          disabled={busy}
          onClick={() => run(ctx.api.remoteLanDisable())}
        >
          Turn off local access
        </button>
      </div>
    </div>
  );
}
