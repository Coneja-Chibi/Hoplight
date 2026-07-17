/**
 * AltFields - Lumiverse alternate prose variants per ST field.
 * Wire: extensions.alternate_fields {
 *   description|personality|scenario?: Array<{ id?, label, content }>
 * }
 */
import type { JSX } from "react";
import { newUiId } from "../../_shared/new-id";
import { ListEditor } from "../list-editor";
import type { FormField } from "../field-form";
import styles from "./styles.module.css";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");

const KEYS = ["description", "personality", "scenario"] as const;
export type AltFieldKey = (typeof KEYS)[number];

export type AltFieldsValue = Partial<Record<AltFieldKey, Rec[]>>;

export interface AltFieldsProps {
  value: unknown;
  onChange(next: AltFieldsValue): void;
}

const ROW_FIELDS: readonly FormField[] = [
  { key: "label", label: "Label", kind: "text", placeholder: "Formal", half: true },
  { key: "content", label: "Content", kind: "textarea" },
];

function asRows(v: unknown): Rec[] {
  if (!Array.isArray(v)) return [];
  return v.map((row) => {
    const r = rec(row);
    return {
      id: str(r.id) || undefined,
      label: str(r.label),
      content: str(r.content),
    };
  });
}

export function normalizeAltFields(value: unknown): AltFieldsValue {
  const v = rec(value);
  const out: AltFieldsValue = {};
  for (const k of KEYS) {
    const rows = asRows(v[k]);
    if (rows.length > 0) out[k] = rows;
  }
  return out;
}

/** New alt-row identity; collision-resistant (never Date.now alone). */
export function newAltFieldId(): string {
  return newUiId("alt_");
}

export function AltFields({ value, onChange }: AltFieldsProps): JSX.Element {
  const v = normalizeAltFields(value);

  const setKey = (key: AltFieldKey, rows: Rec[]): void => {
    const next: AltFieldsValue = { ...v };
    if (rows.length === 0) delete next[key];
    else next[key] = rows;
    onChange(next);
  };

  return (
    <div className={styles.wrap}>
      {KEYS.map((key) => (
        <div className={styles.section} key={key}>
          <div className={styles.gtitle}>{key} variants</div>
          <ListEditor
            items={v[key] ?? []}
            fields={ROW_FIELDS}
            addLabel={`+ add ${key} variant`}
            makeItem={() => ({ id: newAltFieldId(), label: "", content: "" })}
            itemTitle={(it, i) => str(it.label) || `Variant ${i + 1}`}
            onChange={(rows) => setKey(key, rows)}
          />
        </div>
      ))}
    </div>
  );
}
