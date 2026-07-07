/**
 * PlaybillView - the "acts" presenter: portrait + sealed rail on the left, the fields grouped into acts
 * in the center, and The Bill jump-nav on the right. Pure layout over the one FIELD_MODULES registry
 * (via the injected controlFor + lens verdicts); it owns no state, so the shell passes everything in.
 * Native platform fields render as their own section + nav entries. Lifted from Editor.tsx.
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
  controlFor,
  nativeItems,
  nativeSection,
  nativeNav,
  styles,
}: PlaybillViewProps): JSX.Element {
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
              <div className={styles.pbfields}>
                {mods.map((m) => (
                  <div
                    key={m.id}
                    className={`${styles.pbfield}${wideKinds.has(m.kind) ? ` ${styles.span2}` : ""}${lensDims(m) ? ` ${styles.dimlens}` : ""}`}
                  >
                    <span className={styles.blabel}>
                      {m.sheetLabel}
                      {m.required && <span className={styles.qreq}> *</span>}
                    </span>
                    {controlFor(m)}
                  </div>
                ))}
              </div>
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
