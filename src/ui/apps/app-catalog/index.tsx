/**
 * Apps is the packaged-app catalog reached through the Dock's Add app control. Its inventory comes
 * from AppContext manifests, never a second list. Catalog-only tools such as CSS Workshop remain
 * fully bundled and mountable without occupying the everyday Dock.
 */
import { useEffect } from "react";
import type { CSSProperties, JSX } from "react";
import type { AppContext, AppManifestEntry, HoplightApp } from "../../app-contract";
import { AppMark } from "../../components/app-mark";
import { Stamp } from "../../components/stamp";
import { officialCatalogApps } from "./catalog-core";
import styles from "./styles.module.css";

const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
  '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/>' +
  '<rect x="4" y="14" width="6" height="6"/><path d="M17 14v6M14 17h6"/></svg>';

const descriptionFor = (app: AppManifestEntry): string =>
  app.agentSurface?.describe ?? `${app.title} is included with this build of Hoplight.`;

function AppCard({ app, ctx }: { app: AppManifestEntry; ctx: AppContext }): JSX.Element {
  return (
    <article className={styles.card} style={{ "--a": app.accent } as CSSProperties}>
      <div className={styles.cardHead}>
        <AppMark markSvg={app.markSvg} className={styles.mark} />
        <h2 className={styles.name}>{app.title}</h2>
      </div>
      <p className={styles.description}>{descriptionFor(app)}</p>
      <div className={styles.cardFoot}>
        <span className={styles.status}>{app.catalogOnly ? "Included app" : "On your Dock"}</span>
        <Stamp onClick={() => ctx.openApp(app.id)}>Open</Stamp>
      </div>
    </article>
  );
}

/** Browse and open every official app packaged in this build. */
export function AppCatalog({ ctx }: { ctx: AppContext }): JSX.Element {
  const apps = officialCatalogApps(ctx.apps());

  useEffect(() => {
    ctx.setStatus(`apps · ${apps.length} included`);
  }, [apps.length, ctx]);

  return (
    <div className={styles.room}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>Apps in this build</span>
        <h1 className={styles.title}>Official Hoplight apps</h1>
        <p className={styles.lede}>
          Everything here shipped with this copy of Hoplight. Open a room when you need it; compact
          specialist tools stay here instead of crowding your everyday Dock.
        </p>
      </header>

      <section className={styles.grid} aria-label="Official packaged apps">
        {apps.map((app) => <AppCard key={app.id} app={app} ctx={ctx} />)}
      </section>
    </div>
  );
}

const app: HoplightApp = {
  manifest: {
    id: "app-catalog",
    title: "Apps",
    markSvg: MARK_SVG,
    accent: "#5b8def", // hardcode-ok: app identity accent, not theme chrome
    order: 80,
    catalogOnly: true,
    appCatalog: true,
    agentSurface: { describe: "Catalog of official applications packaged with this build of Hoplight." },
  },
  Component: AppCatalog,
};

export default app;
