/**
 * RuleToc - the quiet table of contents (design/vs-regex-editor.html .toc). Each row shows the rule
 * name, an on/off pip, and the COMPUTED doesLine (never stored); the foot adds a new rule. The Select
 * toggle and the slow chip are placeholders for later slices (bulk ops / persisted telemetry) - shown
 * disabled/absent rather than faked, so the TOC never lies about state it does not have.
 */
import type { JSX } from "react";
import type { RegexRule } from "../../../../entities/regex/schema";
import { doesLine } from "./does-line";

export interface RuleTocProps {
  rules: readonly RegexRule[];
  focusedId: string | null;
  styles: Readonly<Record<string, string>>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  /** Rule ids wearing the quiet "slow" chip (R4 health); absent = no chips. */
  slowIds?: ReadonlySet<string>;
}

export function RuleToc({ rules, focusedId, styles, onSelect, onAdd, slowIds }: RuleTocProps): JSX.Element {
  return (
    <aside className={styles.toc}>
      <p className={styles.tocTitle}>
        Rules
        <button
          type="button"
          className={styles.selMode}
          disabled
          title="Bulk select comes in a later slice"
        >
          Select
        </button>
      </p>

      {rules.map((rule) => {
        const on = focusedId === rule.id;
        return (
          <button
            key={rule.id}
            type="button"
            className={on ? `${styles.trow} ${styles.trowOn}` : styles.trow}
            aria-pressed={on}
            onClick={() => onSelect(rule.id)}
          >
            <span className={styles.trowName}>
              <span
                className={rule.enabled ? `${styles.pip} ${styles.pipOn}` : `${styles.pip} ${styles.pipOff}`}
                aria-hidden="true"
              />
              {rule.label.trim() || "Untitled rule"}
              {slowIds?.has(rule.id) && <span className={styles.trowSlow}>slow</span>}
            </span>
            <span className={styles.trowDoes}>{doesLine(rule)}</span>
          </button>
        );
      })}

      <button type="button" className={styles.tocAdd} onClick={onAdd}>
        + New rule
      </button>
    </aside>
  );
}
