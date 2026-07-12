/**
 * WriteForStrip - the single-select "Write for" host pills shared by the sheet editors (regex,
 * persona). One profile is authored-for at a time; off-target fields leave the surface, data
 * stays. Extracted from twin hand-rolls in the regex and persona headers (shared-once law).
 * The character editor's multi-select coverage lens is PlatformTabs - a different semantic
 * (target SET + off-target treatment), not served by this strip.
 */
import type { JSX } from "react";
import styles from "./styles.module.css";

export interface WriteForStripProps<P extends string> {
  profiles: readonly P[];
  labels: Readonly<Record<P, string>>;
  value: P;
  onChange(next: P): void;
}

export function WriteForStrip<P extends string>({
  profiles,
  labels,
  value,
  onChange,
}: WriteForStripProps<P>): JSX.Element {
  return (
    <span className={styles.strip} role="group" aria-label="Write for one host">
      <i className={styles.stripLabel}>Write for</i>
      {profiles.map((p) => (
        <button
          key={p}
          type="button"
          className={value === p ? `${styles.pill} ${styles.pillOn}` : styles.pill}
          aria-pressed={value === p}
          onClick={() => onChange(p)}
        >
          {labels[p]}
        </button>
      ))}
    </span>
  );
}
