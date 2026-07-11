/**
 * LoreEntryRail - the binder's right margin: try-a-line, health tips, launchers for full panes.
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import type { LoreHealthNote } from "../../../../core/lore";
import { SampleMatchStage } from "./sample-match-stage";

export interface EntryRailProps {
  entries: readonly LorebookEntry[];
  notes: readonly LoreHealthNote[];
  styles: Readonly<Record<string, string>>;
  onOpenHealth?: () => void;
  onOpenChanges?: () => void;
  onOpenRehearsal?: () => void;
}

export function LoreEntryRail({
  entries,
  notes,
  styles,
  onOpenHealth,
  onOpenChanges,
  onOpenRehearsal,
}: EntryRailProps): JSX.Element {
  return (
    <aside className={styles.rail} aria-label="Try a line and health">
      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Try a line</b>
          <i>would it fire?</i>
        </div>
        <div className={styles.rbody}>
          <SampleMatchStage entries={[...entries]} styles={styles} />
          {onOpenRehearsal && (
            <button type="button" className={styles.texpBtn} onClick={onOpenRehearsal}>
              Open Rehearsal
            </button>
          )}
        </div>
      </div>

      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Health</b>
          <i>quiet tips</i>
        </div>
        <div className={styles.rbody}>
          {notes.length === 0 && <div className={styles.healthOk}>&#9679; This entry is ready.</div>}
          {notes.slice(0, 4).map((h) => (
            <div key={h.code} className={h.level === "warn" ? styles.healthTip : styles.healthOk}>
              {h.level === "warn" ? <>&#9650; </> : <>&#9679; </>}
              {h.message}
            </div>
          ))}
          {onOpenHealth && (
            <button type="button" className={styles.texpBtn} onClick={onOpenHealth}>
              Open the full check
            </button>
          )}
          {onOpenChanges && (
            <button type="button" className={styles.texpBtn} onClick={onOpenChanges}>
              Open Changes
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}