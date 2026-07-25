/**
 * Settings section: Remote access - reach this studio from another device over a private, encrypted
 * link (the embedded Tailscale sidecar). Its own richly-styled page, NOT the plain settings rows. It
 * polls the sidecar state and drives Enable / Turn-off; the server opens the Tailscale sign-in page for
 * the user, so the whole flow lives inside Hoplight, never a terminal.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { RemoteDevice, RemoteState } from "../../../remote/sidecar-status";
import { ApiError } from "../../../api";
import { copyText } from "../../../_shared/clipboard";
import { requestExternal } from "../../../_shared/link-gate";
import type { SettingsSection } from "../section-contract";
import { LanCard } from "./lan-card";
import { mask } from "./redact";
import styles from "./remote-access.module.css";

/** Eye (details shown) / eye-with-slash (details hidden), for the screenshot-redaction toggle. */
function EyeIcon({ off }: { off: boolean }): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

function LockIcon(): JSX.Element {
  return (
    <svg
      className={styles.lock}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

interface Actions {
  enable: () => void;
  disable: () => void;
  copyLink: () => void;
  openHttpsSettings: () => void;
  kick: (nodeId: string) => void;
  devices: RemoteDevice[];
  busy: boolean;
  copied: boolean;
}

/** The Tailscale admin page where HTTPS certificates are enabled (the one-time toggle). */
const TAILSCALE_HTTPS_ADMIN = "https://login.tailscale.com/admin/dns";

function StateCard({
  state,
  a,
  redacted,
}: {
  state: RemoteState;
  a: Actions;
  redacted: boolean;
}): JSX.Element {
  switch (state.phase) {
    case "off":
      return (
        <div className={`${styles.card} ${styles.hero}`}>
          <div className={styles.cardTitle}>Turn on remote access</div>
          <div className={styles.cardBody}>
            Hoplight stays on your machine. A private, encrypted link lets your own devices reach it, with
            no router changes and no ports opened. You sign in to Tailscale once (free); we open that page
            for you.
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} disabled={a.busy} onClick={() => a.enable()}>
              Enable remote access
            </button>
          </div>
        </div>
      );
    case "starting":
      return (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Bringing up the private link</div>
          <span className={styles.status}>
            <span className={`${styles.dot} ${styles.busy}`} />
            Starting. This is quick.
          </span>
        </div>
      );
    case "needs-login": {
      const signInUrl = state.signInUrl;
      return (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Sign in to Tailscale</div>
          <div className={styles.cardBody}>
            A Tailscale sign-in page just opened in your browser. Sign in once (free), then come back here.
            This reconnects on its own.
          </div>
          <div className={styles.actions}>
            <span className={styles.status}>
              <span className={`${styles.dot} ${styles.busy}`} />
              Waiting for sign-in
            </span>
            {signInUrl && (
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => requestExternal(signInUrl, "Tailscale sign-in")}
              >
                Open sign-in again
              </button>
            )}
          </div>
        </div>
      );
    }
    case "needs-https":
      return (
        <div className={styles.card}>
          <div className={styles.cardTitle}>One more setup step: turn on HTTPS</div>
          <div className={styles.cardBody}>
            Tailscale needs HTTPS certificates enabled for your account, a one-time switch. Open your
            Tailscale settings, turn on <b>HTTPS Certificates</b>, and this connects on its own, you do not
            need to come back here and click anything.
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={() => a.openHttpsSettings()}>
              Open Tailscale HTTPS settings
            </button>
            <span className={styles.status}>
              <span className={`${styles.dot} ${styles.busy}`} />
              Waiting for HTTPS to be turned on
            </span>
          </div>
        </div>
      );
    case "connected":
      return (
        <div className={`${styles.card} ${styles.hero}`}>
          <div className={styles.cardTitle}>
            <span className={styles.status}>
              <span className={`${styles.dot} ${styles.on}`} />
              On, reachable
            </span>
          </div>
          <div className={styles.cardBody}>
            Open this link on any device signed into the same Tailscale account, your phone, another
            computer. It is a real, trusted https link with no certificate warnings.
          </div>
          {state.url && (
            <span className={styles.urlbar}>
              <LockIcon />
              {redacted ? mask(state.url) : state.url}
            </span>
          )}
          <div className={styles.actions}>
            {state.url && (
              <button type="button" className={styles.btnGhost} onClick={() => a.copyLink()}>
                {a.copied ? "Copied" : "Copy link"}
              </button>
            )}
            <button
              type="button"
              className={`${styles.btnGhost} ${styles.btnDanger}`}
              disabled={a.busy}
              onClick={() => a.disable()}
            >
              Turn off
            </button>
          </div>
          <div className={styles.subtle}>
            To add a device: install the free Tailscale app on it, sign in with the same account, then open
            the link above.
          </div>
          {a.devices.length > 0 && (
            <div className={styles.devices}>
              <div className={styles.devicesTitle}>Connected devices</div>
              {a.devices.map((d) => (
                <div key={d.nodeId} className={styles.deviceRow}>
                  <span className={styles.deviceName}>
                    {redacted ? mask(d.name || d.nodeId) : d.name || d.nodeId}
                  </span>
                  <button
                    type="button"
                    className={`${styles.btnGhost} ${styles.btnDanger}`}
                    onClick={() => a.kick(d.nodeId)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case "error":
      return (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Remote access could not start</div>
          <span className={`${styles.status} ${styles.bad}`}>
            <span className={styles.dot} />
            {state.error ?? "Something stopped the link from coming up."}
          </span>
          <div className={styles.cardBody}>Nothing else in Hoplight is affected.</div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} disabled={a.busy} onClick={() => a.enable()}>
              Try again
            </button>
          </div>
        </div>
      );
    default:
      return assertNever(state.phase);
  }
}

const assertNever = (x: never): never => {
  throw new Error(`remote-access: unhandled phase ${JSON.stringify(x)}`);
};

function RemoteAccessSection({ ctx }: { ctx: AppContext }): JSX.Element {
  const [state, setState] = useState<RemoteState>({ phase: "off" });
  const [busy, setBusy] = useState(false);
  const [managedElsewhere, setManagedElsewhere] = useState(false);
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [redacted, setRedacted] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = async (): Promise<void> => {
      try {
        const s = await ctx.api.remoteStatus();
        if (!alive) return;
        setState(s);
        setManagedElsewhere(false);
        if (s.phase === "connected") {
          const d = await ctx.api.remoteDevices().catch(() => [] as RemoteDevice[]);
          if (alive) setDevices(d);
        } else {
          setDevices([]);
        }
      } catch (e) {
        // A 403 here means this is a tailed-in (remote) session: management is host-only.
        if (alive && e instanceof ApiError && e.status === 403) setManagedElsewhere(true);
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ctx]);

  const enable = (): void => {
    setBusy(true);
    ctx.api
      .remoteEnable()
      .then(setState)
      .catch(() => {}) // the poll recovers the true state
      .finally(() => setBusy(false));
  };
  const disable = (): void => {
    setBusy(true);
    ctx.api
      .remoteDisable()
      .then(setState)
      .catch(() => {})
      .finally(() => setBusy(false));
  };
  const [copied, setCopied] = useState(false);
  const copyLink = (): void => {
    if (!state.url) return;
    void copyText(state.url).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const openHttpsSettings = (): void => {
    requestExternal(TAILSCALE_HTTPS_ADMIN, "Tailscale HTTPS settings");
  };
  const kick = (nodeId: string): void => {
    void ctx.api
      .remoteKick(nodeId)
      .then(() => ctx.api.remoteDevices())
      .then((d) => setDevices(d))
      .catch(() => {});
  };

  return (
    <div className={styles.wrap}>
      <div>
        <div className={styles.titleRow}>
          <div className={styles.title}>Remote access</div>
          <button
            type="button"
            className={styles.eyeBtn}
            aria-pressed={redacted}
            title={redacted ? "Show details" : "Hide details for a screenshot"}
            aria-label={redacted ? "Show details" : "Hide details for a screenshot"}
            onClick={() => setRedacted((v) => !v)}
          >
            <EyeIcon off={redacted} />
          </button>
        </div>
        <div className={styles.blurb}>
          Reach this studio from your phone or another computer, over a private, encrypted link. Off by
          default. Turning it on needs a one-time free Tailscale sign-in, Hoplight opens that page for you.
        </div>
      </div>
      {managedElsewhere ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Managed on the host device</div>
          <div className={styles.cardBody}>
            You are connected to this studio remotely. Remote access is turned on or off, and devices are
            managed, only on the computer actually running Hoplight, never from a device that connected in.
            Open Hoplight on that computer to change these settings.
          </div>
        </div>
      ) : (
        <StateCard
          state={state}
          a={{ enable, disable, copyLink, openHttpsSettings, kick, devices, busy, copied }}
          redacted={redacted}
        />
      )}
      <LanCard ctx={ctx} hidden={managedElsewhere} redacted={redacted} />
    </div>
  );
}

const section: SettingsSection = {
  id: "remote-access",
  label: "Remote access",
  order: 85,
  Component: RemoteAccessSection,
};

export default section;
