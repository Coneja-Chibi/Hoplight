/**
 * Character knowledge rail: list/attach/detach/reorder library lorebooks via knowledgeRefs.
 * Stage-token skin in knowledge-rail.module.css (the rail is dark in both themes).
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { AttachLoreDialog } from "../../../components/attach-lore-dialog";
import {
  attachKnowledgeRef,
  detachKnowledgeRef,
  missingKnowledgeRefs,
  reorderKnowledgeRef,
} from "./knowledge-refs";
import styles from "./knowledge-rail.module.css";

export interface KnowledgeRailProps {
  ctx: AppContext;
  refs: readonly string[];
  onChange: (next: string[]) => void;
}

export function KnowledgeRail({ ctx, refs, onChange }: KnowledgeRailProps): JSX.Element {
  const [books, setBooks] = useState<StudioEntitySummary[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    void ctx.api.listEntities("lorebook").then(setBooks).catch(() => setBooks([]));
  }, [ctx]);

  const known = new Set(books.map((b) => b.id));
  const missing = missingKnowledgeRefs(refs, known);
  const nameOf = (id: string): string => books.find((b) => b.id === id)?.name ?? id;

  return (
    <section aria-label="Linked lorebooks" className={styles.rail}>
      <div className={styles.head}>Knowledge</div>
      {refs.length === 0 && <div className={styles.empty}>No library books linked.</div>}
      {refs.map((id, i) => (
        <div key={id} className={styles.row}>
          <button
            type="button"
            className={missing.includes(id) ? `${styles.book} ${styles.bookMissing}` : styles.book}
            onClick={() => {
              const hit = books.find((b) => b.id === id);
              if (hit) ctx.workbench.send(hit);
              else ctx.setStatus(`missing lorebook · ${id}`);
            }}
            title={missing.includes(id) ? "Missing from library" : "Open in Workbench"}
          >
            {nameOf(id)}
            {missing.includes(id) ? " (missing)" : ""}
          </button>
          <button
            type="button"
            className={styles.op}
            disabled={i === 0}
            onClick={() => onChange(reorderKnowledgeRef(refs, id, i - 1))}
            aria-label="Move up"
          >
            &#8593;
          </button>
          <button
            type="button"
            className={styles.op}
            disabled={i >= refs.length - 1}
            onClick={() => onChange(reorderKnowledgeRef(refs, id, i + 1))}
            aria-label="Move down"
          >
            &#8595;
          </button>
          <button
            type="button"
            className={styles.op}
            onClick={() => onChange(detachKnowledgeRef(refs, id))}
            aria-label="Detach"
          >
            &times;
          </button>
        </div>
      ))}
      <button type="button" className={styles.attach} onClick={() => setDialogOpen(true)}>
        Attach lorebook…
      </button>
      {dialogOpen && (
        <AttachLoreDialog
          books={books}
          alreadyLinked={refs}
          onDismiss={() => setDialogOpen(false)}
          onConfirm={(ids) => {
            let next = [...refs];
            for (const id of ids) next = attachKnowledgeRef(next, id);
            onChange(next);
            setDialogOpen(false);
          }}
        />
      )}
    </section>
  );
}
