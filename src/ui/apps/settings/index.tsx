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
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.1"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>';

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
