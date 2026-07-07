/**
 * ListEditor - a repeating list of FieldForm items: add, remove, edit each by the same field schema.
 * The reuse keystone for every "list of things" native shape - a character's recommended lorebooks,
 * a tracker's NPCs / quests / inventory items / party members / knowledge entries / enemies, and so
 * on. Give it the item field schema and the array; it hands back the next array. No bespoke list code
 * per module. Composes FieldForm.
 */
import type { JSX } from "react";
import { FieldForm, type FormField } from "../field-form";
import styles from "./styles.module.css";

export interface ListEditorProps {
  items: Record<string, unknown>[];
  /** the field schema for one item */
  fields: readonly FormField[];
  onChange(next: Record<string, unknown>[]): void;
  addLabel?: string;
  /** header shown per item (default: the first field's value, else "Item N") */
  itemTitle?(item: Record<string, unknown>, index: number): string;
  /** defaults for a freshly added item */
  makeItem?(): Record<string, unknown>;
}

export function ListEditor({ items, fields, onChange, addLabel, itemTitle, makeItem }: ListEditorProps): JSX.Element {
  const list = Array.isArray(items) ? items : [];
  const editItem = (i: number, key: string, v: unknown): void =>
    onChange(list.map((it, ix) => (ix === i ? { ...it, [key]: v } : it)));
  const removeItem = (i: number): void => onChange(list.filter((_, ix) => ix !== i));
  const add = (): void => onChange([...list, makeItem ? makeItem() : {}]);

  const titleOf = (it: Record<string, unknown>, i: number): string => {
    if (itemTitle) return itemTitle(it, i);
    const firstKey = fields[0]?.key;
    const v = firstKey ? it[firstKey] : undefined;
    return typeof v === "string" && v ? v : `Item ${i + 1}`;
  };

  return (
    <div className={styles.wrap}>
      {list.map((it, i) => (
        <div className={styles.item} key={i}>
          <div className={styles.ihead}>
            <span className={styles.ititle}>{titleOf(it, i)}</span>
            <button type="button" className={styles.rm} onClick={() => removeItem(i)}>
              remove
            </button>
          </div>
          <FieldForm fields={fields} value={it} onChange={(key, v) => editItem(i, key, v)} />
        </div>
      ))}
      <button type="button" className={styles.add} onClick={add}>
        {addLabel ?? "+ add"}
      </button>
    </div>
  );
}
