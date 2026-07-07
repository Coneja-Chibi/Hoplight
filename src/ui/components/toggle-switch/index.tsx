/**
 * ToggleSwitch - the house on/off pill switch, a standalone value+onChange primitive so any surface
 * binds it (the editor's native platform fields; a natural fit for settings later). Distinct from
 * FocusToggle (an icon button) and SegControl (a 2+ segmented pick): this is a single boolean.
 */
import type { JSX } from "react";
import styles from "./styles.module.css";

export interface ToggleSwitchProps {
  on: boolean;
  onChange(on: boolean): void;
  /** text shown beside the switch (already cased by the caller) */
  label?: string;
}

export function ToggleSwitch({ on, onChange, label }: ToggleSwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={on ? `${styles.btn} ${styles.on}` : styles.btn}
      onClick={() => onChange(!on)}
    >
      <span className={styles.track}>
        <span className={styles.knob} />
      </span>
      {label ? <span className={styles.label}>{label}</span> : null}
    </button>
  );
}
