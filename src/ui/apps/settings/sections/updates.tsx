/**
 * Settings section: Updates - the version timeline. Shows how far behind the newest release you are and,
 * for every release, its number, headline change, and full commit log (read from the ```commits block each
 * release ships). Read-only here; the one-button switch (update/rollback) + restart-success popup arrive
 * with the switch engine. Its own richly-styled page (like Remote access), NOT the plain settings rows.
 *
 * All parsing runs through the tested version-history core; this file is the thin polling shell over it.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { requestExternal } from "../../../_shared/link-gate";
import { RELEASES_PAGE } from "../../../_shared/update-check";
import {
  buildTimeline,
  readReleasesList,
  type Timeline,
  type TimelineRow,
} from "../../../_shared/version-history";
import { switchKind } from "../../../_shared/switch-decision";
import { reducePendingSwitch, type SwitchOutcome } from "../../../_shared/pending-switch";
import { ConfirmSwitch, SwitchProgress, SwitchResult } from "./updates-dialogs";
import type { SettingsSection } from "../section-contract";
import styles from "./updates.module.css";

type Phase =
  | { state: "loading" }
  | { state: "ready"; timeline: Timeline }
  | { state: "rate-limited"; retryAfterSec: number }
  | { state: "error" };

/** Relative "N releases behind" / "up to date" summary card. */
function BehindCard({ tl }: { tl: Timeline }): JSX.Element {
  if (!tl.installedInList) {
    // A source checkout sitting between tags: no release row matches. Say so plainly.
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>You are on an unreleased build</div>
        <div className={styles.cardBody}>
          Your version ({tl.installed}) is not one of the published releases, it sits between them (a source
          build). The timeline below still shows every release you can move to.
        </div>
      </div>
    );
  }
  if (tl.behind === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.status}>
            <span className={`${styles.dot} ${styles.on}`} />
            Up to date
          </span>
        </div>
        <div className={styles.cardBody}>
          You are on {tl.installed}, the newest release. The timeline below still lets you look back.
        </div>
      </div>
    );
  }
  const n = tl.behind + (tl.hasMore ? "+" : "");
  return (
    <div className={`${styles.card} ${styles.hero}`}>
      <div className={styles.cardTitle}>Your version</div>
      <div className={styles.behindWrap}>
        <div className={styles.behindNum}>{n}</div>
        <div className={styles.behindText}>
          <div>{tl.behind === 1 && !tl.hasMore ? "release behind the newest" : "releases behind the newest"}</div>
          <div className={styles.behindPair}>
            you are on <span className={styles.cur}>{tl.installed}</span> · newest is{" "}
            <span className={styles.lat}>{tl.latest}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const relLabel = (row: TimelineRow): string => {
  if (row.relation === "here") return "your current version";
  const unit = row.distance === 1 ? "release" : "releases";
  return row.relation === "ahead"
    ? `${row.distance} ${unit} ahead of you`
    : `${row.distance} ${unit} behind you`;
};

/** One release row: number, markers, headline, relation, an expandable commit log, and the move action. */
function VersionRow({
  row,
  onSwitch,
}: {
  row: TimelineRow;
  onSwitch: (version: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const r = row.release;
  const commits = r.commits;
  const action =
    row.relation === "here" ? null : row.relation === "ahead" ? "Update to this" : "Roll back to this";
  return (
    <div className={`${styles.ver} ${row.relation === "here" ? styles.here : ""}`}>
      <span className={styles.vtag}>{r.version}</span>
      <div className={styles.vbody}>
        <div className={styles.vname}>
          {row.relation === "here" && <span className={`${styles.chip} ${styles.chipNow}`}>you are here</span>}
          <span className={styles.cm}>{r.headline || r.name}</span>
        </div>
        <div className={styles.vmeta}>
          <span className={`${styles.rel} ${styles[row.relation]}`}>{relLabel(row)}</span>
          {r.date && <span>· {new Date(r.date).toLocaleDateString()}</span>}
          <span>· {commits.length === 1 ? "1 commit" : `${commits.length} commits`}</span>
        </div>
        {commits.length > 0 ? (
          <button type="button" className={styles.caret} onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Show"} the {commits.length === 1 ? "commit" : `${commits.length} commits`}
          </button>
        ) : (
          <div className={styles.noLog}>commit log unavailable for this release</div>
        )}
        {open && commits.length > 0 && (
          <div className={styles.log}>
            {commits.map((c) => (
              <div key={c.hash} className={styles.c}>
                <span className={styles.h}>{c.hash}</span>
                <span className={styles.s}>{c.subject}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.vact}>
        {action ? (
          <button type="button" className={styles.btnGhost} onClick={() => onSwitch(r.version)}>
            {action}
          </button>
        ) : (
          <span className={styles.hereMark}>current</span>
        )}
      </div>
    </div>
  );
}

function UpdatesSection({ ctx }: { ctx: AppContext }): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ state: "loading" });
  const [installed, setInstalled] = useState("");
  const [confirm, setConfirm] = useState<{ target: string; kind: "update" | "rollback" } | null>(null);
  const [switching, setSwitching] = useState<string | null>(null); // progress message while a switch runs
  const [result, setResult] = useState<SwitchOutcome | null>(null); // post-restart popup
  const [switchError, setSwitchError] = useState<string | null>(null); // a refused/failed switch (pre-restart)
  const [manualDone, setManualDone] = useState<string | null>(null); // packaged: downloaded, run it yourself

  // Load the timeline + the running version.
  useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const [ver, rel] = await Promise.all([ctx.api.version(), ctx.api.updatesReleases(1)]);
        if (!alive) return;
        setInstalled(ver.version);
        if (rel.httpStatus === 403 || rel.httpStatus === 429) {
          setPhase({ state: "rate-limited", retryAfterSec: rel.retryAfterSec ?? 0 });
          return;
        }
        if (rel.httpStatus !== 200 || !Array.isArray(rel.body)) {
          setPhase({ state: "error" });
          return;
        }
        const releases = readReleasesList(rel.body);
        setPhase({ state: "ready", timeline: buildTimeline(releases, ver.version, rel.hasMore) });
      } catch {
        if (alive) setPhase({ state: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [ctx]);

  // Post-restart: read + CLEAR the marker once, and show the outcome popup if this boot was a switch.
  useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const [{ version }, { marker }] = await Promise.all([ctx.api.version(), ctx.api.switchPending()]);
        if (!alive || !marker) return;
        const outcome = reducePendingSwitch(marker, version, Date.now());
        if (outcome.kind !== "none") setResult(outcome);
      } catch {
        /* no marker or a transient error; nothing to show */
      }
    })();
    return () => {
      alive = false;
    };
  }, [ctx]);

  const onSwitch = (target: string): void => {
    const kind = switchKind(installed, target);
    if (kind === "current") return;
    setConfirm({ target, kind });
  };

  // After the switch relaunches the server, wait for it to come back, then reload into the new version.
  const reconnectAndReload = (): void => {
    const started = Date.now();
    const poll = async (): Promise<void> => {
      if (Date.now() - started > 60000) {
        setSwitching(null);
        setSwitchError("Hoplight did not come back on its own. Start it again from your shortcut.");
        return;
      }
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (res.ok) {
          location.reload();
          return;
        }
      } catch {
        /* not back yet */
      }
      setTimeout(() => void poll(), 800);
    };
    setTimeout(() => void poll(), 1500);
  };

  const pollStatus = (): void => {
    const id = setInterval(async () => {
      try {
        const s = await ctx.api.switchStatus();
        if (s.phase === "working") setSwitching(s.message || "Working...");
        else if (s.phase === "restarting") {
          clearInterval(id);
          setSwitching("Restarting Hoplight...");
          reconnectAndReload();
        } else if (s.phase === "manual") {
          // packaged: the build was downloaded + verified; the app does NOT restart itself
          clearInterval(id);
          setSwitching(null);
          setManualDone(s.message);
        } else if (s.phase === "failed") {
          clearInterval(id);
          setSwitching(null);
          setSwitchError(s.message);
        }
      } catch {
        // the server likely restarted mid-poll (a fast switch); treat as restarting
        clearInterval(id);
        reconnectAndReload();
      }
    }, 1000);
  };

  const doSwitch = async (target: string): Promise<void> => {
    setConfirm(null);
    setSwitchError(null);
    setSwitching("Starting...");
    try {
      await ctx.api.switchTo(target);
    } catch (e) {
      setSwitching(null);
      setSwitchError(e instanceof Error ? e.message : "Could not start the switch.");
      return;
    }
    pollStatus();
  };

  return (
    <div className={styles.wrap}>
      <div>
        <div className={styles.title}>Updates</div>
        <div className={styles.blurb}>
          Every release, newest first, with what changed in each. See how far behind you are and read the
          full commit log for any version. Checks GitHub only when you open this page.
        </div>
      </div>

      {phase.state === "loading" && (
        <div className={styles.card}>
          <span className={styles.status}>
            <span className={`${styles.dot} ${styles.busy}`} />
            Asking GitHub for the release history...
          </span>
        </div>
      )}

      {phase.state === "rate-limited" && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Checked too often</div>
          <div className={styles.cardBody}>
            GitHub limits how often the release history can be fetched.{" "}
            {phase.retryAfterSec > 0
              ? `Try again in about ${Math.ceil(phase.retryAfterSec / 60)} minute(s).`
              : "Try again shortly."}
          </div>
        </div>
      )}

      {phase.state === "error" && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Could not load the release history</div>
          <div className={styles.cardBody}>GitHub could not be reached. Nothing else is affected.</div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => requestExternal(RELEASES_PAGE, "Hoplight releases")}
            >
              Open releases on GitHub
            </button>
          </div>
        </div>
      )}

      {phase.state === "ready" && (
        <>
          <BehindCard tl={phase.timeline} />
          <div className={styles.card}>
            <div className={styles.cardTitle}>All releases</div>
            <div className={styles.tl}>
              {phase.timeline.rows.map((row) => (
                <VersionRow key={row.release.version} row={row} onSwitch={onSwitch} />
              ))}
              {phase.timeline.rows.length === 0 && (
                <div className={styles.cardBody}>No published releases yet.</div>
              )}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => requestExternal(RELEASES_PAGE, "Hoplight releases")}
              >
                Open releases on GitHub
              </button>
            </div>
          </div>
        </>
      )}

      {confirm && (
        <ConfirmSwitch
          installed={installed}
          target={confirm.target}
          kind={confirm.kind}
          onConfirm={() => void doSwitch(confirm.target)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {switching !== null && <SwitchProgress message={switching} />}
      {result && (
        <SwitchResult
          outcome={result}
          onDone={() => setResult(null)}
          onUndo={(from) => {
            setResult(null);
            void doSwitch(from);
          }}
        />
      )}
      {switchError && (
        <div className={styles.overlay}>
          <div className={styles.popup}>
            <div className={styles.cardTitle}>Could not switch</div>
            <div className={styles.sub}>{switchError}</div>
            <div className={styles.actionsCenter}>
              <button type="button" className={styles.btn} onClick={() => setSwitchError(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {manualDone && (
        <div className={styles.overlay}>
          <div className={styles.popup}>
            <div className={styles.cardTitle}>Download ready</div>
            <div className={styles.sub}>{manualDone}</div>
            <div className={styles.actionsCenter}>
              <button type="button" className={styles.btn} onClick={() => setManualDone(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const section: SettingsSection = {
  id: "updates",
  label: "Updates",
  order: 88,
  Component: UpdatesSection,
};

export default section;
