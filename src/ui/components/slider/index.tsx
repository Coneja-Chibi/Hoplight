/**
 * Slider - a reusable labeled range control: a value plus min/max/step and a live readout. A
 * standalone value+onChange primitive so any surface binds it call-and-response (the editor's native
 * platform fields, later settings), not just the canonical number fields inside the editor's own
 * controlFor. Tokens only; the thumb is the house ink square.
 */
import type { JSX } from "react";
import styles from "./styles.module.css";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(value: number): void;
  /** readout formatter (default: the raw value) */
  format?(value: number): string;
  "aria-label"?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  "aria-label": ariaLabel,
}: SliderProps): JSX.Element {
  return (
    <div className={styles.wrap}>
      <input
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className={styles.readout}>{format ? format(value) : String(value)}</span>
    </div>
  );
}
