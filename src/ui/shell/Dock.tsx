/**
 * Dock - the app roster (transcribed 1:1 from src/ui/index.html's #dock/#dockapps/#dockfoot
 * markup and CSS, which stays as-is; this component only supplies the DOM those rules already
 * style). Built from the manifest: present tiles, a divider, "installs later" future tiles, and
 * the Apps-catalog control; `catalogOnly` apps stay out. The foot holds `dockFoot` tiles (Settings).
 * Slim collapse persists as `shell.dockSlim`. Home routes to the user's chosen home app.
 */
import { useMemo } from "react";
import type { CSSProperties, JSX } from "react";
import type { AppManifestEntry } from "../app-contract";
import { AppMark } from "../components/app-mark";
import { appBinding, appRoster, chordFor, isMacLike } from "./app-keys";
import { dockManifestGroups } from "./dock-core";
import styles from "./dock.module.css";
import { useContextMenu, useShellStore } from "./store";

/**
 * `chord` is the whole shortcut ("ctrl+1") and `chordKey` its bare key ("1"), both resolved by the
 * key map itself (app-keys.ts) rather than by anything here. A shortcut nobody can find is a
 * shortcut nobody has, and the one place every app is already listed by name is the dock.
 *
 * TWO LENGTHS BECAUSE THE TILE HAS ROOM FOR ONE GLYPH. A full "ctrl+1" printed on the tile is 49px
 * wide next to a subtitle that already reaches within 4px of the right edge ("app - convert"
 * overlapped it outright, measured in the running dock). The keycap carries the number, which is the
 * part that differs per app and the part every sidebar-with-shortcuts has taught people to read; the
 * tooltip carries the whole chord for anyone who has not met the convention.
 */
function DockTile({ m, chord, chordKey, showChord }: {
  m: AppManifestEntry;
  chord: string | null;
  chordKey: string | null;
  showChord: boolean;
}): JSX.Element {
  const activeAppId = useShellStore((s) => s.activeAppId);
  const mountApp = useShellStore((s) => s.mountApp);
  const on = activeAppId === m.id;
  const menuRef = useContextMenu(() => ({ type: "app", label: m.title, data: m }));

  return (
    <button
      ref={menuRef}
      className={`apptile${m.comingSoon ? " future" : ""}${on ? " on" : ""}`}
      style={{ "--a": m.accent } as CSSProperties}
      // The tooltip carries the chord at EVERY dock width. The keycap goes with the tile's words
      // when the dock collapses (a piece open, or a narrow window), and that collapsed dock is what
      // an editing session actually looks like - so the tooltip is the half that has to always work.
      title={chord ? `${m.title} (${chord})` : m.title}
      aria-current={on ? "page" : undefined}
      aria-disabled={m.comingSoon ? "true" : undefined}
      tabIndex={m.comingSoon ? -1 : undefined}
      onClick={m.comingSoon ? undefined : () => mountApp(m.id)}
    >
      <AppMark markSvg={m.markSvg} className="mk" />
      <span className="tx">
        <span className="nm">{m.title}</span>
        <span className="kd">{m.comingSoon ? "installs later" : (m.subtitle ?? "app")}</span>
      </span>
      {chordKey && showChord && (
        // aria-hidden: the tooltip above already says this, spelled out. Announcing "1" after the
        // app's name would be a screen reader repeating a hint it just gave properly.
        <span className={styles.chord} aria-hidden="true">
          {chordKey}
        </span>
      )}
    </button>
  );
}

export function Dock(): JSX.Element {
  const manifests = useShellStore((s) => s.manifests);
  const dockSlim = useShellStore((s) => s.dockSlim);
  const toggleDockSlim = useShellStore((s) => s.toggleDockSlim);
  const goHome = useShellStore((s) => s.goHome);
  const mountApp = useShellStore((s) => s.mountApp);
  const activeAppId = useShellStore((s) => s.activeAppId);
  // Discord rule: while pieces are open for editing, the dock is marks-only regardless of the
  // saved preference (the pref still governs the empty-bench state; the toggle keeps writing it)
  const editing = useShellStore((s) => s.openPieces.length > 0);
  const slim = dockSlim || editing;

  const { present, future, foot, catalog } = dockManifestGroups(manifests);
  // The same roster the key map counts, so tile 3 and ctrl+3 are the same app by construction.
  const roster = useMemo(() => appRoster(manifests), [manifests]);
  const mac = useMemo(
    () => (typeof navigator === "undefined" ? false : isMacLike(navigator.userAgent)),
    [],
  );
  /** Everything a tile needs to advertise its own shortcut, from the table that owns it. */
  const hintOf = (m: AppManifestEntry): { chord: string | null; chordKey: string | null } => ({
    chord: chordFor(m.id, roster, mac),
    chordKey: appBinding(m.id, roster)?.label ?? null,
  });

  return (
    <nav id="dock" className={slim ? "slim" : undefined} aria-label="Apps">
      <button id="dockhome" title="Home" aria-label="Home" onClick={goHome}>
        {/* the illuminated V (docs/media/hoplight-v.svg): crossed searchlights, bunny ears */}
        <span className="beam">
          <svg viewBox="0 0 184 171" aria-hidden="true">
            <g fill="var(--rose)">
              <path d="M0 12 51 0 117 171 82 136Z" />
              <path d="M135 0 184 12 101 136 67 171Z" />
            </g>
            <g fill="var(--stage-white)">
              <path d="m34 33 11-4 34 82-8-10Z" />
              <path d="m140 29 11 4-38 68-8 10Z" />
            </g>
          </svg>
        </span>
        <span className="hk">Hoplight.</span>
      </button>

      <div id="dockapps">
        <div className="docklabel">Apps</div>
        {present.map((m) => (
          <DockTile key={m.id} m={m} {...hintOf(m)} showChord={!slim} />
        ))}
        {future.length > 0 && <div className="dockdiv" />}
        {future.map((m) => (
          <DockTile key={m.id} m={m} {...hintOf(m)} showChord={!slim} />
        ))}
        <button
          type="button"
          className={`dockslot${catalog?.id === activeAppId ? " on" : ""}`}
          title="Browse apps included with Hoplight"
          aria-label="Browse apps"
          aria-current={catalog?.id === activeAppId ? "page" : undefined}
          disabled={!catalog}
          onClick={() => catalog && mountApp(catalog.id)}
        >
          <span className="plus">+</span>
          <span className="sl">add app</span>
        </button>
      </div>

      <div id="dockfoot">
        <div id="dockfootapps">
          {foot.map((m) => (
            <DockTile key={m.id} m={m} {...hintOf(m)} showChord={!slim} />
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
