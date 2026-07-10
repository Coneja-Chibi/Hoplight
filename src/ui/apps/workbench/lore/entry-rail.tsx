/**
 * LoreEntryRail - the binder's right margin: the try-a-line tester and quiet health tips for the
 * focused entry. The entry's fine print (order/priority/keep/chance/matching + actions) lives in
 * the TOC's expanded row, not here.
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import type { LoreHealthNote } from "../../../../core/lore";
import { SampleMatchStage } from "./sample-match-stage";

export interface EntryRailProps {
  entries: readonly LorebookEntry[];
  notes: readonly LoreHealthNote[];
  styles: Readonly<Record<string, string>>;
}

export function LoreEntryRail({ entries, notes, styles }: EntryRailProps): JSX.Element {
  return (
    <aside className={styles.rail} aria-label="Try a line and health">
      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Try a line</b>
          <i>would it fire?</i>
        </div>
        <div className={styles.rbody}>
          <SampleMatchStage entries={[...entries]} styles={styles} />
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
        </div>
      </div>
    </aside>
  );
}
