/**
 * LoreEntryToc - the binder's quiet table of contents (vs-lorebook-binder-2): a search box,
 * grouped rows with counts, active row wears the accent bar, disabled entries strike through.
 * Groups today: "Always on" (constant entries) and "Entries" - category folders arrive with the
 * categories milestone and slot in as more groups.
 */
import { useState, type JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";

export interface EntryTocProps {
  entries: readonly LorebookEntry[];
  focusedId: string | null;
  styles: Readonly<Record<string, string>>;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

function Row({
  entry,
  focused,
  styles,
  onSelect,
}: {
  entry: LorebookEntry;
  focused: boolean;
  styles: Readonly<Record<string, string>>;
  onSelect: () => void;
}): JSX.Element {
  const cls = [styles.trow, focused ? styles.trowOn : "", !entry.enabled ? styles.trowOff : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} onClick={onSelect}>
      <span className={styles.tpip} />
      <span className={styles.tnm}>{entry.title || "(untitled)"}</span>
    </button>
  );
}

export function LoreEntryToc({ entries, focusedId, styles, onSelect, onAdd }: EntryTocProps): JSX.Element {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const match = (e: LorebookEntry): boolean =>
    q === "" ||
    e.title.toLowerCase().includes(q) ||
    e.triggers.some((t) => t.keyword.toLowerCase().includes(q));

  const alwaysOn = entries.filter((e) => e.constant && match(e));
  const keyed = entries.filter((e) => !e.constant && match(e));

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
          {alwaysOn.map((e) => (
            <Row key={e.id} entry={e} focused={e.id === focusedId} styles={styles} onSelect={() => onSelect(e.id)} />
          ))}
        </>
      )}

      <div className={styles.tocGroup}>
        Entries <i className={styles.gcount}>{keyed.length}</i>
      </div>
      {keyed.map((e) => (
        <Row key={e.id} entry={e} focused={e.id === focusedId} styles={styles} onSelect={() => onSelect(e.id)} />
      ))}
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
