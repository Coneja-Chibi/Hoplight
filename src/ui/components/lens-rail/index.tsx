/**
 * LensRail - the narrow-pane form of the platform lens strip: one line of chips that scrolls
 * sideways with an edge fade, never a stacked word-wall (design/vs-mobile-editors.html frame 1).
 * Same contract as PlatformTabs; the editor renders one or the other by pane width.
 */
import type { JSX } from "react";
import type { OffTarget } from "../platform-tabs";
import styles from "./styles.module.css";

export interface LensRailProps {
  platforms: ReadonlyArray<{ id: string; label: string }>;
  selected: readonly string[];
  onToggle(id: string): void;
  onClear(): void;
  offTarget: OffTarget;
  onOffTarget(m: OffTarget): void;
}

/** One-line sideways-scrolling lens chips; Hoplight (full card) first, off-target mode at the tail. */
export function LensRail({ platforms, selected, onToggle, onClear, offTarget, onOffTarget }: LensRailProps): JSX.Element {
  return (
    <div className={styles.rail}>
      <div className={styles.scroll} role="tablist" aria-label="Writing for platform">
        <button
          type="button"
          role="tab"
          aria-selected={selected.length === 0}
          className={`${styles.chip}${selected.length === 0 ? ` ${styles.on}` : ""}`}
          onClick={onClear}
        >
          Hoplight
        </button>
        {platforms.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={selected.includes(p.id)}
            className={`${styles.chip}${selected.includes(p.id) ? ` ${styles.on}` : ""}`}
            onClick={() => onToggle(p.id)}
          >
            {p.label}
          </button>
        ))}
        <span className={styles.offt}>
          <button
            type="button"
            className={`${styles.chip}${offTarget === "hide" ? ` ${styles.on}` : ""}`}
            title="Hide fields the selected platform can't carry"
            onClick={() => onOffTarget("hide")}
          >
            Hide
          </button>
          <button
            type="button"
            className={`${styles.chip}${offTarget === "dim" ? ` ${styles.on}` : ""}`}
            title="Same as hide for now: off-target fields leave so lean platforms stay lean"
            onClick={() => onOffTarget("dim")}
          >
            Dim
          </button>
        </span>
      </div>
      <span className={styles.fade} aria-hidden="true" />
    </div>
  );
}
