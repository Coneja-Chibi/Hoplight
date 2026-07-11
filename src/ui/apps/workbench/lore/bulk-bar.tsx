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
  /** Move is Phase 2 (needs a target book); disabled until then. */
  moveDisabled?: boolean;
}

export function LoreBulkBar({
  count,
  styles,
  onEnable,
  onDelete,
  onClear,
  moveDisabled = true,
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
          disabled={moveDisabled}
          title={moveDisabled ? "Move to another book lands with the workshop (next)." : "Move to book…"}
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
