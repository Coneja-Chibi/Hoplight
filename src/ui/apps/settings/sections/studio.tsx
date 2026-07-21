/**
 * Settings section: Studio - the home app (which room opens on start), the first deck the
 * Library shows, and the publish targets (data-driven from the live format registry, exactly
 * like the setup wizard's plates). Every "change it later" promise from setup lands here.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { knownDecks } from "../../../_shared/decks";
import { SegControl, SettingsRow, type SettingsSection } from "../section-contract";
import styles from "../styles.module.css";

function StudioSection({ ctx }: { ctx: AppContext }): JSX.Element {
  // home app: any real everyday Dock app can be home; catalog-only tools are destinations, not landings
  const apps = ctx.apps().filter((m) => !m.comingSoon && !m.dockFoot && !m.catalogOnly);
  const [home, setHome] = useState<string>(() => {
    const h = ctx.prefs.get(SETTING_KEYS.homeApp);
    return typeof h === "string" && apps.some((m) => m.id === h) ? h : (apps[0]?.id ?? "");
  });

  // first deck: which shelf the Library opens on
  const [firstDeck, setFirstDeck] = useState<string>(() => {
    const f = ctx.prefs.get(SETTING_KEYS.firstDeck);
    return typeof f === "string" && f ? f : "character";
  });

  // publish targets: same data-driven plates as setup (platforms from the registry, never a list)
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(() => {
    const p = ctx.prefs.get(SETTING_KEYS.publishTargets);
    return new Set(Array.isArray(p) ? (p as string[]) : []);
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const formats = await ctx.api.formats();
      const list = [...new Set(formats.filter((f) => !f.native).map((f) => f.friendly))].sort((a, b) =>
        a.localeCompare(b),
      );
      if (!cancelled) setPlatforms(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  const togglePlatform = (p: string): void => {
    const next = new Set(picked);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setPicked(next);
    ctx.prefs.set(SETTING_KEYS.publishTargets, [...next]);
  };

  return (
    <>
      <SettingsRow label="Home" hint="The room Vaude opens in when you start it.">
        <SegControl
          options={apps.map((m) => ({ value: m.id, label: m.title.replace(/^The /, "") }))}
          current={home}
          onPick={(v) => {
            ctx.prefs.set(SETTING_KEYS.homeApp, v);
            setHome(v);
          }}
        />
      </SettingsRow>
      <SettingsRow label="Library opens on" hint="The deck you see first when you visit the shelves.">
        <SegControl
          options={knownDecks().map((d) => ({ value: d.kind, label: d.plural }))}
          current={firstDeck}
          onPick={(v) => {
            ctx.prefs.set(SETTING_KEYS.firstDeck, v);
            setFirstDeck(v);
          }}
        />
      </SettingsRow>
      <SettingsRow label="You publish to" hint="Pick any that fit. Every format stays ready either way.">
        <div className={styles.plates}>
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              className={picked.has(p) ? `${styles.plate} ${styles.on}` : styles.plate}
              onClick={() => togglePlatform(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </SettingsRow>
    </>
  );
}

const section: SettingsSection = {
  id: "studio",
  label: "Studio",
  order: 20,
  Component: StudioSection,
};

export default section;
