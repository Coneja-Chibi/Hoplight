/**
 * The bento card (vs-editor-2, transcribed 1:1 from the locked wireframe's .card anatomy): hot top
 * line, header row (big-face title, affordance chips, filled dot, lens carry tag, reorder arrows,
 * fold chevron), foldable body. Lens-aware: `off` + `offMode` render dim/hide; `missing` renders
 * "not carried on: X". Platform-blind by construction - callers compute verdicts from coverage
 * data (editor-core lensVerdict); this component only wears them.
 */
import { useState, type JSX, type ReactNode } from "react";
import styles from "./styles.module.css";

export interface BentoCardProps {
  title: string;
  /** header affordance chips (the wireframe's ? / wand / convert slots) */
  aff?: ReactNode;
  /** the "has content" dot; omit to hide the dot */
  filled?: boolean;
  /** lens verdict: no selected platform carries this card */
  off?: boolean;
  offMode?: "dim" | "hide";
  /** selected platform labels that do NOT carry this card */
  missing?: string[];
  /** reorder arrows (center prose cards); absent = fixed card */
  onMove?: (dir: -1 | 1) => void;
  children: ReactNode;
}

/** One card of the editor bento. Folds from its chevron; lens states per vs-editor-2. */
export function BentoCard({ title, aff, filled, off, offMode = "dim", missing, onMove, children }: BentoCardProps): JSX.Element | null {
  const [folded, setFolded] = useState(false);
  if (off && offMode === "hide") return null;
  return (
    <section className={`${styles.card}${off ? ` ${styles.off}` : ""}`}>
      <header className={styles.head}>
        <span className={styles.title}>{title}</span>
        {aff !== undefined && <span className={styles.aff}>{aff}</span>}
        {filled !== undefined && <span className={`${styles.dot}${filled ? ` ${styles.full}` : ""}`} />}
        {missing !== undefined && missing.length > 0 && (
          <span className={styles.carry}>{`not carried on: ${missing.join(", ")}`}</span>
        )}
        {onMove && (
          <span className={styles.move}>
            <button type="button" onClick={() => onMove(-1)} title={`Move ${title} up`}>&#8593;</button>
            <button type="button" onClick={() => onMove(1)} title={`Move ${title} down`}>&#8595;</button>
          </span>
        )}
        <button
          type="button"
          className={styles.fold}
          onClick={() => setFolded((f) => !f)}
          aria-expanded={!folded}
          title={folded ? `Unfold ${title}` : `Fold ${title}`}
        >
          {folded ? "▸" : "▾"}
        </button>
      </header>
      {!folded && <div className={styles.body}>{children}</div>}
    </section>
  );
}
