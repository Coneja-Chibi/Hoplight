/**
 * Settings - built entirely from DROP-IN SECTIONS (sections/registry): the tab bar derives from
 * the registry, each tab renders its section's controls, and every control is call-and-response
 * against the live settings (the shell applies theme/accent instantly). Adding a settings tab =
 * one file + one registry line; this room names no section.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext, HoplightApp } from "../../app-contract";
import { settingsSections } from "./sections/registry";
import styles from "./styles.module.css";

/** the locked gear mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
  '<circle cx="12" cy="12" r="3"/>' +
  '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
  "</svg>";

function SettingsRoom({ ctx }: { ctx: AppContext }): JSX.Element | null {
  const sections = settingsSections();
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  useEffect(() => {
    const section = sections.find((s) => s.id === activeId) ?? sections[0];
    if (section) ctx.setStatus(section.label.toLowerCase());
  }, [ctx, activeId, sections]);

  if (!active) return null;
  const ActiveSection = active.Component;

  return (
    <div className={styles.room}>
      <div className={styles.tabs}>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === active.id ? `${styles.tab} ${styles.on}` : styles.tab}
            onClick={() => setActiveId(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className={styles.body}>
        <ActiveSection ctx={ctx} />
      </div>
    </div>
  );
}

const app: HoplightApp = {
  manifest: {
    id: "settings",
    title: "Settings",
    markSvg: MARK_SVG,
    accent: "#8a8496", // hardcode-ok: app identity accent, not theming
    order: 100,
    subtitle: "app",
    dockFoot: true,
  },
  Component: SettingsRoom,
};

export default app;
