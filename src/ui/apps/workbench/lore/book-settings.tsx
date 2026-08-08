/**
 * Lorebook-level settings: name, description, global matching, budget, categories.
 * Lives inside the desk's Book settings fold; Write for is the desk strip's job.
 */
import type { JSX } from "react";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import { ExpandTextarea } from "../../../components/expand";
import { LoreCategories } from "../../../components/lore-categories";

export interface BookSettingsProps {
  body: LorebookBody;
  styles: Readonly<Record<string, string>>;
  onBook: (patch: Partial<LorebookBody>) => void;
}

export function LoreBookSettings({ body, styles, onBook }: BookSettingsProps): JSX.Element {
  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>Book name</span>
        <input
          className={styles.input}
          value={body.name}
          onChange={(ev) => onBook({ name: ev.target.value })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Description</span>
        <ExpandTextarea
          label="Book description"
          className={styles.textarea}
          style={{ minHeight: "3.5rem" }}
          value={body.description ?? ""}
          onChange={(ev) => onBook({ description: ev.target.value || null })}
        />
      </label>
      <label className={styles.chip}>
        <input
          type="checkbox"
          checked={body.globalCaseSensitive}
          onChange={(ev) => onBook({ globalCaseSensitive: ev.target.checked })}
        />{" "}
        Case sensitive (default)
      </label>
      <label className={styles.chip}>
        <input
          type="checkbox"
          checked={body.globalMatchWholeWords}
          onChange={(ev) => onBook({ globalMatchWholeWords: ev.target.checked })}
        />{" "}
        Whole words (default)
      </label>
      <label className={styles.chip}>
        <input
          type="checkbox"
          checked={body.globalRecursion}
          onChange={(ev) => onBook({ globalRecursion: ev.target.checked })}
        />{" "}
        Recursion (default)
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Global scan depth</span>
        <input
          className={styles.input}
          type="number"
          min={0}
          value={body.globalScanDepth}
          onChange={(ev) => onBook({ globalScanDepth: Number(ev.target.value) || 0 })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Token budget</span>
        <input
          className={styles.input}
          type="number"
          min={0}
          value={body.tokenBudget}
          onChange={(ev) => onBook({ tokenBudget: Number(ev.target.value) || 0 })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Budget mode</span>
        <select
          className={styles.select}
          value={body.budgetMode}
          onChange={(ev) =>
            onBook({ budgetMode: ev.target.value === "entry" ? "entry" : "token" })
          }
        >
          <option value="token">token</option>
          <option value="entry">entry</option>
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Entry budget (when mode is entry)</span>
        <input
          className={styles.input}
          type="number"
          min={0}
          value={body.entryBudget}
          onChange={(ev) => onBook({ entryBudget: Number(ev.target.value) || 0 })}
        />
      </label>
      <LoreCategories
        categories={body.categories ?? []}
        onChange={(categories) => onBook({ categories: categories.length ? categories : undefined })}
      />
    </>
  );
}
