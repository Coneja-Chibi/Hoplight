/**
 * Focused TOC entry card: EntryItem *style* (violet card, chip actions), studios content.
 * Matching / memo / recursion live on the page (Keys, When & where), not here.
 * Order / priority / scan edit in When & where; #badge is order readout.
 * Beside is a first-class action. Keep (ignore budget) is the only expand chrom dial.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import { Check, FolderOpen, Columns2 } from "lucide-react";
import type { LorebookCategory, LorebookEntry } from "../../../../entities/lorebook/schema";
import { fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { entryFireMode, fireModePatch, type EntryFireMode } from "./entry-fire-mode";
import { ModeSelect } from "./entry-toc-mode";

export interface EntryTocItemProps {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  categories: readonly LorebookCategory[];
  onPatch: (patch: Partial<LorebookEntry>) => void;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenBeside?: () => void;
}

export function EntryTocItem({
  entry,
  writeFor,
  styles,
  categories,
  onPatch,
  onOpen,
  onDuplicate,
  onDelete,
  onOpenBeside,
}: EntryTocItemProps): JSX.Element {
  const [showMove, setShowMove] = useState(false);
  const moveRef = useRef<HTMLDivElement | null>(null);
  const show = (key: Parameters<typeof fieldVisible>[1]): boolean => fieldVisible(writeFor, key);
  const mode = entryFireMode(entry);
  const vectorOk = show("vectorized");
  const canMode = show("constant");
  const canCategory = show("categoryId") && categories.length > 0;
  const canOrder = show("sortOrder");
  const canPri = show("priority");
  const canScan = show("scanDepth");
  const hasChromRead = canOrder || canPri || canScan;

  useEffect(() => {
    if (!showMove) return;
    const onDoc = (ev: MouseEvent): void => {
      if (moveRef.current && !moveRef.current.contains(ev.target as Node)) {
        setShowMove(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showMove]);

  const setCategory = (categoryId: string | null): void => {
    onPatch({ categoryId });
    setShowMove(false);
  };

  const scanTxt =
    entry.scanDepth === null || entry.scanDepth === undefined ? "-" : String(entry.scanDepth);

  return (
    <div className={styles.eiCard}>
      <div className={styles.eiHead}>
        <button
          type="button"
          className={entry.enabled ? styles.eiToggle : `${styles.eiToggle} ${styles.eiToggleOff}`}
          role="switch"
          aria-checked={entry.enabled}
          aria-label={entry.enabled ? "Entry on" : "Entry off"}
          onClick={() => onPatch({ enabled: !entry.enabled })}
        />
        <span
          className={entry.constant ? styles.eiBadgeC : styles.eiBadgeS}
          title={entry.constant ? "Always on" : "Keyword / selective"}
        >
          {entry.constant ? "C" : "S"}
        </span>
        <span className={styles.eiTitle}>{entry.title || "(untitled)"}</span>
        {canOrder && (
          <span className={styles.eiHash} title="Order (edit in When and where)">
            #{entry.sortOrder}
          </span>
        )}
      </div>

      {canMode && (
        <div className={styles.eiMode}>
          <ModeSelect
            mode={mode}
            vectorOk={vectorOk}
            styles={styles}
            onChange={(m: EntryFireMode) => onPatch(fireModePatch(m))}
          />
        </div>
      )}

      <div className={styles.eiActs} role="group" aria-label="Entry actions">
        <button type="button" className={styles.eiOpen} onClick={onOpen}>
          Open
        </button>
        {onOpenBeside && (
          <button type="button" className={styles.eiBeside} onClick={onOpenBeside}>
            <Columns2 size={12} strokeWidth={2.25} aria-hidden />
            Beside
          </button>
        )}
        {canCategory && (
          <div className={styles.eiMoveWrap} ref={moveRef}>
            <button
              type="button"
              className={styles.eiMove}
              aria-expanded={showMove}
              aria-haspopup="listbox"
              onClick={() => setShowMove((v) => !v)}
            >
              <FolderOpen size={12} strokeWidth={2.25} aria-hidden />
              Move
            </button>
            {showMove && (
              <div className={styles.eiMoveMenu} role="listbox" aria-label="Move to category">
                <p className={styles.eiMoveLab}>Move to...</p>
                <button
                  type="button"
                  role="option"
                  aria-selected={!entry.categoryId}
                  className={
                    !entry.categoryId
                      ? `${styles.eiMoveOpt} ${styles.eiMoveOptOn}`
                      : styles.eiMoveOpt
                  }
                  onClick={() => setCategory(null)}
                >
                  <span className={styles.eiMoveCheck}>
                    {!entry.categoryId ? <Check size={12} strokeWidth={2.5} aria-hidden /> : null}
                  </span>
                  Uncategorized
                </button>
                <div className={styles.eiMoveSep} />
                {categories.map((cat) => {
                  const on = entry.categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={
                        on ? `${styles.eiMoveOpt} ${styles.eiMoveOptOn}` : styles.eiMoveOpt
                      }
                      onClick={() => setCategory(cat.id)}
                    >
                      <span className={styles.eiMoveCheck}>
                        {on ? (
                          <Check size={12} strokeWidth={2.5} aria-hidden />
                        ) : (
                          <FolderOpen size={12} strokeWidth={2} aria-hidden />
                        )}
                      </span>
                      <span className={styles.eiMoveName}>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <button type="button" className={styles.eiCopy} onClick={onDuplicate}>
          Copy
        </button>
        <button type="button" className={styles.eiDel} onClick={onDelete}>
          Delete
        </button>
      </div>

      {/* Chrom: live readout of placement numbers + Keep. Numbers edit in When & where. */}
      <div className={styles.eiChrom} role="group" aria-label="Entry chrom">
        {hasChromRead && (
          <p className={styles.eiChromRead} title="Edit order, priority, and scan in When and where">
            {canOrder && (
              <span>
                <i>Order</i> {entry.sortOrder}
              </span>
            )}
            {canPri && (
              <span>
                <i>Priority</i> {entry.priority}
              </span>
            )}
            {canScan && (
              <span>
                <i>Scan</i> {scanTxt}
              </span>
            )}
          </p>
        )}
        <button
          type="button"
          className={
            entry.ignoreBudget
              ? styles.eiKeep
              : `${styles.eiKeep} ${styles.eiKeepOff}`
          }
          role="switch"
          aria-checked={entry.ignoreBudget}
          aria-label="Always keep: skip the token budget"
          onClick={() => onPatch({ ignoreBudget: !entry.ignoreBudget })}
        >
          <span className={styles.eiKeepLab}>Keep</span>
          <span className={styles.eiKeepSw} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
