/**
 * LoreEntryToc - the binder's quiet table of contents: search, grouped rows with counts, accent
 * bar on the active row, disabled entries strike through. THE FOCUSED ROW EXPANDS IN PLACE with
 * the entry's fine print (order/priority/keep/chance/scan/matching + move/copy/delete) - the old
 * desk's expanded-row pattern, relocated here per Chi. Groups today: "Always on" + the rest;
 * category folders arrive with the categories milestone.
 */
import { useState, type JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";

export interface EntryTocProps {
  entries: readonly LorebookEntry[];
  focusedId: string | null;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<LorebookEntry>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}

/** inherit -> on -> off -> inherit (the entry's tri-state matching override) */
const cycleTri = (v: boolean | null): boolean | null => (v === null ? true : v ? false : null);
const triLabel = (v: boolean | null): string => (v === null ? "Inherit" : v ? "On" : "Off");

/** the focused row's fine print: the old desk exprow, grown up */
function FinePrint({
  entry,
  writeFor,
  styles,
  onPatch,
  onDuplicate,
  onDelete,
  onMove,
}: {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}): JSX.Element {
  const show = (key: Parameters<typeof fieldVisible>[1]): boolean => fieldVisible(writeFor, key);
  return (
    <div className={styles.texp}>
      {show("sortOrder") && (
        <div className={styles.texpRow}>
          <span className={styles.texpK}>Order</span>
          <input
            className={styles.texpNum}
            type="number"
            value={entry.sortOrder}
            aria-label="Insertion order"
            onChange={(ev) => onPatch({ sortOrder: Number(ev.target.value) || 0 })}
          />
        </div>
      )}
      {show("priority") && (
        <div className={styles.texpRow}>
          <span className={styles.texpK}>Priority</span>
          <input
            className={styles.texpNum}
            type="number"
            value={entry.priority}
            aria-label="Budget priority"
            onChange={(ev) => onPatch({ priority: Number(ev.target.value) || 0 })}
          />
        </div>
      )}
      <div className={styles.texpRow}>
        <span className={styles.texpK}>Always keep</span>
        <button
          type="button"
          className={entry.ignoreBudget ? styles.texpSwitch : `${styles.texpSwitch} ${styles.texpSwitchOff}`}
          role="switch"
          aria-checked={entry.ignoreBudget}
          aria-label="Always keep: skip the token budget"
          onClick={() => onPatch({ ignoreBudget: !entry.ignoreBudget })}
        />
      </div>
      {show("probability") && (
        <div className={styles.texpRow}>
          <span className={styles.texpK}>Chance %</span>
          <input
            className={styles.texpNum}
            type="number"
            min={0}
            max={100}
            value={entry.probability}
            aria-label="Activation chance percent"
            onChange={(ev) => onPatch({ probability: Number(ev.target.value) || 0 })}
          />
        </div>
      )}
      {show("scanDepth") && (
        <div className={styles.texpRow}>
          <span className={styles.texpK}>Scan depth</span>
          <input
            className={styles.texpNum}
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
          <div className={styles.texpLabel}>Matching</div>
          <div className={styles.texpActs}>
            <button
              type="button"
              className={styles.texpBtn}
              title="Override the book default for this entry"
              onClick={() => onPatch({ matchWholeWords: cycleTri(entry.matchWholeWords) })}
            >
              Whole words · {triLabel(entry.matchWholeWords)}
            </button>
            <button
              type="button"
              className={styles.texpBtn}
              title="Override the book default for this entry"
              onClick={() => onPatch({ caseSensitive: cycleTri(entry.caseSensitive) })}
            >
              Case · {triLabel(entry.caseSensitive)}
            </button>
          </div>
        </>
      )}
      <div className={styles.texpActs}>
        <button type="button" className={styles.texpBtn} aria-label="Move up" onClick={() => onMove(-1)}>
          &#8593;
        </button>
        <button type="button" className={styles.texpBtn} aria-label="Move down" onClick={() => onMove(1)}>
          &#8595;
        </button>
        <button type="button" className={styles.texpBtn} onClick={onDuplicate}>
          Copy
        </button>
        <button type="button" className={`${styles.texpBtn} ${styles.texpDanger}`} onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

export function LoreEntryToc({
  entries,
  focusedId,
  writeFor,
  styles,
  onSelect,
  onAdd,
  onPatch,
  onDuplicate,
  onDelete,
  onMove,
}: EntryTocProps): JSX.Element {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const match = (e: LorebookEntry): boolean =>
    q === "" ||
    e.title.toLowerCase().includes(q) ||
    e.triggers.some((t) => t.keyword.toLowerCase().includes(q));

  const alwaysOn = entries.filter((e) => e.constant && match(e));
  const keyed = entries.filter((e) => !e.constant && match(e));

  const row = (e: LorebookEntry): JSX.Element => {
    const focused = e.id === focusedId;
    const cls = [styles.trow, focused ? styles.trowOn : "", !e.enabled ? styles.trowOff : ""]
      .filter(Boolean)
      .join(" ");
    return (
      <div key={e.id}>
        <button type="button" className={cls} onClick={() => onSelect(e.id)}>
          <span className={styles.tpip} />
          <span className={styles.tnm}>{e.title || "(untitled)"}</span>
        </button>
        {focused && (
          <FinePrint
            entry={e}
            writeFor={writeFor}
            styles={styles}
            onPatch={(patch) => onPatch(e.id, patch)}
            onDuplicate={() => onDuplicate(e.id)}
            onDelete={() => onDelete(e.id)}
            onMove={(dir) => onMove(e.id, dir)}
          />
        )}
      </div>
    );
  };

  return (
    <aside className={styles.toc} aria-label="Table of contents">
      <p className={styles.tocTitle}>Table of contents</p>
      <label className={styles.tocSearch}>
        <span>&#8981;</span>
        <input
          value={query}
          placeholder={`Search ${entries.length} ${entries.length === 1 ? "entry" : "entries"}…`}
          aria-label="Search entries"
          onChange={(ev) => setQuery(ev.target.value)}
        />
      </label>

      {alwaysOn.length > 0 && (
        <>
          <div className={styles.tocGroup}>
            Always on <i className={styles.gcount}>{alwaysOn.length}</i>
          </div>
          {alwaysOn.map(row)}
        </>
      )}

      <div className={styles.tocGroup}>
        Entries <i className={styles.gcount}>{keyed.length}</i>
      </div>
      {keyed.map(row)}
      {entries.length === 0 && <p className={styles.tocEmpty}>The book is empty.</p>}
      {entries.length > 0 && alwaysOn.length + keyed.length === 0 && (
        <p className={styles.tocEmpty}>Nothing matches "{query.trim()}".</p>
      )}

      <button type="button" className={styles.tocAdd} onClick={onAdd}>
        + New entry
      </button>
    </aside>
  );
}
