/**
 * Shared mono select for Workshop builders and Test Bench event picker.
 */
import type { JSX } from "react";
import styles from "./styles.module.css";

export interface MiniSelectProps {
  opts: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange(value: string): void;
}

export function MiniSelect({ opts, value, onChange }: MiniSelectProps): JSX.Element {
  return (
    <select className={styles.mini} value={value} onChange={(e) => onChange(e.target.value)}>
      {opts.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

export const WORKSHOP_EVENTS: ReadonlyArray<readonly [string, string]> = [
  ["output", "After the model replies"],
  ["input", "After you send"],
  ["start", "When the chat starts"],
];
