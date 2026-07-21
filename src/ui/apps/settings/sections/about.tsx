/**
 * Settings section: About - the app-level page. The running build's version and the manual update
 * check (the ONLY network call the app ever makes, button-press only), where the studio folder
 * lives on disk, and the project links (through the leaving gate, like every external door).
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { requestExternal } from "../../../_shared/link-gate";
import { updateStatusOf, type UpdateStatus } from "../../../_shared/update-check";
import { SettingsRow, type SettingsSection } from "../section-contract";
import styles from "../styles.module.css";

const REPO_PAGE = "https://github.com/Coneja-Chibi/Hoplight";
const RELEASES_PAGE = "https://github.com/Coneja-Chibi/Hoplight/releases";

function AboutSection({ ctx }: { ctx: AppContext }): JSX.Element {
  const [installed, setInstalled] = useState("");
  const [studioDir, setStudioDir] = useState("");
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
          ? `${status.latest.version} is out.`
          : status.state === "none"
            ? "No published releases yet."
            : status.state === "error"
              ? status.message
              : "";

  return (
    <>
      <SettingsRow
        label="Updates"
        hint={`Version ${installed || "?"} installed. Checks GitHub only when you press the button; nothing runs on its own.`}
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
              className={`${styles.plate} ${styles.on}`}
              onClick={() => requestExternal(status.latest.url, "GitHub release")}
            >
              View release
            </button>
          )}
          {line && <span role="status">{line}</span>}
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
    </>
  );
}

const section: SettingsSection = {
  id: "about",
  label: "About",
  order: 90,
  Component: AboutSection,
};

export default section;
