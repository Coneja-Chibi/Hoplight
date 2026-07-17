/**
 * PlaybillView - the "acts" presenter: portrait + sealed rail on the left, FIELD_MODULES grouped into
 * acts in the center, The Bill jump-nav on the right. Platform leftovers (native schema) render as
 * their own section + nav entries — same items as bento, different wrapping (RC/ST pattern).
 * Pure layout; no state; no second ownership path for body fields.
 */
import type { JSX, ReactNode } from "react";
import type { FieldModule } from "../fields";
import type { NativeFieldItem } from "../../../components/native-card";

export interface Act {
  id: string;
  no: string;
  title: string;
  ids: readonly string[];
}

export interface PlaybillViewProps {
  leftCard: ReactNode;
  sealedCard: ReactNode;
  acts: readonly Act[];
  actModules(ids: readonly string[]): FieldModule[];
  lensHides(m: FieldModule): boolean;
  lensDims(m: FieldModule): boolean;
  wideKinds: ReadonlySet<string>;
  panelKinds: ReadonlySet<string>;
  controlFor(m: FieldModule): JSX.Element;
  nativeItems: NativeFieldItem[];
  nativeSection(items: NativeFieldItem[]): JSX.Element | null;
  nativeNav(items: NativeFieldItem[]): JSX.Element[];
  styles: Readonly<Record<string, string>>;
}

export function PlaybillView({
  leftCard,
  sealedCard,
  acts,
  actModules,
  lensHides,
  lensDims,
  wideKinds,
  panelKinds,
  controlFor,
  nativeItems,
  nativeSection,
  nativeNav,
  styles,
}: PlaybillViewProps): JSX.Element {
  const renderModule = (m: FieldModule): JSX.Element => {
    const wide = wideKinds.has(m.kind) || panelKinds.has(m.kind);
    const panel = panelKinds.has(m.kind);
    const dim = lensDims(m) ? ` ${styles.dimlens}` : "";
    if (panel) {
      return (
        <div
          key={m.id}
          className={`${styles.pbPanel}${wide ? ` ${styles.span2}` : ""}${dim}`}
        >
          <div className={styles.pbPanelHead}>
            <span className={styles.pbPanelTitle}>{m.sheetLabel}</span>
            {m.helper ? <span className={styles.pbPanelHelp}>{m.helper}</span> : null}
          </div>
          <div className={styles.pbPanelBody}>{controlFor(m)}</div>
        </div>
      );
    }
    return (
      <div
        key={m.id}
        className={`${styles.pbfield}${wide ? ` ${styles.span2}` : ""}${dim}`}
      >
        <span className={styles.blabel}>
          {m.sheetLabel}
          {m.required && <span className={styles.qreq}> *</span>}
        </span>
        {controlFor(m)}
      </div>
    );
  };

  /** visualKind + sprite share one panel so they stop fighting as two bare fields */
  const renderActModules = (mods: FieldModule[]): JSX.Element[] => {
    const out: JSX.Element[] = [];
    const byId = new Map(mods.map((m) => [m.id, m]));
    const seen = new Set<string>();
    for (const m of mods) {
      if (seen.has(m.id)) continue;
      if (m.id === "visualKind" || m.id === "sprite") {
        if (seen.has("visualKind") || seen.has("sprite")) continue;
        const kind = byId.get("visualKind");
        const sprite = byId.get("sprite");
        if (kind) seen.add("visualKind");
        if (sprite) seen.add("sprite");
        out.push(
          <div key="visual-sprite" className={`${styles.pbPanel} ${styles.span2}`}>
            <div className={styles.pbPanelHead}>
              <span className={styles.pbPanelTitle}>Visual</span>
              <span className={styles.pbPanelHelp}>
                Portrait vs layered sprite, then the sprite recipe when you use one.
              </span>
            </div>
            <div className={styles.pbPanelBody}>
              {kind ? (
                <div className={styles.pbSub}>
                  <span className={styles.pbSubLabel}>{kind.sheetLabel}</span>
                  {controlFor(kind)}
                </div>
              ) : null}
              {sprite ? (
                <div className={styles.pbSub}>
                  <span className={styles.pbSubLabel}>{sprite.sheetLabel}</span>
                  {controlFor(sprite)}
                </div>
              ) : null}
            </div>
          </div>,
        );
        continue;
      }
      seen.add(m.id);
      out.push(renderModule(m));
    }
    return out;
  };

  return (
    <div className={styles.playbill}>
      <div className={styles.pbLeft}>
        {leftCard}
        {sealedCard}
      </div>
      <div className={styles.pbForm}>
        {acts.map((act) => {
          const mods = actModules(act.ids).filter((m) => !lensHides(m));
          if (mods.length === 0) return null;
          return (
            <section key={act.id} id={`act-${act.id}`} className={styles.act}>
              <div className={styles.actbreak}>
                <span className={styles.abar} />
                <span className={styles.amid}>
                  <span className={styles.ano}>{act.no}</span>
                  <span className={styles.anm}>{act.title}</span>
                </span>
                <span className={styles.abar} />
              </div>
              <div className={styles.pbfields}>{renderActModules(mods)}</div>
            </section>
          );
        })}
        {nativeSection(nativeItems)}
      </div>
      <aside className={styles.pbBill}>
        <div className={styles.pbTitle}>The Bill</div>
        <p className={styles.pbSay}>Jump to any act.</p>
        <ul className={styles.toc}>
          {acts.map((act) => {
            const n = actModules(act.ids).filter((m) => !lensHides(m)).length;
            if (n === 0) return null;
            return (
              <li key={act.id}>
                <a href={`#act-${act.id}`}>
                  <span className={styles.tno}>{act.no}</span>
                  <span className={styles.tnm}>{act.title}</span>
                  <span className={styles.tct}>{n}</span>
                </a>
              </li>
            );
          })}
          {nativeNav(nativeItems)}
        </ul>
      </aside>
    </div>
  );
}
