/**
 * NativeCard - renders one platform's NATIVE fields (the extras it keeps to itself) as a card of real
 * controls, bound call-and-response to the entity's kept-whole original. Composes the reusable house
 * primitives (Slider, ToggleSwitch, and a compact note editor) so a platform's "everything else"
 * becomes editable instead of frozen. The schema TYPES live here (leaf layer); the per-platform
 * schema DATA lives in the editor (apps/workbench/native-fields.ts) and imports these.
 */
import type { JSX } from "react";
import { Slider } from "../slider";
import { ToggleSwitch } from "../toggle-switch";
import styles from "./styles.module.css";

/** Which reusable control renders a native field. Grown as each approved component lands. */
export type NativeControl = "slider" | "toggle" | "note";

export interface NativeField {
  /** dot path relative to entity.original */
  path: string;
  label: string;
  control: NativeControl;
  help?: string;
  slider?: { min: number; max: number; step?: number };
}

export interface NativeSchema {
  key: string;
  label: string;
  fields: NativeField[];
}

export interface NativeCardProps {
  schema: NativeSchema;
  /** read a value at a path relative to entity.original */
  read(path: string): unknown;
  /** write a value at a path relative to entity.original */
  write(path: string, value: unknown): void;
}

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function fieldControl(field: NativeField, read: (p: string) => unknown, write: (p: string, v: unknown) => void): JSX.Element {
  switch (field.control) {
    case "slider": {
      const s = field.slider ?? { min: 0, max: 1, step: 0.05 };
      return (
        <Slider
          value={num(read(field.path), s.min)}
          min={s.min}
          max={s.max}
          step={s.step ?? 1}
          onChange={(v) => write(field.path, v)}
          format={(v) => v.toFixed(2)}
          aria-label={field.label}
        />
      );
    }
    case "toggle": {
      const on = read(field.path) === true;
      return <ToggleSwitch on={on} onChange={(next) => write(field.path, next)} label={on ? "On" : "Off"} />;
    }
    case "note": {
      const p = field.path;
      return (
        <div className={styles.note}>
          <textarea
            className={styles.ta}
            value={str(read(`${p}.prompt`))}
            placeholder="Character's note..."
            onChange={(e) => write(`${p}.prompt`, e.target.value)}
          />
          <div className={styles.noterow}>
            <span className={styles.k}>Depth</span>
            <input
              className={styles.num}
              type="number"
              value={num(read(`${p}.depth`), 4)}
              onChange={(e) => write(`${p}.depth`, Number(e.target.value))}
            />
            <span className={styles.k}>Role</span>
            <select
              className={styles.sel}
              value={str(read(`${p}.role`)) || "system"}
              onChange={(e) => write(`${p}.role`, e.target.value)}
            >
              <option value="system">system</option>
              <option value="user">user</option>
              <option value="assistant">assistant</option>
            </select>
          </div>
        </div>
      );
    }
  }
}

export function NativeCard({ schema, read, write }: NativeCardProps): JSX.Element {
  return (
    <section className={styles.card}>
      <div className={styles.head}>{schema.label} fields</div>
      {schema.fields.map((f) => (
        <div className={styles.field} key={f.path}>
          <div className={styles.label}>{f.label}</div>
          {f.help ? <div className={styles.help}>{f.help}</div> : null}
          {fieldControl(f, read, write)}
        </div>
      ))}
    </section>
  );
}
