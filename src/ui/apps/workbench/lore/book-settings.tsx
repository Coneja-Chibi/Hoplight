/**
 * Lorebook-level settings: identity (name, description, type, genre, fandom, tags), global
 * matching, budget - the full RC book wire (formats/rolecall/lorebook.ts bookToWire is the
 * checklist). Lives inside the desk's Book settings fold; the Write for profile is the desk
 * strip's job, not this form's; categories are the SIDEBAR's folders, not a form here.
 */
import type { JSX } from "react";
import type { LorebookBody, LorebookType } from "../../../../entities/lorebook/schema";
import { CsvInput } from "./csv-input";

export interface BookSettingsProps {
  body: LorebookBody;
  styles: Readonly<Record<string, string>>;
  onBook: (patch: Partial<LorebookBody>) => void;
}

const BOOK_TYPES: readonly [LorebookType, string][] = [
  ["world", "World"],
  ["character", "Character"],
  ["scenario", "Scenario"],
  ["rules", "Rules"],
  ["utility", "Utility"],
  ["other", "Other"],
];

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
        <textarea
          className={styles.textarea}
          style={{ minHeight: "3.5rem" }}
          value={body.description ?? ""}
          onChange={(ev) => onBook({ description: ev.target.value || null })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Kind of book</span>
        <select
          className={styles.select}
          value={body.lorebookType ?? "other"}
          onChange={(ev) => onBook({ lorebookType: ev.target.value as LorebookType })}
        >
          {BOOK_TYPES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Genre</span>
        <input
          className={styles.input}
          value={body.genre ?? ""}
          onChange={(ev) => onBook({ genre: ev.target.value || null })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Fandom</span>
        <input
          className={styles.input}
          value={body.fandom ?? ""}
          onChange={(ev) => onBook({ fandom: ev.target.value || null })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Tags (discovery metadata, comma-separated)</span>
        <CsvInput
          value={body.tags}
          onCommit={(tags) => onBook({ tags })}
          className={styles.input}
          ariaLabel="Book tags, comma-separated"
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
          <option value="token">count tokens</option>
          <option value="entry">count entries</option>
        </select>
      </label>
      {body.budgetMode === "entry" && (
        <label className={styles.field}>
          <span className={styles.label}>Entry budget (max entries injected)</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            value={body.entryBudget}
            onChange={(ev) => onBook({ entryBudget: Number(ev.target.value) || 0 })}
          />
        </label>
      )}
    </>
  );
}
