/**
 * LoreEntryDrawer - long-tail controls below content. Own CSS module (no desk-style clobber).
 * Progressive sections (RC doctrine): portable extras first; host clusters nested and only
 * when the Write-for lens owns those fields. Never dumps every platform open at once.
 */
import { useEffect, useState, type JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { fieldVisible, type LoreFieldKey, type LoreWriteForProfile } from "../../../../core/lore";
import { ListEditor } from "../../../components/list-editor";
import type { FormField } from "../../../components/field-form";
import {
  filterFromInputs,
  filterMode,
  joinCsv,
  rowsFromSideEffects,
  sideEffectsFromRows,
  type FilterMode,
} from "./entry-extras";
import { EntryDrawerNaiSection } from "./entry-drawer-nai";
import { EntryDrawerStSection } from "./entry-drawer-st";
import styles from "./entry-drawer.module.css";

export interface EntryDrawerProps {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  /** kept for call-site stability; drawer owns its CSS */
  styles?: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
}

const SIDE_EFFECT_FIELDS: readonly FormField[] = [
  {
    key: "type",
    label: "does",
    kind: "select",
    half: true,
    options: [
      { value: "setvar", label: "set variable" },
      { value: "addvar", label: "add to variable" },
      { value: "incvar", label: "increment" },
      { value: "decvar", label: "decrement" },
      { value: "delvar", label: "delete variable" },
    ],
  },
  { key: "variable", label: "variable", kind: "text", half: true, placeholder: "mood" },
  { key: "value", label: "value (set only)", kind: "text", half: true },
  { key: "amount", label: "amount (add/inc/dec)", kind: "number", half: true },
  {
    key: "scope",
    label: "scope",
    kind: "select",
    half: true,
    options: [
      { value: "local", label: "local (this chat)" },
      { value: "global", label: "global" },
    ],
  },
];

export function LoreEntryDrawer({
  entry,
  writeFor,
  onPatch,
}: EntryDrawerProps): JSX.Element | null {
  const show = (key: string): boolean => fieldVisible(writeFor, key as LoreFieldKey);

  const hasPortable =
    show("comment") ||
    show("groupTuning") ||
    show("useMemo") ||
    show("matchOverrides") ||
    show("categoryId");
  const hasFilter = show("characterFilter");
  const hasSideEffects = show("sideEffects");
  const hasSt =
    show("scanSources") ||
    show("vectorized") ||
    show("displayIndex") ||
    show("automationId") ||
    show("delayUntilRecursion");
  const hasNai = show("naiActivation") || show("contextConfig");
  const anyDrawer = hasPortable || hasFilter || hasSideEffects || hasSt || hasNai;

  const mode = filterMode(entry.characterFilter);
  const patchFilter = (nextMode: FilterMode, names: string, tags: string): void =>
    onPatch({ characterFilter: filterFromInputs(nextMode, names, tags) });

  const [seRows, setSeRows] = useState<Record<string, unknown>[]>(() =>
    rowsFromSideEffects(entry.sideEffects),
  );
  useEffect(() => {
    setSeRows(rowsFromSideEffects(entry.sideEffects));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);
  const patchSe = (rows: Record<string, unknown>[], only?: boolean, clear?: boolean): void => {
    setSeRows(rows);
    onPatch({
      sideEffects: sideEffectsFromRows(
        rows,
        only ?? entry.sideEffects?.onlyOnFirstTrigger ?? false,
        clear ?? entry.sideEffects?.clearOnDeactivate ?? false,
      ),
    });
  };

  if (!anyDrawer) return null;

  return (
    <details className={styles.root}>
      <summary>More controls</summary>
      <div className={styles.body}>
        {hasPortable && (
          <div className={styles.stack}>
            {(show("groupTuning") || show("useMemo")) && (
              <div className={styles.row}>
                {show("groupTuning") && (
                  <>
                    <label className={styles.fld}>
                      <span>Group weight</span>
                      <input
                        className={styles.num}
                        type="number"
                        min={0}
                        value={entry.groupWeight}
                        aria-label="Inclusion-group weight"
                        onChange={(ev) => onPatch({ groupWeight: Number(ev.target.value) || 0 })}
                      />
                    </label>
                    <button
                      type="button"
                      className={
                        entry.groupOverride === true ? `${styles.btn} ${styles.btnOn}` : styles.btn
                      }
                      aria-pressed={entry.groupOverride === true}
                      onClick={() =>
                        onPatch({ groupOverride: entry.groupOverride === true ? undefined : true })
                      }
                    >
                      Group override
                    </button>
                    <button
                      type="button"
                      className={
                        entry.useGroupScoring === true ? `${styles.btn} ${styles.btnOn}` : styles.btn
                      }
                      aria-pressed={entry.useGroupScoring === true}
                      onClick={() =>
                        onPatch({
                          useGroupScoring: entry.useGroupScoring === true ? undefined : true,
                        })
                      }
                    >
                      Group scoring
                    </button>
                  </>
                )}
                {show("useMemo") && (
                  <button
                    type="button"
                    className={entry.useMemo ? `${styles.btn} ${styles.btnOn}` : styles.btn}
                    aria-pressed={entry.useMemo}
                    onClick={() => onPatch({ useMemo: !entry.useMemo })}
                  >
                    Memo
                  </button>
                )}
              </div>
            )}

            {show("matchOverrides") && (
              <div className={styles.row}>
                <label className={styles.fld}>
                  <span>Case</span>
                  <select
                    className={styles.sel}
                    value={
                      entry.caseSensitive === null ? "inherit" : entry.caseSensitive ? "yes" : "no"
                    }
                    aria-label="Case sensitive override"
                    onChange={(ev) => {
                      const v = ev.target.value;
                      onPatch({ caseSensitive: v === "inherit" ? null : v === "yes" });
                    }}
                  >
                    <option value="inherit">inherit book</option>
                    <option value="yes">sensitive</option>
                    <option value="no">ignore case</option>
                  </select>
                </label>
                <label className={styles.fld}>
                  <span>Whole words</span>
                  <select
                    className={styles.sel}
                    value={
                      entry.matchWholeWords === null
                        ? "inherit"
                        : entry.matchWholeWords
                          ? "yes"
                          : "no"
                    }
                    aria-label="Match whole words override"
                    onChange={(ev) => {
                      const v = ev.target.value;
                      onPatch({ matchWholeWords: v === "inherit" ? null : v === "yes" });
                    }}
                  >
                    <option value="inherit">inherit book</option>
                    <option value="yes">whole words</option>
                    <option value="no">substring</option>
                  </select>
                </label>
              </div>
            )}

            {show("categoryId") && (
              <label className={styles.field}>
                <span className={styles.lbl}>Category / folder id</span>
                <input
                  className={styles.input}
                  value={entry.categoryId ?? ""}
                  onChange={(ev) => onPatch({ categoryId: ev.target.value || null })}
                />
              </label>
            )}

            {show("comment") && (
              <label className={styles.field}>
                <span className={styles.lbl}>Creator note (never sent to the model)</span>
                <textarea
                  className={styles.textarea}
                  value={entry.comment ?? ""}
                  onChange={(ev) => onPatch({ comment: ev.target.value || null })}
                />
              </label>
            )}
          </div>
        )}

        {hasFilter && (
          <details className={styles.section}>
            <summary>Character filter</summary>
            <div className={styles.sectionBody}>
              <div className={styles.row}>
                <select
                  className={styles.sel}
                  value={mode}
                  aria-label="Character filter mode"
                  onChange={(ev) =>
                    patchFilter(
                      ev.target.value as FilterMode,
                      joinCsv(entry.characterFilter?.names ?? []),
                      joinCsv(entry.characterFilter?.tags ?? []),
                    )
                  }
                >
                  <option value="off">Every character</option>
                  <option value="include">Whitelist</option>
                  <option value="exclude">Blacklist</option>
                </select>
                {mode !== "off" && (
                  <>
                    <label className={styles.fld}>
                      <span>Names</span>
                      <input
                        className={styles.text}
                        value={joinCsv(entry.characterFilter?.names ?? [])}
                        placeholder="comma-separated"
                        aria-label="Character names"
                        onChange={(ev) =>
                          patchFilter(
                            mode,
                            ev.target.value,
                            joinCsv(entry.characterFilter?.tags ?? []),
                          )
                        }
                      />
                    </label>
                    <label className={styles.fld}>
                      <span>Tags</span>
                      <input
                        className={styles.text}
                        value={joinCsv(entry.characterFilter?.tags ?? [])}
                        placeholder="comma-separated"
                        aria-label="Character tags"
                        onChange={(ev) =>
                          patchFilter(
                            mode,
                            joinCsv(entry.characterFilter?.names ?? []),
                            ev.target.value,
                          )
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </details>
        )}

        {hasSideEffects && (
          <details className={styles.section}>
            <summary>Side effects</summary>
            <div className={styles.sectionBody}>
              <p className={styles.lbl}>Declared data only · Studio never executes these</p>
              <div className={styles.row}>
                <label className={styles.chip}>
                  <input
                    type="checkbox"
                    checked={entry.sideEffects?.onlyOnFirstTrigger === true}
                    onChange={(ev) => patchSe(seRows, ev.target.checked, undefined)}
                  />
                  Only on first trigger
                </label>
                <label className={styles.chip}>
                  <input
                    type="checkbox"
                    checked={entry.sideEffects?.clearOnDeactivate === true}
                    onChange={(ev) => patchSe(seRows, undefined, ev.target.checked)}
                  />
                  Clear on deactivate
                </label>
              </div>
              <ListEditor
                items={seRows}
                fields={SIDE_EFFECT_FIELDS}
                onChange={(rows) => patchSe(rows)}
                addLabel="+ Add effect"
                itemTitle={(it, i) =>
                  typeof it.variable === "string" && it.variable
                    ? `${it.type} · ${it.variable}`
                    : `Effect ${i + 1}`
                }
                makeItem={() => ({ type: "setvar", variable: "", value: "", scope: "local" })}
              />
            </div>
          </details>
        )}

        {hasSt && <EntryDrawerStSection entry={entry} show={show} onPatch={onPatch} />}
        {hasNai && <EntryDrawerNaiSection entry={entry} show={show} onPatch={onPatch} />}
      </div>
    </details>
  );
}
