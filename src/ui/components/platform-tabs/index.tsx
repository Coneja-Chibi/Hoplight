/**
 * The platform-tabs strip (vs-editor-2, transcribed): multi-select target platforms plus the
 * off-target treatment control. Tabs come from coverage DATA - this component names no platform.
 * Empty selection = the VAUDE tab is on (the full canonical card, nothing judged). Reusable by
 * any editor kind: lorebooks and presets get the same strip against their own coverage.
 */
import type { JSX } from "react";
import styles from "./styles.module.css";

export type OffTarget = "dim" | "hide";

export interface PlatformTabInfo {
  id: string;
  label: string;
}

export interface PlatformTabsProps {
  platforms: PlatformTabInfo[];
  /** selected platform ids (the target set); empty = the full card */
  selected: string[];
  onToggle(id: string): void;
  onClear(): void;
  offTarget: OffTarget;
  onOffTarget(mode: OffTarget): void;
}

/** Multi-select platform lens tabs + the dim/hide off-target switch (vs-editor-2). */
export function PlatformTabs({ platforms, selected, onToggle, onClear, offTarget, onOffTarget }: PlatformTabsProps): JSX.Element {
  return (
    <div className={styles.strip}>
      <button
        type="button"
        className={`${styles.tab}${selected.length === 0 ? ` ${styles.on}` : ""}`}
        onClick={onClear}
        title="The full canonical card: every field lit, nothing judged"
      >
        Vaude <i className={styles.hint}>full card</i>
      </button>
      {platforms.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`${styles.tab}${selected.includes(p.id) ? ` ${styles.on}` : ""}`}
          onClick={() => onToggle(p.id)}
          title={`Target ${p.label}: select every platform you ship to`}
        >
          {p.label}
        </button>
      ))}
      <span className={styles.offt}>
        <i className={styles.hint}>off-target</i>
        <button
          type="button"
          className={offTarget === "hide" ? styles.on : undefined}
          onClick={() => onOffTarget("hide")}
          title="Off-target fields leave the form (recommended)"
        >
          Hide
        </button>
        <button
          type="button"
          className={offTarget === "dim" ? styles.on : undefined}
          onClick={() => onOffTarget("dim")}
          title="Same as hide for now: off-target fields leave so lean platforms stay lean"
        >
          Dim
        </button>
      </span>
    </div>
  );
}
