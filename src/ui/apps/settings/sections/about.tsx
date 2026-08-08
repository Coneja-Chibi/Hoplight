/**
 * Settings section: About - the app-level page. The running build's version and the manual update
 * check (the ONLY network call the app ever makes, button-press only), where the studio folder
 * lives on disk, and the project links (through the leaving gate, like every external door).
 */
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { requestExternal } from "../../../_shared/link-gate";
import { updateStatusOf, type UpdateStatus } from "../../../_shared/update-check";
import { clearWindowMemory } from "../../../_shared/window-memory";
import { SettingsRow, type SettingsSection } from "../section-contract";
import styles from "../styles.module.css";

const REPO_PAGE = "https://github.com/Coneja-Chibi/Hoplight";
const RELEASES_PAGE = "https://github.com/Coneja-Chibi/Hoplight/releases";

function AboutSection({ ctx }: { ctx: AppContext }): JSX.Element {
  const [installed, setInstalled] = useState("");
  const [studioDir, setStudioDir] = useState("");
  // how this studio runs decides the update PRESCRIPTION: exe downloads, checkout pulls
  const [mode, setMode] = useState<"packaged" | "source">("packaged");
  const [status, setStatus] = useState<UpdateStatus | { state: "idle" } | { state: "checking" }>({
    state: "idle",
  });

  useEffect(() => {
    let cancelled = false;
    void ctx.api
      .version()
      .then((v) => {
        if (cancelled) return;
        setInstalled(v.version);
        if (typeof v.studioDir === "string") setStudioDir(v.studioDir);
        if (v.mode === "source") setMode("source");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  const check = async (): Promise<void> => {
    setStatus({ state: "checking" });
    try {
      const { httpStatus, body } = await ctx.api.updateCheck();
      setStatus(updateStatusOf(installed, httpStatus, body));
    } catch {
      setStatus({ state: "error", message: "Could not reach GitHub." });
    }
  };

  const line =
    status.state === "checking"
      ? "Asking GitHub..."
      : status.state === "current"
        ? "You are on the newest release."
        : status.state === "available"
          ? mode === "source"
            ? `${status.latest.version} is out. Your checkout updates with: git pull (then bun install).`
            : `${status.latest.version} is out.`
          : status.state === "none"
            ? "No published releases yet."
            : status.state === "error"
              ? status.message
              : "";

  return (
    <>
      <SettingsRow
        label="Updates"
        hint={`Version ${installed || "?"}, ${mode === "source" ? "running from source" : "installed app"}. Checks GitHub only when you press the button; nothing runs on its own.`}
      >
        <div className={styles.plates}>
          <button
            type="button"
            className={styles.plate}
            disabled={status.state === "checking"}
            onClick={() => void check()}
          >
            Check for updates
          </button>
          {status.state === "available" && (
            <button
              type="button"
              // the highlight belongs to the ACTION for this mode: downloading is the exe's
              // path, only a footnote for a checkout that should git pull instead
              className={mode === "source" ? styles.plate : `${styles.plate} ${styles.on}`}
              onClick={() => requestExternal(status.latest.url, "GitHub release")}
            >
              View release
            </button>
          )}
          {line && <span role="status" className={styles.statusNote}>{line}</span>}
        </div>
      </SettingsRow>

      <SettingsRow
        label="Your studio folder"
        hint="Every piece is a plain JSON file here. Back this folder up and you have backed up everything."
      >
        <span className={styles.pathNote}>{studioDir || "(shown once the studio answers)"}</span>
      </SettingsRow>

      <SettingsRow label="Project" hint="Open source under AGPL-3.0. Bugs and wishes welcome.">
        <div className={styles.plates}>
          <button type="button" className={styles.plate} onClick={() => requestExternal(REPO_PAGE, "Hoplight on GitHub")}>
            GitHub
          </button>
          <button
            type="button"
            className={styles.plate}
            onClick={() => requestExternal(RELEASES_PAGE, "Hoplight releases")}
          >
            Releases
          </button>
        </div>
      </SettingsRow>

      <LifecycleRow ctx={ctx} />
    </>
  );
}

/**
 * Restart / Quit. Both arm on first press ("Really ...?") and fire on the second, so a stray
 * click never kills the app; unsaved Workbench edits are the cost, and the hint says so. After
 * restart the page polls /api/version until the respawned server answers, then reloads into it.
 */
function LifecycleRow({ ctx }: { ctx: AppContext }): JSX.Element {
  const [armed, setArmed] = useState<"restart" | "quit" | null>(null);
  const [phase, setPhase] = useState<"idle" | "restarting" | "closed">("idle");
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = (which: "restart" | "quit"): void => {
    setArmed(which);
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    disarmTimer.current = setTimeout(() => setArmed(null), 4000);
  };

  const doRestart = async (): Promise<void> => {
    setPhase("restarting");
    try {
      await ctx.api.restartApp();
    } catch {
      /* the server may die mid-response; the poll below decides the truth */
    }
    const started = Date.now();
    const poll = async (): Promise<void> => {
      if (Date.now() - started > 20000) {
        setPhase("idle");
        ctx.setStatus("the studio did not come back; start it from your shortcut");
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
      setTimeout(() => void poll(), 700);
    };
    setTimeout(() => void poll(), 1200);
  };

  const doQuit = async (): Promise<void> => {
    setPhase("closed");
    try {
      await ctx.api.shutdownApp();
    } catch {
      /* exiting mid-response is expected */
    }
  };

  if (phase === "restarting") {
    return (
      <SettingsRow label="The app" hint="Restarting. This page reconnects by itself.">
        <span role="status" className={styles.statusNote}>Waiting for the studio to come back...</span>
      </SettingsRow>
    );
  }
  if (phase === "closed") {
    return (
      <SettingsRow label="The app" hint="Hoplight is closed.">
        <span role="status" className={styles.statusNote}>You can close this tab. Start it again from your shortcut.</span>
      </SettingsRow>
    );
  }

  return (
    <SettingsRow
      label="The app"
      hint="Restart relaunches the studio in place; Quit stops it fully (browser tabs stop working until you start it again). Unsaved edits on the Workbench are lost either way. Reset this window forgets only what this page remembers - the app you were on, the agent conversation, the overlay's position - and never touches your studio, your tabs or your settings."
    >
      <div className={styles.plates}>
        <button
          type="button"
          className={armed === "restart" ? `${styles.plate} ${styles.on}` : styles.plate}
          onClick={() => (armed === "restart" ? void doRestart() : arm("restart"))}
        >
          {armed === "restart" ? "Really restart?" : "Restart Hoplight"}
        </button>
        <button
          type="button"
          className={armed === "quit" ? `${styles.plate} ${styles.plateDanger}` : styles.plate}
          onClick={() => (armed === "quit" ? void doQuit() : arm("quit"))}
        >
          {armed === "quit" ? "Really quit?" : "Quit Hoplight"}
        </button>
        {/*
          * Not armed like the other two: nothing here can be lost that is not named on the button,
          * so a "really?" would be ceremony. See reset-window.ts for what it does and does not touch.
          */}
        <button
          type="button"
          className={styles.plate}
          title="Forget the app you were on, the agent conversation, and where you put the overlay. Your tabs, settings and studio are untouched."
          onClick={() => {
            clearWindowMemory();
            location.reload();
          }}
        >
          Reset this window
        </button>
      </div>
    </SettingsRow>
  );
}

const section: SettingsSection = {
  id: "about",
  label: "About",
  order: 90,
  Component: AboutSection,
};

export default section;
