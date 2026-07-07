/**
 * RpgStats - a bespoke, no-code editor for a character's RPG stat block (Marinara's rpgStats, and any
 * platform that models attributes/health/resource pools). Attributes and pools are add/remove lists;
 * health is a value/max pair. Composes the house keystones (ListEditor, FieldForm, ToggleSwitch) so a
 * creator fills real controls, never raw JSON. Binds call-and-response to one plain object.
 */
import type { JSX } from "react";
import { ListEditor } from "../list-editor";
import { FieldForm, type FormField } from "../field-form";
import { ToggleSwitch } from "../toggle-switch";
import styles from "./styles.module.css";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);

export interface RpgStatsProps {
  value: Rec;
  onChange(next: Rec): void;
}

const ATTR_FIELDS: readonly FormField[] = [
  { key: "name", label: "Attribute", kind: "text", placeholder: "STR", half: true },
  { key: "value", label: "Value", kind: "number", half: true },
];
const HP_FIELDS: readonly FormField[] = [
  { key: "value", label: "HP", kind: "number", half: true },
  { key: "max", label: "Max HP", kind: "number", half: true },
];
const POOL_FIELDS: readonly FormField[] = [
  { key: "name", label: "Pool", kind: "text", placeholder: "Mana", half: true },
  { key: "color", label: "Color (hex)", kind: "text", placeholder: "#rrggbb", half: true },
  { key: "value", label: "Value", kind: "number", half: true },
  { key: "max", label: "Max", kind: "number", half: true },
];

export function RpgStats({ value, onChange }: RpgStatsProps): JSX.Element {
  const v = rec(value);
  const set = (key: string, next: unknown): void => onChange({ ...v, [key]: next });
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.k}>Stats enabled</span>
        <ToggleSwitch on={v.enabled === true} onChange={(on) => set("enabled", on)} label={v.enabled === true ? "On" : "Off"} />
      </div>
      <div className={styles.group}>
        <div className={styles.gtitle}>Attributes</div>
        <ListEditor items={arr(v.attributes)} fields={ATTR_FIELDS} addLabel="+ add attribute" onChange={(next) => set("attributes", next)} />
      </div>
      <div className={styles.group}>
        <div className={styles.gtitle}>Health</div>
        <FieldForm fields={HP_FIELDS} value={rec(v.hp)} onChange={(key, next) => set("hp", { ...rec(v.hp), [key]: next })} />
      </div>
      <div className={styles.group}>
        <div className={styles.gtitle}>Resource pools</div>
        <ListEditor items={arr(v.pools)} fields={POOL_FIELDS} addLabel="+ add pool" onChange={(next) => set("pools", next)} />
      </div>
    </div>
  );
}
