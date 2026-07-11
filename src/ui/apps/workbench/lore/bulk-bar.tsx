/**
 * Floating bulk action bar for the lore TOC select mode (vs-lore-page-2).
 * Registry-checked: no existing bulk-bar; InkDialog not needed (inline bar).
 */
import type { JSX } from "react";

export interface BulkBarProps {
  count: number;
  styles: Readonly<Record<string, string>>;
  onEnable: (on: boolean) => void;
  onDelete: () => void;
  onClear: () => void;
  onMove?: () => void;
}

export function LoreBulkBar({
  count,
  styles,
  onEnable,
  onDelete,
  onClear,
  onMove,
}: BulkBarProps): JSX.Element {
  return (
    <div className={styles.bulkBar} role="toolbar" aria-label="Bulk entry actions">
      <div className={styles.bTop}>
        <b>
          {count} selected
        </b>
        <button type="button" className={styles.bx} aria-label="Clear selection" onClick={onClear}>
          &times;
        </button>
      </div>
      <div className={styles.bActs}>
        <button type="button" className={styles.bAct} onClick={() => onEnable(true)}>
          On
        </button>
        <button type="button" className={styles.bAct} onClick={() => onEnable(false)}>
          Off
        </button>
        <button
          type="button"
          className={styles.bAct}
          disabled={!onMove}
          title={onMove ? "Split selected entries into a new book" : "Move unavailable"}
          onClick={() => onMove?.()}
        >
          Move…
        </button>
        <button
          type="button"
          className={`${styles.bAct} ${styles.bActDanger}`}
          onClick={() => {
            if (window.confirm(`Delete ${count} entr${count === 1 ? "y" : "ies"}? This cannot be undone from here.`)) {
              onDelete();
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
