/**
 * Recommendations - RoleCall's recommendations bundle: four groups (presets, lorebooks, regexes,
 * personas) of things the creator suggests pairing with the character. Thin plumbing over ListEditor
 * with each group's field schema (base name/note/priority + type-specific flags from RoleCall's
 * RoleCallRecommendation subtypes). "Bundle content with card" is the include_in_export flag; the
 * bundled content itself (linkedLorebooks / linkedRegexScripts) rides the original until the Lorebook
 * / Regex editors exist to edit it in place.
 */
import type { JSX } from "react";
import { ListEditor } from "../list-editor";
import type { FormField } from "../field-form";
import styles from "./styles.module.css";

const asRec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

const base: FormField[] = [
  { key: "name", label: "Name", kind: "text" },
  { key: "note", label: "Note", kind: "textarea" },
  { key: "priority", label: "Priority", kind: "number", half: true },
];

interface Group {
  key: string;
  label: string;
  addLabel: string;
  fields: FormField[];
}
const GROUPS: Group[] = [
  {
    key: "presets",
    label: "Presets",
    addLabel: "+ recommend a preset",
    fields: [...base, { key: "loadout_code", label: "Loadout code", kind: "text", half: true }],
  },
  {
    key: "lorebooks",
    label: "Lorebooks",
    addLabel: "+ recommend a lorebook",
    fields: [
      ...base,
      { key: "auto_enable", label: "Auto-enable on import", kind: "toggle", half: true },
      { key: "include_in_export", label: "Bundle content with card", kind: "toggle", half: true },
    ],
  },
  {
    key: "regexes",
    label: "Regexes",
    addLabel: "+ recommend a regex",
    fields: [...base, { key: "auto_enable", label: "Auto-enable on import", kind: "toggle", half: true }],
  },
  { key: "personas", label: "Personas", addLabel: "+ recommend a persona", fields: base },
];

export interface RecommendationsProps {
  value: Record<string, unknown>;
  onChange(next: Record<string, unknown>): void;
}

export function Recommendations({ value, onChange }: RecommendationsProps): JSX.Element {
  const rec = asRec(value);
  return (
    <div className={styles.wrap}>
      {GROUPS.map((g) => (
        <div className={styles.group} key={g.key}>
          <div className={styles.ghead}>{g.label}</div>
          <ListEditor
            items={asArr(rec[g.key])}
            fields={g.fields}
            onChange={(next) => onChange({ ...rec, [g.key]: next })}
            addLabel={g.addLabel}
            itemTitle={(it) => str(it.name) || "Unnamed"}
          />
        </div>
      ))}
    </div>
  );
}
