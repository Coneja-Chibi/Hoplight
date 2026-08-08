/**
 * FieldForm - a schema-driven set of labeled controls bound call-and-response to one object. The
 * reuse keystone for structured native data: give it a list of fields (text / number / select /
 * slider / toggle / textarea) and a value object, it renders the right control per field and reports
 * each edit by key. Every tracker module's value-set and every list item is one of these, so a new
 * shape is DATA (a schema), never new component code. Composes the house Slider and ToggleSwitch.
 */
import type { JSX } from "react";
import { ExpandTextarea } from "../expand";
import { Slider } from "../slider";
import { ToggleSwitch } from "../toggle-switch";
import styles from "./styles.module.css";

export type FormFieldKind = "text" | "textarea" | "number" | "select" | "slider" | "toggle" | "resource";

export interface FormField {
  key: string;
  label: string;
  kind: FormFieldKind;
  /** select options */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** number / slider bounds */
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** layout hint: render at half width so two sit per row */
  half?: boolean;
  /** `resource` only: the sibling key holding this value's max (renders a value bar + an editable max) */
  maxKey?: string;
}

export interface FieldFormProps {
  fields: readonly FormField[];
  value: Record<string, unknown>;
  onChange(key: string, next: unknown): void;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const numOr = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function control(field: FormField, value: unknown, set: (v: unknown) => void): JSX.Element {
  switch (field.kind) {
    case "textarea":
      return (
        <ExpandTextarea
          label={field.label}
          className={styles.ta}
          value={str(value)}
          placeholder={field.placeholder}
          onChange={(e) => set(e.target.value)}
        />
      );
    case "number":
      return (
        <input
          className={styles.num}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={typeof value === "number" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "select":
      return (
        <select className={styles.sel} value={str(value)} onChange={(e) => set(e.target.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "slider": {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      return (
        <Slider value={numOr(value, min)} min={min} max={max} step={field.step ?? 1} onChange={set} aria-label={field.label} />
      );
    }
    case "toggle":
      return <ToggleSwitch on={value === true} onChange={set} label={value === true ? "Yes" : "No"} />;
    case "text":
    default:
      return <input className={styles.text} value={str(value)} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />;
  }
}

/** a value/max resource bar: a slider bounded by its (editable) max, RC-style, instead of two boxes */
function ResourceControl({ field, value, onChange }: { field: FormField; value: Record<string, unknown>; onChange(key: string, v: unknown): void }): JSX.Element {
  const maxRaw = field.maxKey ? value[field.maxKey] : undefined;
  const max = typeof maxRaw === "number" && maxRaw > 0 ? maxRaw : 100;
  const cur = numOr(value[field.key], 0);
  return (
    <div className={styles.resource}>
      <Slider value={Math.min(cur, max)} min={0} max={max} step={1} onChange={(v) => onChange(field.key, v)} aria-label={field.label} />
      <input
        className={styles.rmax}
        type="number"
        min={0}
        value={typeof maxRaw === "number" ? maxRaw : ""}
        placeholder="max"
        onChange={(e) => field.maxKey && onChange(field.maxKey, e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </div>
  );
}

export function FieldForm({ fields, value, onChange }: FieldFormProps): JSX.Element {
  return (
    <div className={styles.grid}>
      {fields.map((f) => (
        <label className={f.half ? `${styles.field} ${styles.half}` : styles.field} key={f.key}>
          <span className={styles.label}>{f.label}</span>
          {f.kind === "resource" ? (
            <ResourceControl field={f} value={value} onChange={onChange} />
          ) : (
            control(f, value[f.key], (v) => onChange(f.key, v))
          )}
        </label>
      ))}
    </div>
  );
}
