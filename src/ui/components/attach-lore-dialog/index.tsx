/**
 * AttachLoreDialog - multi-select library lorebooks to attach as knowledgeRefs.
 * Multi-select books is OK; Write for stays single-select.
 */
import { useMemo, useState, type JSX } from "react";
import type { StudioEntitySummary } from "../../app-contract";
import { InkDialog } from "../ink-dialog";
import styles from "./styles.module.css";

export interface AttachLoreDialogProps {
  books: readonly StudioEntitySummary[];
  alreadyLinked: readonly string[];
  onConfirm: (ids: string[]) => void;
  onDismiss: () => void;
}

export function AttachLoreDialog({
  books,
  alreadyLinked,
  onConfirm,
  onDismiss,
}: AttachLoreDialogProps): JSX.Element {
  const linked = useMemo(() => new Set(alreadyLinked), [alreadyLinked]);
  const available = books.filter((b) => b.kind === "lorebook" && !linked.has(b.id));
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const toggle = (id: string): void => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selected = [...picked];

  return (
    <InkDialog onDismiss={onDismiss} ariaLabel="Attach lorebooks">
      <div className={styles.body}>
        <h2 className={styles.h}>Attach lorebooks</h2>
        <p className={styles.p}>
          Pick one or more library books. Order on the character is the Knowledge rail; Write for stays
          single-select on each book.
        </p>
        {available.length === 0 ? (
          <p className={styles.empty}>No more lorebooks in the library to attach.</p>
        ) : (
          <ul className={styles.list}>
            {available.map((b) => (
              <li key={b.id}>
                <label className={styles.row}>
                  <input
                    type="checkbox"
                    checked={picked.has(b.id)}
                    onChange={() => toggle(b.id)}
                  />
                  <span className={styles.name}>{b.name || b.id}</span>
                  <span className={styles.id}>{b.id}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={onDismiss}>
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.primary}`}
            disabled={selected.length === 0}
            onClick={() => onConfirm(selected)}
          >
            Attach {selected.length > 0 ? `(${selected.length})` : ""}
          </button>
        </div>
      </div>
    </InkDialog>
  );
}
