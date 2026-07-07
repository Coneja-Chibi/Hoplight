/**
 * Dock - the app roster (transcribed 1:1 from src/ui/index.html's #dock/#dockapps/#dockfoot
 * markup and CSS, which stays as-is; this component only supplies the DOM those rules already
 * style). Built from the manifest: present tiles, a divider, "installs later" future tiles, and
 * the "add app" slot; the foot holds `dockFoot` tiles (Settings). Slim collapse persists as
 * `shell.dockSlim`. Home routes to the user's chosen home app.
 */
import { useEffect, useRef } from "react";
import type { CSSProperties, JSX } from "react";
import type { AppManifestEntry } from "../app-contract";
import { sanitizeSvg } from "./sanitize-svg";
import { useContextMenu, useShellStore } from "./store";

/** Grafts a drop-in app's UNTRUSTED, sanitized mark into a `.mk` box (never innerHTML). */
function AppMark({ markSvg }: { markSvg: string }): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.replaceChildren();
    const svg = sanitizeSvg(markSvg);
    if (svg) box.append(svg);
  }, [markSvg]);
  return <span ref={ref} className="mk" />;
}

function DockTile({ m }: { m: AppManifestEntry }): JSX.Element {
  const activeAppId = useShellStore((s) => s.activeAppId);
  const mountApp = useShellStore((s) => s.mountApp);
  const on = activeAppId === m.id;
  const menuRef = useContextMenu(() => ({ type: "app", label: m.title, data: m }));

  return (
    <button
      ref={menuRef}
      className={`apptile${m.comingSoon ? " future" : ""}${on ? " on" : ""}`}
      style={{ "--a": m.accent } as CSSProperties}
      title={m.title}
      aria-current={on ? "page" : undefined}
      aria-disabled={m.comingSoon ? "true" : undefined}
      tabIndex={m.comingSoon ? -1 : undefined}
      onClick={m.comingSoon ? undefined : () => mountApp(m.id)}
    >
      <AppMark markSvg={m.markSvg} />
      <span className="tx">
        <span className="nm">{m.title}</span>
        <span className="kd">{m.comingSoon ? "installs later" : (m.subtitle ?? "app")}</span>
      </span>
    </button>
  );
}

export function Dock(): JSX.Element {
  const manifests = useShellStore((s) => s.manifests);
  const dockSlim = useShellStore((s) => s.dockSlim);
  const toggleDockSlim = useShellStore((s) => s.toggleDockSlim);
  const goHome = useShellStore((s) => s.goHome);
  // Discord rule: while pieces are open for editing, the dock is marks-only regardless of the
  // saved preference (the pref still governs the empty-bench state; the toggle keeps writing it)
  const editing = useShellStore((s) => s.openPieces.length > 0);
  const slim = dockSlim || editing;

  const body = manifests.filter((m) => !m.dockFoot);
  const foot = manifests.filter((m) => m.dockFoot);
  const present = body.filter((m) => !m.comingSoon);
  const future = body.filter((m) => m.comingSoon);

  return (
    <nav id="dock" className={slim ? "slim" : undefined} aria-label="Apps">
      <button id="dockhome" title="Home" aria-label="Home" onClick={goHome}>
        <span className="beam">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <polygon points="60,92 4,12 34,3" fill="var(--rose)" />
            <polygon points="40,92 96,12 66,3" fill="var(--rose)" />
          </svg>
        </span>
        <span className="hk">Vaude.</span>
      </button>

      <div id="dockapps">
        <div className="docklabel">Apps</div>
        {present.map((m) => (
          <DockTile key={m.id} m={m} />
        ))}
        {future.length > 0 && <div className="dockdiv" />}
        {future.map((m) => (
          <DockTile key={m.id} m={m} />
        ))}
        <div className="dockslot" role="button" title="Apps can be added - drop a folder in src/ui/apps">
          <span className="plus">+</span>
          <span className="sl">add app</span>
        </div>
      </div>

      <div id="dockfoot">
        <div id="dockfootapps">
          {foot.map((m) => (
            <DockTile key={m.id} m={m} />
          ))}
        </div>
      </div>

      <button
        id="dockToggle"
        onClick={toggleDockSlim}
        title={dockSlim ? "Expand the dock" : "Collapse the dock"}
        aria-label={dockSlim ? "Expand the dock" : "Collapse the dock"}
        aria-expanded={!dockSlim}
      >
        <span className="col">&laquo; collapse</span>
        <span className="exp">&raquo;</span>
      </button>
    </nav>
  );
}
