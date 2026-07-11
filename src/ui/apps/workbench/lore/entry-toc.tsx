/**
 * LoreEntryToc - binder TOC with mode pips, token counts, select mode + bulk bar
 * (vs-lore-page-2 power moves). Fine-print expand on the focused row stays.
 */
import { useState, type JSX } from "react";
import {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  Columns2,
  Copy,
  KeyRound,
  Pin,
  Sparkles,
  Trash2,
  WholeWord,
} from "lucide-react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { estimateEntryTokens, fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { entryFireMode, fireModePatch, type EntryFireMode } from "./entry-fire-mode";
import { LoreBulkBar } from "./bulk-bar";

const ICO = { size: 13, strokeWidth: 2.25, "aria-hidden": true as const };

const MODE_META: readonly {
  mode: EntryFireMode;
  label: string;
  Icon: typeof KeyRound;
}[] = [
  { mode: "keyed", label: "Keywords", Icon: KeyRound },
  { mode: "always", label: "Always on", Icon: Pin },
  { mode: "meaning", label: "By meaning", Icon: Sparkles },
];

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
  selectMode?: boolean;
  onSelectMode?: (on: boolean) => void;
  picked?: ReadonlySet<string>;
  onTogglePick?: (id: string) => void;
  onBulkEnable?: (on: boolean) => void;
  onBulkDelete?: () => void;
  onClearPick?: () => void;
  onBulkMove?: () => void;
  onOpenBeside?: (id: string) => void;
  /** entryId -> problem | worth-a-look from inspectBook (hidden in select mode). */
  healthByEntry?: ReadonlyMap<string, "problem" | "worth-a-look">;
}

const cycleTri = (v: boolean | null): boolean | null => (v === null ? true : v ? false : null);
const triTitle = (label: string, v: boolean | null): string =>
  `${label}: ${v === null ? "inherit book default" : v ? "on for this entry" : "off for this entry"} (click to cycle)`;

function triIconClass(
  v: boolean | null,
  styles: Readonly<Record<string, string>>,
): string {
  const base = styles.iconBtn ?? "iconBtn";
  if (v === true) return `${base} ${styles.iconOn ?? ""}`.trim();
  if (v === false) return `${base} ${styles.iconOff ?? ""}`.trim();
  return `${base} ${styles.iconInh ?? ""}`.trim();
}

function pipClass(entry: LorebookEntry, styles: Readonly<Record<string, string>>): string {
  if (!entry.enabled) return `${styles.tpip} ${styles.pipOff}`;
  const mode = entryFireMode(entry);
  if (mode === "always") return `${styles.tpip} ${styles.pipAlways}`;
  if (mode === "meaning") return `${styles.tpip} ${styles.pipMeaning}`;
  return `${styles.tpip} ${styles.pipKey}`;
}

function FinePrint({
  entry,
  writeFor,
  styles,
  onPatch,
  onDuplicate,
  onDelete,
  onMove,
  onOpenBeside,
}: {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onOpenBeside?: () => void;
}): JSX.Element {
  const show = (key: Parameters<typeof fieldVisible>[1]): boolean => fieldVisible(writeFor, key);
  const act = styles.iconBtn ?? "iconBtn";
  const mode = entryFireMode(entry);
  const vectorOk = show("vectorized");
  return (
    <div className={styles.texp}>
      {show("constant") && (
        <div className={styles.modeRow} role="group" aria-label="Activation mode">
          {MODE_META.map(({ mode: m, label, Icon }) => {
            const gated = m === "meaning" && !vectorOk;
            const on = mode === m;
            const tone =
              m === "keyed"
                ? styles.modeKey
                : m === "always"
                  ? styles.modeAlways
                  : styles.modeMeaning;
            return (
              <button
                key={m}
                type="button"
                className={[
                  styles.modeBtn,
                  tone,
                  on ? styles.modeBtnOn : "",
                  gated ? styles.modeBtnGated : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={on}
                aria-label={label}
                title={
                  gated
                    ? "This host cannot carry by-meaning (vectorized) entries."
                    : label
                }
                disabled={gated}
                onClick={() => {
                  if (!gated) onPatch(fireModePatch(m));
                }}
              >
                <Icon {...ICO} />
              </button>
            );
          })}
        </div>
      )}
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
      {/* Chance / sticky / cool / delay live only in the page Timing & chance fold */}
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
        <div className={styles.iconRow} role="group" aria-label="Matching overrides">
          <button
            type="button"
            className={triIconClass(entry.matchWholeWords, styles)}
            title={triTitle("Whole words", entry.matchWholeWords)}
            aria-label={triTitle("Whole words", entry.matchWholeWords)}
            onClick={() => onPatch({ matchWholeWords: cycleTri(entry.matchWholeWords) })}
          >
            <WholeWord {...ICO} />
          </button>
          <button
            type="button"
            className={triIconClass(entry.caseSensitive, styles)}
            title={triTitle("Case sensitive", entry.caseSensitive)}
            aria-label={triTitle("Case sensitive", entry.caseSensitive)}
            onClick={() => onPatch({ caseSensitive: cycleTri(entry.caseSensitive) })}
          >
            <CaseSensitive {...ICO} />
          </button>
        </div>
      )}
      <div className={styles.iconRow} role="group" aria-label="Entry actions">
        <button
          type="button"
          className={act}
          aria-label="Move up"
          title="Move up"
          onClick={() => onMove(-1)}
        >
          <ArrowUp {...ICO} />
        </button>
        <button
          type="button"
          className={act}
          aria-label="Move down"
          title="Move down"
          onClick={() => onMove(1)}
        >
          <ArrowDown {...ICO} />
        </button>
        <button
          type="button"
          className={act}
          aria-label="Copy entry"
          title="Copy entry"
          onClick={onDuplicate}
        >
          <Copy {...ICO} />
        </button>
        {onOpenBeside && (
          <button
            type="button"
            className={act}
            aria-label="Open beside"
            title="Open beside"
            onClick={onOpenBeside}
          >
            <Columns2 {...ICO} />
          </button>
        )}
        <button
          type="button"
          className={`${act} ${styles.iconDanger ?? ""}`.trim()}
          aria-label="Delete entry"
          title="Delete entry"
          onClick={onDelete}
        >
          <Trash2 {...ICO} />
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
  const q = query.trim().toLowerCase();
  const match = (e: LorebookEntry): boolean =>
    q === "" ||
    e.title.toLowerCase().includes(q) ||
    e.triggers.some((t) => t.keyword.toLowerCase().includes(q));

  const alwaysOn = entries.filter((e) => e.constant && match(e));
  const keyed = entries.filter((e) => !e.constant && match(e));
  const pickCount = picked?.size ?? 0;

  const row = (e: LorebookEntry): JSX.Element => {
    const focused = e.id === focusedId;
    const cls = [styles.trow, focused ? styles.trowOn : "", !e.enabled ? styles.trowOff : ""]
      .filter(Boolean)
      .join(" ");
    const tokens = estimateEntryTokens(e);
    const isPicked = picked?.has(e.id) ?? false;

    return (
      <div key={e.id}>
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
          {selectMode ? (
            <span
              className={isPicked ? `${styles.cb} ${styles.cbOn}` : styles.cb}
              aria-hidden="true"
            />
          ) : (
            <span className={pipClass(e, styles)} aria-hidden="true" />
          )}
          <span className={styles.tnm}>{e.title || "(untitled)"}</span>
          {!selectMode && healthByEntry?.get(e.id) === "problem" && (
            <span className={styles.healthBad} title="Health problem" aria-label="Health problem">
              !
            </span>
          )}
          {!selectMode && healthByEntry?.get(e.id) === "worth-a-look" && (
            <span className={styles.healthWarn} title="Worth a look" aria-label="Worth a look">
              ·
            </span>
          )}
          {!selectMode && <span className={styles.tokc}>~{tokens}</span>}
          {!selectMode && (
            <button
              type="button"
              className={e.enabled ? styles.tEn : `${styles.tEn} ${styles.tEnOff}`}
              aria-pressed={e.enabled}
              aria-label={e.enabled ? "Entry on" : "Entry off"}
              title={e.enabled ? "On - click to disable" : "Off - click to enable"}
              onClick={(ev) => {
                ev.stopPropagation();
                onPatch(e.id, { enabled: !e.enabled });
              }}
            >
              {e.enabled ? "On" : "Off"}
            </button>
          )}
          {!selectMode && (
            <span className={styles.hoverActs} onClick={(ev) => ev.stopPropagation()}>
              <button type="button" aria-label="Move up" onClick={() => onMove(e.id, -1)}>
                &#8593;
              </button>
              <button type="button" aria-label="Move down" onClick={() => onMove(e.id, 1)}>
                &#8595;
              </button>
              <button type="button" aria-label="Duplicate" onClick={() => onDuplicate(e.id)}>
                +
              </button>
            </span>
          )}
        </div>
        {focused && !selectMode && (
          <FinePrint
            entry={e}
            writeFor={writeFor}
            styles={styles}
            onPatch={(patch) => onPatch(e.id, patch)}
            onDuplicate={() => onDuplicate(e.id)}
            onDelete={() => onDelete(e.id)}
            onMove={(dir) => onMove(e.id, dir)}
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
