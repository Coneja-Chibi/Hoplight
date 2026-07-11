/**
 * Changes pane: facing From/To panels from diffBooks (vs-lore-changes).
 * Baseline is the body as it arrived this sitting (importBaseline).
 */
import { useMemo, type JSX } from "react";
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import { diffBooks, type FieldChange } from "../../../../core/lore";
import styles from "./changes-pane.module.css";

export interface ChangesPaneProps {
  baseline: LorebookBody;
  body: LorebookBody;
  onRevertField: (entryId: string, field: keyof LorebookEntry, value: unknown) => void;
  onRestoreEntry: (entry: LorebookEntry) => void;
  onUndoSwap: (aId: string, bId: string) => void;
  onJumpEntry: (entryId: string) => void;
  onClose: () => void;
}

function highlight(
  text: string,
  ranges: [number, number][] | undefined,
  kind: "del" | "ins",
): JSX.Element {
  if (!ranges || ranges.length === 0) {
    return <span>{text || "—"}</span>;
  }
  const parts: JSX.Element[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) {
      parts.push(<span key={`t${i}`}>{text.slice(cursor, start)}</span>);
    }
    parts.push(
      <span key={`h${i}`} className={kind === "del" ? styles.del : styles.ins}>
        {text.slice(start, end)}
      </span>,
    );
    cursor = end;
  });
  if (cursor < text.length) {
    parts.push(<span key="tail">{text.slice(cursor)}</span>);
  }
  return <>{parts}</>;
}

function FieldRow({
  change,
  entryId,
  onRevert,
}: {
  change: FieldChange;
  entryId: string;
  onRevert: () => void;
}): JSX.Element {
  return (
    <div className={styles.field}>
      <div className={styles.fieldK}>{String(change.field)}</div>
      <div className={styles.diffCols}>
        <div className={styles.dFrom}>
          {highlight(change.fromText, change.words?.fromRanges, "del")}
        </div>
        <div className={styles.dTo}>
          {highlight(change.toText, change.words?.toRanges, "ins")}
        </div>
      </div>
      <button type="button" className={styles.revert} onClick={onRevert}>
        Revert
      </button>
    </div>
  );
}

export function ChangesPane({
  baseline,
  body,
  onRevertField,
  onRestoreEntry,
  onUndoSwap,
  onJumpEntry,
  onClose,
}: ChangesPaneProps): JSX.Element {
  const diff = useMemo(() => diffBooks(baseline, body), [baseline, body]);
  const empty =
    diff.edited.length === 0 &&
    diff.reordered.length === 0 &&
    diff.added.length === 0 &&
    diff.removed.length === 0;

  return (
    <aside className={styles.pane} aria-label="Changes">
      <div className={styles.head}>
        <b>Changes</b>
        <i>since this sitting opened</i>
        <button type="button" className={styles.x} aria-label="Close changes" onClick={onClose}>
          &times;
        </button>
      </div>
      {empty && <p className={styles.clean}>No changes yet this sitting.</p>}

      {diff.edited.map((ed) => {
        const title =
          body.entries.find((e) => e.id === ed.entryId)?.title ||
          ed.wasTitle ||
          ed.entryId;
        return (
          <section key={ed.entryId} className={styles.block}>
            <button
              type="button"
              className={styles.blockHead}
              onClick={() => onJumpEntry(ed.entryId)}
            >
              {title}
              {ed.wasTitle ? ` (was ${ed.wasTitle})` : ""}
            </button>
            {ed.changes.map((ch) => (
              <FieldRow
                key={String(ch.field)}
                change={ch}
                entryId={ed.entryId}
                onRevert={() => onRevertField(ed.entryId, ch.field, ch.from)}
              />
            ))}
          </section>
        );
      })}

      {diff.reordered.map((pair) => (
        <div key={`${pair.aId}-${pair.bId}`} className={styles.swap}>
          <span>Order swapped</span>
          <button type="button" className={styles.revert} onClick={() => onUndoSwap(pair.aId, pair.bId)}>
            Undo swap
          </button>
        </div>
      ))}

      {diff.added.map((id) => {
        const title = body.entries.find((e) => e.id === id)?.title || id;
        return (
          <div key={id} className={styles.added}>
            Added: {title}
          </div>
        );
      })}

      {diff.removed.map((e) => (
        <div key={e.id} className={styles.removed}>
          <span>Removed: {e.title || e.id}</span>
          <button type="button" className={styles.revert} onClick={() => onRestoreEntry(e)}>
            Bring back
          </button>
        </div>
      ))}
    </aside>
  );
}
