/**
 * TopBar - the crumb + search + top actions strip (transcribed 1:1 from src/ui/index.html's
 * #topbar markup and CSS, kept as-is). Import walks to the first-landing app (the shelves);
 * theme toggles + persists. Buttons render through the Stamp seed (its CSS matches `.topbtn`
 * 1:1); `id` passthrough keeps index.html's `#importBtn`/`#themeBtn` narrow-width rules intact.
 */
import type { JSX } from "react";
import { Stamp } from "../components/stamp";
import { useShellStore } from "./store";

export function TopBar(): JSX.Element {
  const manifests = useShellStore((s) => s.manifests);
  const activeAppId = useShellStore((s) => s.activeAppId);
  const mountApp = useShellStore((s) => s.mountApp);
  const setStatus = useShellStore((s) => s.setStatus);
  const toggleTheme = useShellStore((s) => s.toggleTheme);

  const active = manifests.find((m) => m.id === activeAppId);

  const goImport = (): void => {
    const shelves = manifests.find((m) => m.firstRunLanding && !m.comingSoon);
    if (shelves) mountApp(shelves.id);
    setStatus("drop files anywhere on the shelves");
  };

  return (
    <header id="topbar">
      <div id="crumb">
        <span className="ck">App</span>
        <span className="cn">{active?.title ?? ""}</span>
      </div>
      <label id="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input placeholder="Search your whole studio" aria-label="Search your whole studio" />
      </label>
      <div id="topact">
        <Stamp id="importBtn" onClick={goImport}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M4 20h16" />
          </svg>
          <span className="im-t">Import</span>
        </Stamp>
        <Stamp id="themeBtn" onClick={toggleTheme} title="Switch theme" aria-label="Switch theme">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
          </svg>
        </Stamp>
      </div>
    </header>
  );
}
