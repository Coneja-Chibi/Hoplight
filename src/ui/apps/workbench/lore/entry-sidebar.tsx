/**
 * LoreEntrySidebar - the desk's left column (vs-lorebook-desk-f): the entry list with the focused
 * entry's quick controls expanded in place, and the stagehand stack at the foot (budget, focused
 * entry health, try-a-line). Collapsed stagehand rows still show their live value.
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { estimateEntryTokens, type LoreHealthNote } from "../../../../core/lore";
import type { LoreSession } from "./session";
import { SampleMatchStage } from "./sample-match-stage";

export interface EntrySidebarProps {
  session: LoreSession;
  styles: Readonly<Record<string, string>>;
  health: LoreHealthNote[];
  /** rough whole-book estimate (core estimateBookTokens) */
  bookEstimate: number;
  onSelect: (id: string) => void;
  onOpenBeside: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onPatchEntry: (id: string, patch: Partial<LorebookEntry>) => void;
}

/** inherit -> on -> off -> inherit (the entry's tri-state matching override) */
const cycleTri = (v: boolean | null): boolean | null => (v === null ? true : v ? false : null);
const triLabel = (v: boolean | null): string => (v === null ? "inherit" : v ? "on" : "off");

function QuickControls({
  entry,
  styles,
  onDuplicate,
  onDelete,
  onMove,
  onPatchEntry,
}: {
  entry: LorebookEntry;
  styles: Readonly<Record<string, string>>;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onPatchEntry: (patch: Partial<LorebookEntry>) => void;
}): JSX.Element {
  return (
    <div className={styles.exBody}>
      <div className={styles.exActs}>
        <button type="button" className={styles.ract} onClick={() => onMove(-1)} aria-label="Move up">
          &#8593;
        </button>
        <button type="button" className={styles.ract} onClick={() => onMove(1)} aria-label="Move down">
          &#8595;
        </button>
        <button type="button" className={styles.ract} onClick={onDuplicate}>
          Copy
        </button>
        <button type="button" className={`${styles.ract} ${styles.ractDanger}`} onClick={onDelete}>
          Delete
        </button>
      </div>
      <div className={styles.exLabel}>Matching</div>
      <div className={styles.exActs}>
        <button
          type="button"
          className={styles.ract}
          title="Override the book default for this entry"
          onClick={() => onPatchEntry({ matchWholeWords: cycleTri(entry.matchWholeWords) })}
        >
          Whole words · {triLabel(entry.matchWholeWords)}
        </button>
        <button
          type="button"
          className={styles.ract}
          title="Override the book default for this entry"
          onClick={() => onPatchEntry({ caseSensitive: cycleTri(entry.caseSensitive) })}
        >
          Case · {triLabel(entry.caseSensitive)}
        </button>
      </div>
    </div>
  );
}

export function LoreEntrySidebar({
  session,
  styles,
  health,
  bookEstimate,
  onSelect,
  onOpenBeside,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
  onPatchEntry,
}: EntrySidebarProps): JSX.Element {
  const { body, openIds, focusedId } = session;
  const budget = body.tokenBudget;
  const focused = focusedId !== null ? body.entries.find((e) => e.id === focusedId) ?? null : null;
  const focusedNotes = focused ? health.filter((h) => h.entryId === focused.id) : [];

  return (
    <aside className={styles.side} aria-label="Entries">
      <div className={styles.sbar}>
        <span className={styles.sbarLabel}>Entries</span>
        <button type="button" className={styles.sAdd} onClick={onAdd} title="New entry">
          +
        </button>
      </div>

      <div className={styles.slist}>
        {body.entries.length === 0 && <div className={styles.empty}>The book is empty. Add an entry.</div>}
        {body.entries.map((e) => {
          const isOpen = openIds.includes(e.id);
          const isFocused = e.id === focusedId;
          const rowClass = [
            styles.srow,
            isOpen ? styles.srowOpen : "",
            isFocused ? styles.srowFocused : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={e.id} className={rowClass}>
              <div className={styles.srowLine}>
                <button type="button" className={styles.srowBtn} onClick={() => onSelect(e.id)}>
                  <span
                    className={
                      !e.enabled ? `${styles.sdot} ${styles.sdotOff}`
                      : e.constant ? `${styles.sdot} ${styles.sdotConst}`
                      : styles.sdot
                    }
                  />
                  <span className={styles.skind}>{e.constant ? "C" : "S"}</span>
                  <span className={styles.stitle}>{e.title || "(untitled)"}</span>
                  <span className={styles.stok}>{estimateEntryTokens(e)}</span>
                </button>
                {!isOpen && (
                  <button
                    type="button"
                    className={styles.sBeside}
                    title="Open in a second panel, beside the focused one"
                    aria-label={`Open ${e.title || "(untitled)"} beside`}
                    onClick={() => onOpenBeside(e.id)}
                  >
                    &#10064;
                  </button>
                )}
              </div>
              {isFocused && (
                <QuickControls
                  entry={e}
                  styles={styles}
                  onDuplicate={() => onDuplicate(e.id)}
                  onDelete={() => onDelete(e.id)}
                  onMove={(dir) => onMove(e.id, dir)}
                  onPatchEntry={(patch) => onPatchEntry(e.id, patch)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.stagehand}>
        <div className={styles.shHead}>
          Stagehand <span className={styles.shLive}>live</span>
        </div>

        <div className={styles.shRow}>
          <span className={styles.shLabel}>Budget</span>
          <span className={styles.shValue}>
            ~{bookEstimate}{budget > 0 ? ` / ${budget}` : ""} tok
          </span>
        </div>
        {budget > 0 && (
          <div className={styles.meter} role="img" aria-label={`about ${bookEstimate} of ${budget} budget tokens`}>
            <i style={{ width: `${Math.min(100, Math.round((bookEstimate / budget) * 100))}%` }} />
          </div>
        )}

        <div className={styles.shRow}>
          <span className={styles.shLabel}>Focused entry</span>
          <span className={styles.shValue}>
            {focused
              ? focusedNotes.length > 0
                ? `${focusedNotes.length} tip${focusedNotes.length === 1 ? "" : "s"}`
                : "ready"
              : "none"}
          </span>
        </div>
        {focused && (
          <div className={styles.shNotes}>
            <span className={styles.shNote}>
              {focused.triggers.length} keys · ~{estimateEntryTokens(focused)} tok
            </span>
            {focusedNotes.slice(0, 3).map((h) => (
              <span key={h.code} className={h.level === "warn" ? styles.healthWarn : styles.shNote}>
                {h.message}
              </span>
            ))}
          </div>
        )}

        <SampleMatchStage entries={body.entries} styles={styles} />
      </div>
    </aside>
  );
}
