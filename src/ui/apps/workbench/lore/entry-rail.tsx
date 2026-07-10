/**
 * LoreEntryRail - the binder's fine print margin (vs-lorebook-binder-2): Order & survival for the
 * focused entry (label/value rows), the try-a-line tester, and quiet health tips. Entry actions
 * (copy/delete) live here too - the page keeps only the writing.
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { fieldVisible, type LoreHealthNote, type LoreWriteForProfile } from "../../../../core/lore";
import { SampleMatchStage } from "./sample-match-stage";

export interface EntryRailProps {
  entry: LorebookEntry;
  entries: readonly LorebookEntry[];
  notes: readonly LoreHealthNote[];
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}

/** inherit -> on -> off -> inherit (the entry's tri-state matching override) */
const cycleTri = (v: boolean | null): boolean | null => (v === null ? true : v ? false : null);
const triLabel = (v: boolean | null): string => (v === null ? "Inherit" : v ? "On" : "Off");

export function LoreEntryRail({
  entry,
  entries,
  notes,
  writeFor,
  styles,
  onPatch,
  onDuplicate,
  onDelete,
  onMove,
}: EntryRailProps): JSX.Element {
  const show = (key: Parameters<typeof fieldVisible>[1]): boolean => fieldVisible(writeFor, key);
  const needsDepth = entry.position === "depth" || entry.position === "append";

  return (
    <aside className={styles.rail} aria-label="The fine print">
      <p className={styles.railTitle}>The fine print</p>

      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Order &amp; survival</b>
          <i>this entry</i>
        </div>
        <div className={styles.rbody}>
          {show("sortOrder") && (
            <div className={styles.rrow}>
              <span className={styles.rk}>Order among siblings</span>
              <input
                className={styles.rvNum}
                type="number"
                value={entry.sortOrder}
                aria-label="Insertion order"
                onChange={(ev) => onPatch({ sortOrder: Number(ev.target.value) || 0 })}
              />
            </div>
          )}
          {show("priority") && (
            <div className={styles.rrow}>
              <span className={styles.rk}>Priority</span>
              <input
                className={styles.rvNum}
                type="number"
                value={entry.priority}
                aria-label="Budget priority"
                onChange={(ev) => onPatch({ priority: Number(ev.target.value) || 0 })}
              />
            </div>
          )}
          <div className={styles.rrow}>
            <span className={styles.rk}>Always keep</span>
            <button
              type="button"
              className={entry.ignoreBudget ? styles.rswitch : `${styles.rswitch} ${styles.rswitchOff}`}
              role="switch"
              aria-checked={entry.ignoreBudget}
              aria-label="Always keep: skip the token budget"
              onClick={() => onPatch({ ignoreBudget: !entry.ignoreBudget })}
            />
          </div>
          {show("probability") && (
            <div className={styles.rrow}>
              <span className={styles.rk}>Chance %</span>
              <input
                className={styles.rvNum}
                type="number"
                min={0}
                max={100}
                value={entry.probability}
                aria-label="Activation chance percent"
                onChange={(ev) => onPatch({ probability: Number(ev.target.value) || 0 })}
              />
            </div>
          )}
          {show("role") && needsDepth && (
            <div className={styles.rrow}>
              <span className={styles.rk}>Speaks as</span>
              <select
                className={styles.rvSel}
                value={entry.role}
                aria-label="Injected message role"
                onChange={(ev) => onPatch({ role: ev.target.value as LorebookEntry["role"] })}
              >
                <option value="system">System</option>
                <option value="user">User</option>
                <option value="assistant">Assistant</option>
              </select>
            </div>
          )}
          {show("scanDepth") && (
            <div className={styles.rrow}>
              <span className={styles.rk}>Scan depth</span>
              <input
                className={styles.rvNum}
                type="number"
                min={0}
                placeholder="—"
                value={entry.scanDepth ?? ""}
                aria-label="Scan depth (blank inherits the book default)"
                onChange={(ev) => {
                  const v = ev.target.value;
                  onPatch({ scanDepth: v === "" ? null : Number(v) || 0 });
                }}
              />
            </div>
          )}
          {show("matchOverrides") && (
            <>
              <div className={styles.rrow}>
                <span className={styles.rk}>Whole words</span>
                <button
                  type="button"
                  className={styles.rtri}
                  title="Override the book default for this entry"
                  onClick={() => onPatch({ matchWholeWords: cycleTri(entry.matchWholeWords) })}
                >
                  {triLabel(entry.matchWholeWords)}
                </button>
              </div>
              <div className={styles.rrow}>
                <span className={styles.rk}>Case sensitive</span>
                <button
                  type="button"
                  className={styles.rtri}
                  title="Override the book default for this entry"
                  onClick={() => onPatch({ caseSensitive: cycleTri(entry.caseSensitive) })}
                >
                  {triLabel(entry.caseSensitive)}
                </button>
              </div>
            </>
          )}
          <div className={styles.rrow}>
            <span className={styles.rk}>This entry</span>
            <span className={styles.racts}>
              <button type="button" className={styles.ract2} aria-label="Move up" onClick={() => onMove(-1)}>
                &#8593;
              </button>
              <button type="button" className={styles.ract2} aria-label="Move down" onClick={() => onMove(1)}>
                &#8595;
              </button>
              <button type="button" className={styles.ract2} onClick={onDuplicate}>
                Copy
              </button>
              <button type="button" className={`${styles.ract2} ${styles.ractDanger2}`} onClick={onDelete}>
                Delete
              </button>
            </span>
          </div>
        </div>
      </div>

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
