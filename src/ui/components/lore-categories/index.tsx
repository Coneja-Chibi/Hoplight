/**
 * LoreCategories - edit body.categories (Risu folders / NAI categories / RC folders).
 */
import type { JSX } from "react";
import type { LorebookCategory } from "../../../entities/lorebook/schema";
import { newUiId } from "../../_shared/new-id";
import styles from "./styles.module.css";

export interface LoreCategoriesProps {
  categories: readonly LorebookCategory[];
  onChange: (next: LorebookCategory[]) => void;
}

export function LoreCategories({ categories, onChange }: LoreCategoriesProps): JSX.Element {
  const list = [...categories];

  const patchAt = (i: number, patch: Partial<LorebookCategory>): void => {
    const next = list.map((c, j) => (j === i ? { ...c, ...patch } : c));
    onChange(next);
  };

  const removeAt = (i: number): void => {
    onChange(list.filter((_, j) => j !== i));
  };

  const add = (): void => {
    onChange([
      ...list,
      {
        id: newUiId("cat_"),
        name: "New category",
        sortOrder: list.length,
        enabled: true,
      },
    ]);
  };

  return (
    <div className={styles.wrap} role="group" aria-label="Categories">
      <div className={styles.head}>
        <span className={styles.label}>Categories / folders</span>
        <button type="button" className={styles.add} onClick={add}>
          + category
        </button>
      </div>
      {list.length === 0 && (
        <p className={styles.empty}>None yet. Risu folders and NAI categories map here.</p>
      )}
      <ul className={styles.list}>
        {list.map((c, i) => (
          <li key={c.id} className={styles.row}>
            <input
              className={styles.name}
              value={c.name}
              aria-label="Category name"
              onChange={(ev) => patchAt(i, { name: ev.target.value })}
            />
            <input
              className={styles.id}
              value={c.id}
              aria-label="Category id"
              onChange={(ev) => patchAt(i, { id: ev.target.value || c.id })}
            />
            <label className={styles.on}>
              <input
                type="checkbox"
                checked={c.enabled !== false}
                onChange={(ev) => patchAt(i, { enabled: ev.target.checked })}
              />
              on
            </label>
            <button type="button" className={styles.rm} onClick={() => removeAt(i)} aria-label="Remove">
              &times;
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
