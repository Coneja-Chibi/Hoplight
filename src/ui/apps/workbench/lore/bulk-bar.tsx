/**
 * Floating bulk action bar for the lore TOC select mode (vs-lore-page-2).
 * Delete is destructive: an InkDialog confirm sheet gates it (no bare browser confirm).
 */
import { useState } from "react";
import type { JSX } from "react";
import { InkDialog } from "../../../components/ink-dialog";

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
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
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </button>
        </div>
      </div>

      {confirmOpen && (
        <InkDialog onDismiss={() => setConfirmOpen(false)} ariaLabel="Delete entries">
          <div className={styles.bcSheet}>
            <b className={styles.bcTitle}>
              Delete {count} {count === 1 ? "entry" : "entries"}?
            </b>
            <p className={styles.bcBody}>There is no undo.</p>
            <div className={styles.bcActs}>
              <button
                type="button"
                className={styles.bcGo}
                onClick={() => {
                  setConfirmOpen(false);
                  onDelete();
                }}
              >
                Delete
              </button>
              <button type="button" className={styles.bcKeep} onClick={() => setConfirmOpen(false)}>
                Keep
              </button>
            </div>
          </div>
        </InkDialog>
      )}
    </>
  );
}
