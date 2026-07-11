/**
 * LoreEntryToc - health pip, fire-mode select, slide enable, chrom expand, drag reorder.
 * Match overrides live on the page Keys card, not here.
 */
import { useState, type JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { estimateEntryTokens, fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { entryFireMode, fireModePatch } from "./entry-fire-mode";
import { LoreBulkBar } from "./bulk-bar";
import { ModeSelect } from "./entry-toc-mode";

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
  /** Drag-drop reorder: move id to toIndex in body.entries. */
  onReorder: (id: string, toIndex: number) => void;
  selectMode?: boolean;
  onSelectMode?: (on: boolean) => void;
  picked?: ReadonlySet<string>;
  onTogglePick?: (id: string) => void;
  onBulkEnable?: (on: boolean) => void;
  onBulkDelete?: () => void;
  onClearPick?: () => void;
  onBulkMove?: () => void;
  onOpenBeside?: (id: string) => void;
  healthByEntry?: ReadonlyMap<string, "problem" | "worth-a-look">;
}

function healthPipClass(
  health: "problem" | "worth-a-look" | undefined,
  enabled: boolean,
  styles: Readonly<Record<string, string>>,
): string {
  if (!enabled) return `${styles.tpip} ${styles.pipOff}`;
  if (health === "problem") return `${styles.tpip} ${styles.pipProblem}`;
  if (health === "worth-a-look") return `${styles.tpip} ${styles.pipWarn}`;
  return `${styles.tpip} ${styles.pipOk}`;
}

function healthTitle(health: "problem" | "worth-a-look" | undefined, enabled: boolean): string {
  if (!enabled) return "Disabled";
  if (health === "problem") return "Health problem";
  if (health === "worth-a-look") return "Worth a look";
  return "Healthy";
}

function FinePrint({
  entry,
  writeFor,
  styles,
  onPatch,
  onDuplicate,
  onDelete,
  onOpenBeside,
}: {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenBeside?: () => void;
}): JSX.Element {
  const show = (key: Parameters<typeof fieldVisible>[1]): boolean => fieldVisible(writeFor, key);
  return (
    <div className={styles.texp}>
      <div className={styles.texpPanel}>
        <div className={styles.chromGrid}>
          {show("sortOrder") && (
            <label className={styles.chromTile}>
              <span className={styles.chromLab}>Order</span>
              <input
                className={styles.chromIn}
                type="number"
                value={entry.sortOrder}
                aria-label="Insertion order"
                onChange={(ev) => onPatch({ sortOrder: Number(ev.target.value) || 0 })}
              />
            </label>
          )}
          {show("priority") && (
            <label className={styles.chromTile}>
              <span className={styles.chromLab}>Priority</span>
              <input
                className={styles.chromIn}
                type="number"
                value={entry.priority}
                aria-label="Budget priority"
                onChange={(ev) => onPatch({ priority: Number(ev.target.value) || 0 })}
              />
            </label>
          )}
          {show("scanDepth") && (
            <label className={styles.chromTile}>
              <span className={styles.chromLab}>Scan</span>
              <input
                className={styles.chromIn}
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
            </label>
          )}
          <div className={styles.chromTile}>
            <span className={styles.chromLab}>Keep</span>
            <button
              type="button"
              className={
                entry.ignoreBudget
                  ? styles.texpSwitch
                  : `${styles.texpSwitch} ${styles.texpSwitchOff}`
              }
              role="switch"
              aria-checked={entry.ignoreBudget}
              aria-label="Always keep: skip the token budget"
              onClick={() => onPatch({ ignoreBudget: !entry.ignoreBudget })}
            />
          </div>
        </div>
        <div className={styles.texpFoot} role="group" aria-label="Entry actions">
          <button type="button" className={styles.texpAct} onClick={onDuplicate}>
            Copy
          </button>
          {onOpenBeside && (
            <button type="button" className={styles.texpAct} onClick={onOpenBeside}>
              Beside
            </button>
          )}
          <button type="button" className={styles.texpActDanger} onClick={onDelete}>
            Delete
          </button>
        </div>
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
  onReorder,
  selectMode = false,
  onSelectMode,
  picked,
  onTogglePick,
  onBulkEnable,
  onBulkDelete,
  onClearPick,
  onBulkMove,
  onOpenBeside,
  healthByEntry,
}: EntryTocProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const match = (e: LorebookEntry): boolean =>
    q === "" ||
    e.title.toLowerCase().includes(q) ||
    e.triggers.some((t) => t.keyword.toLowerCase().includes(q));

  const alwaysOn = entries.filter((e) => e.constant && match(e));
  const keyed = entries.filter((e) => !e.constant && match(e));
  const pickCount = picked?.size ?? 0;
  const vectorOk = fieldVisible(writeFor, "vectorized");
  const canDrag = !selectMode && q === "";

  const dropOn = (targetId: string): void => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const toIndex = entries.findIndex((e) => e.id === targetId);
    if (toIndex >= 0) onReorder(dragId, toIndex);
    setDragId(null);
    setOverId(null);
  };

  const row = (e: LorebookEntry): JSX.Element => {
    const focused = e.id === focusedId;
    const cls = [
      styles.trow,
      focused ? styles.trowOn : "",
      !e.enabled ? styles.trowOff : "",
      overId === e.id && dragId && dragId !== e.id ? styles.trowDrop : "",
    ]
      .filter(Boolean)
      .join(" ");
    const tokens = estimateEntryTokens(e);
    const isPicked = picked?.has(e.id) ?? false;
    const health = healthByEntry?.get(e.id);
    const mode = entryFireMode(e);
    const canMode = fieldVisible(writeFor, "constant");

    return (
      <div
        key={e.id}
        draggable={canDrag}
        onDragStart={(ev) => {
          if (!canDrag) {
            ev.preventDefault();
            return;
          }
          setDragId(e.id);
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", e.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        onDragOver={(ev) => {
          if (!dragId || dragId === e.id) return;
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
          setOverId(e.id);
        }}
        onDragLeave={() => {
          if (overId === e.id) setOverId(null);
        }}
        onDrop={(ev) => {
          ev.preventDefault();
          dropOn(e.id);
        }}
      >
        <div
          role="button"
          tabIndex={0}
          className={cls}
          onClick={() => {
            if (selectMode && onTogglePick) onTogglePick(e.id);
            else onSelect(e.id);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              if (selectMode && onTogglePick) onTogglePick(e.id);
              else onSelect(e.id);
            }
          }}
        >
          {!selectMode && (
            <button
              type="button"
              className={
                e.enabled ? styles.tSlide : `${styles.tSlide} ${styles.tSlideOff}`
              }
              role="switch"
              aria-checked={e.enabled}
              aria-label={e.enabled ? "Entry on" : "Entry off"}
              title={e.enabled ? "On - click to disable" : "Off - click to enable"}
              onClick={(ev) => {
                ev.stopPropagation();
                onPatch(e.id, { enabled: !e.enabled });
              }}
            />
          )}
          {selectMode ? (
            <span
              className={isPicked ? `${styles.cb} ${styles.cbOn}` : styles.cb}
              aria-hidden="true"
            />
          ) : (
            <span
              className={healthPipClass(health, e.enabled, styles)}
              title={healthTitle(health, e.enabled)}
              aria-label={healthTitle(health, e.enabled)}
            />
          )}
          <div className={styles.tMain}>
            <div className={styles.tTitleRow}>
              <span className={styles.tnm}>{e.title || "(untitled)"}</span>
              {!selectMode && <span className={styles.tokc}>~{tokens}</span>}
            </div>
            {!selectMode && canMode && (
              <ModeSelect
                mode={mode}
                vectorOk={vectorOk}
                styles={styles}
                onChange={(m) => onPatch(e.id, fireModePatch(m))}
              />
            )}
          </div>
        </div>
        {focused && !selectMode && (
          <FinePrint
            entry={e}
            writeFor={writeFor}
            styles={styles}
            onPatch={(patch) => onPatch(e.id, patch)}
            onDuplicate={() => onDuplicate(e.id)}
            onDelete={() => onDelete(e.id)}
            onOpenBeside={onOpenBeside ? () => onOpenBeside(e.id) : undefined}
          />
        )}
      </div>
    );
  };

  return (
    <aside className={styles.toc} aria-label="Table of contents">
      <p className={styles.tocTitle}>
        Table of contents
        {onSelectMode && (
          <button
            type="button"
            className={selectMode ? `${styles.selMode} ${styles.selModeOn}` : styles.selMode}
            aria-pressed={selectMode}
            onClick={() => onSelectMode(!selectMode)}
          >
            Select
          </button>
        )}
      </p>
      <label className={styles.tocSearch}>
        <span>&#8981;</span>
        <input
          value={query}
          placeholder={`Search ${entries.length} ${entries.length === 1 ? "entry" : "entries"}…`}
          aria-label="Search entries"
          onChange={(ev) => setQuery(ev.target.value)}
        />
      </label>
      {canDrag && (
        <p className={styles.dragHint}>Drag rows to reorder</p>
      )}

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
        <p className={styles.tocEmpty}>Nothing matches &quot;{query.trim()}&quot;.</p>
      )}

      <button type="button" className={styles.tocAdd} onClick={onAdd}>
        + New entry
      </button>

      {selectMode && pickCount > 0 && onBulkEnable && onBulkDelete && onClearPick && (
        <LoreBulkBar
          count={pickCount}
          styles={styles}
          onEnable={onBulkEnable}
          onDelete={onBulkDelete}
          onClear={onClearPick}
          onMove={onBulkMove}
        />
      )}
    </aside>
  );
}
