/**
 * KeywordChips - the desk's trigger editor: one chip per keyword, an inline input that commits on
 * Enter/comma, Backspace on an empty input removes the last chip. Regex triggers wear a /re/ mark
 * and are preserved untouched (the chip editor never rewrites flags or probability riders).
 */
import { useState, type JSX, type KeyboardEvent } from "react";
import type { Trigger } from "../../../../entities/lorebook/schema";

export interface KeywordChipsProps {
  triggers: Trigger[];
  onChange: (next: Trigger[]) => void;
  styles: Readonly<Record<string, string>>;
  placeholder?: string;
  ariaLabel: string;
  /** advanced mode: clicking a chip picks it for the rider editor below (TriggerEditor owns state) */
  pickedIndex?: number | null;
  onPick?: (index: number) => void;
}

export function KeywordChips({
  triggers,
  onChange,
  styles,
  placeholder,
  ariaLabel,
  pickedIndex,
  onPick,
}: KeywordChipsProps): JSX.Element {
  const [draft, setDraft] = useState("");

  const commit = (): void => {
    const keyword = draft.trim().replace(/,+$/, "").trim();
    setDraft("");
    if (!keyword) return;
    if (triggers.some((t) => t.keyword === keyword)) return; // duplicates are a bug, not a feature
    onChange([...triggers, { keyword, isRegex: false }]);
  };

  const onKey = (ev: KeyboardEvent<HTMLInputElement>): void => {
    if (ev.key === "Enter" || ev.key === ",") {
      ev.preventDefault();
      commit();
      return;
    }
    if (ev.key === "Backspace" && draft === "" && triggers.length > 0) {
      ev.preventDefault();
      onChange(triggers.slice(0, -1));
    }
  };

  return (
    <div className={styles.keybox} role="group" aria-label={ariaLabel}>
      {triggers.map((t, i) => (
        <span
          key={t.keyword}
          className={i === pickedIndex ? `${styles.key} ${styles.keyPicked}` : styles.key}
        >
          {onPick ? (
            <button
              type="button"
              className={styles.keyLabel}
              aria-pressed={i === pickedIndex}
              title="Edit this key's dials"
              onClick={() => onPick(i)}
            >
              {t.isRegex ? `/${t.keyword}/` : t.keyword}
            </button>
          ) : (
            t.isRegex ? `/${t.keyword}/` : t.keyword
          )}
          <button
            type="button"
            className={styles.keyx}
            aria-label={`remove ${t.keyword}`}
            onClick={() => onChange(triggers.filter((x) => x.keyword !== t.keyword))}
          >
            &times;
          </button>
        </span>
      ))}
      <input
        className={styles.keyin}
        value={draft}
        placeholder={placeholder ?? "add a word…"}
        aria-label={ariaLabel}
        onChange={(ev) => setDraft(ev.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
      />
    </div>
  );
}
