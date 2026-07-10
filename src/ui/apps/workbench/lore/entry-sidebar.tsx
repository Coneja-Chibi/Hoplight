/**
 * LoreEntrySidebar - the desk's left column (vs-lorebook-desk-f): the entry list grouped into
 * category FOLDERS (RC pattern: create/rename/collapse/delete, delete moves entries to
 * Uncategorized), the focused entry's quick controls expanded in place, and the stagehand stack at
 * the foot (budget, focused entry health, try-a-line).
 */
import { useState, type JSX } from "react";
import type { LorebookCategory, LorebookEntry } from "../../../../entities/lorebook/schema";
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
  onAddCategory: (name: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  onSetCategory: (entryId: string, categoryId: string | null) => void;
}

/** inherit -> on -> off -> inherit (the entry's tri-state matching override) */
const cycleTri = (v: boolean | null): boolean | null => (v === null ? true : v ? false : null);
const triLabel = (v: boolean | null): string => (v === null ? "inherit" : v ? "on" : "off");

function QuickControls({
  entry,
  styles,
  categories,
  onDuplicate,
  onDelete,
  onMove,
  onPatchEntry,
  onSetCategory,
}: {
  entry: LorebookEntry;
  styles: Readonly<Record<string, string>>;
  categories: readonly LorebookCategory[];
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onPatchEntry: (patch: Partial<LorebookEntry>) => void;
  onSetCategory: (categoryId: string | null) => void;
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
        {categories.length > 0 && (
          <select
            className={styles.folderSel}
            value={entry.categoryId ?? ""}
            aria-label="Folder"
            onChange={(ev) => onSetCategory(ev.target.value || null)}
          >
            <option value="">No folder</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
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

export function LoreEntrySidebar(props: EntrySidebarProps): JSX.Element {
  const { session, styles, health, bookEstimate, onSelect, onAdd } = props;
  const { body, openIds, focusedId } = session;
  const budget = body.tokenBudget;
  const focused = focusedId !== null ? body.entries.find((e) => e.id === focusedId) ?? null : null;
  const focusedNotes = focused ? health.filter((h) => h.entryId === focused.id) : [];
  const categories = [...(body.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const toggleFolder = (id: string): void =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commitNewFolder = (): void => {
    props.onAddCategory(newFolderName);
    setNewFolderName("");
    setNewFolderOpen(false);
  };

  const entryRow = (e: LorebookEntry): JSX.Element => {
    const isOpen = openIds.includes(e.id);
    const isFocused = e.id === focusedId;
    const rowClass = [styles.srow, isOpen ? styles.srowOpen : "", isFocused ? styles.srowFocused : ""]
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
              onClick={() => props.onOpenBeside(e.id)}
            >
              &#10064;
            </button>
          )}
        </div>
        {isFocused && (
          <QuickControls
            entry={e}
            styles={styles}
            categories={categories}
            onDuplicate={() => props.onDuplicate(e.id)}
            onDelete={() => props.onDelete(e.id)}
            onMove={(dir) => props.onMove(e.id, dir)}
            onPatchEntry={(patch) => props.onPatchEntry(e.id, patch)}
            onSetCategory={(categoryId) => props.onSetCategory(e.id, categoryId)}
          />
        )}
      </div>
    );
  };

  const folderHead = (c: LorebookCategory, count: number): JSX.Element => (
    <div className={styles.folder} key={`head-${c.id}`}>
      {renaming?.id === c.id ? (
        <input
          className={styles.folderIn}
          value={renaming.name}
          aria-label="Folder name"
          autoFocus
          onChange={(ev) => setRenaming({ id: c.id, name: ev.target.value })}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              props.onRenameCategory(c.id, renaming.name);
              setRenaming(null);
            }
            if (ev.key === "Escape") setRenaming(null);
          }}
          onBlur={() => {
            props.onRenameCategory(c.id, renaming.name);
            setRenaming(null);
          }}
        />
      ) : (
        <>
          <button
            type="button"
            className={styles.folderBtn}
            aria-expanded={!closed.has(c.id)}
            onClick={() => toggleFolder(c.id)}
          >
            <span className={styles.folderChev}>{closed.has(c.id) ? "›" : "⌄"}</span>
            <span className={styles.folderName}>{c.name}</span>
            <span className={styles.folderCount}>{count}</span>
          </button>
          <button
            type="button"
            className={styles.folderOp}
            title="Rename folder"
            aria-label={`Rename ${c.name}`}
            onClick={() => setRenaming({ id: c.id, name: c.name })}
          >
            &#9998;
          </button>
          <button
            type="button"
            className={styles.folderOp}
            title="Delete folder (entries move to No folder)"
            aria-label={`Delete ${c.name}`}
            onClick={() => props.onDeleteCategory(c.id)}
          >
            &times;
          </button>
        </>
      )}
    </div>
  );

  const knownCat = new Set(categories.map((c) => c.id));
  const loose = body.entries.filter((e) => e.categoryId === null || !knownCat.has(e.categoryId ?? ""));

  return (
    <aside className={styles.side} aria-label="Entries">
      <div className={styles.sbar}>
        <span className={styles.sbarLabel}>Entries</span>
        <button
          type="button"
          className={styles.sFolderAdd}
          onClick={() => setNewFolderOpen((v) => !v)}
          title="New folder"
          aria-expanded={newFolderOpen}
        >
          + folder
        </button>
        <button type="button" className={styles.sAdd} onClick={onAdd} title="New entry">
          +
        </button>
      </div>
      {newFolderOpen && (
        <div className={styles.folderNew}>
          <input
            className={styles.folderIn}
            value={newFolderName}
            placeholder="folder name…"
            aria-label="New folder name"
            autoFocus
            onChange={(ev) => setNewFolderName(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") commitNewFolder();
              if (ev.key === "Escape") setNewFolderOpen(false);
            }}
          />
          <button type="button" className={styles.ract} onClick={commitNewFolder}>
            Create
          </button>
        </div>
      )}

      <div className={styles.slist}>
        {body.entries.length === 0 && <div className={styles.empty}>The book is empty. Add an entry.</div>}
        {categories.map((c) => {
          const inFolder = body.entries.filter((e) => e.categoryId === c.id);
          return (
            <div key={c.id}>
              {folderHead(c, inFolder.length)}
              {!closed.has(c.id) && inFolder.map(entryRow)}
            </div>
          );
        })}
        {categories.length > 0 && loose.length > 0 && (
          <div className={styles.folder}>
            <span className={`${styles.folderName} ${styles.folderLoose}`}>No folder</span>
            <span className={styles.folderCount}>{loose.length}</span>
          </div>
        )}
        {loose.map(entryRow)}
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
