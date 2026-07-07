/**
 * OptionCards - the pickable rose-PICKED option cards (lettered rank + title + optional sub), the shape
 * used by both the `select` field control and the quiz's rating card. Extracted from Editor.tsx where it
 * was written twice, near-identically. Takes the editor's style module so it reuses the exact chrome
 * (opts/opt/optOn/optMark/rank/optBody/optTitle/optSub) with no CSS duplication.
 */
import type { JSX } from "react";

export interface OptionCard {
  value: string;
  title: string;
  /** an optional second line (the rating cards use it; plain selects do not) */
  sub?: string;
}

export interface OptionCardsProps {
  options: readonly OptionCard[];
  value: string;
  onSelect(value: string): void;
  styles: Readonly<Record<string, string>>;
}

export function OptionCards({ options, value, onSelect, styles }: OptionCardsProps): JSX.Element {
  return (
    <div className={styles.opts}>
      {options.map((o, i) => {
        const on = value === o.value;
        return (
          <button
            key={o.value || "none"}
            type="button"
            className={`${styles.opt}${on ? ` ${styles.optOn}` : ""}`}
            onClick={() => onSelect(o.value)}
          >
            {on && <span className={styles.optMark}>Picked</span>}
            <span className={styles.rank}>{String.fromCharCode(65 + i)}</span>
            <span className={styles.optBody}>
              <span className={styles.optTitle}>{o.title}</span>
              {o.sub !== undefined && <span className={styles.optSub}>{o.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
