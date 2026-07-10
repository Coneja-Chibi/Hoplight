/**
 * LoreEntryDrawer - the panel's fine-control drawer, now covering the WHOLE RC wire (the codec in
 * formats/rolecall/lorebook.ts is the checklist): creator note, group tuning, memo/recursion depth,
 * character filter, every scan source, RAG/automation/category, the NAI cluster, and the declared
 * side effects (data only - Studio never executes them). Profile-gated; hidden fields stay in data.
 */
import { useEffect, useState, type JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { ListEditor } from "../../../components/list-editor";
import type { FormField } from "../../../components/field-form";
import {
  filterFromInputs,
  filterMode,
  joinCsv,
  patchContextConfig,
  rowsFromSideEffects,
  sideEffectsFromRows,
  type FilterMode,
} from "./entry-extras";
import { CsvInput } from "./csv-input";

export interface EntryDrawerProps {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
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

/** select options that keep an unknown carried value visible instead of silently rewriting it */
const openOptions = (known: readonly string[], current: string | undefined): string[] =>
  current && !known.includes(current) ? [...known, current] : [...known];

export function LoreEntryDrawer({ entry, writeFor, styles, onPatch }: EntryDrawerProps): JSX.Element {
  const show = (key: Parameters<typeof fieldVisible>[1]): boolean => fieldVisible(writeFor, key);
  const cc = entry.contextConfig;
  const patchCc = (patch: Parameters<typeof patchContextConfig>[1]): void =>
    onPatch({ contextConfig: patchContextConfig(cc, patch) });
  const mode = filterMode(entry.characterFilter);
  const patchFilter = (nextMode: FilterMode, names: string, tags: string): void =>
    onPatch({ characterFilter: filterFromInputs(nextMode, names, tags) });
  // side-effect rows are a LOCAL draft: a just-added row has an empty variable and would be
  // filtered out of the canonical body before it could be typed into. Valid rows flow out on every
  // edit; the draft re-seeds when the panel shows a different entry.
  const [seRows, setSeRows] = useState<Record<string, unknown>[]>(() => rowsFromSideEffects(entry.sideEffects));
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

  return (
    <details className={styles.details}>
      <summary className={styles.label}>Fine control (profile-gated · hidden fields stay in data)</summary>

      {show("comment") && (
        <label className={styles.field}>
          <span className={styles.label}>Creator note (never sent to the model)</span>
          <textarea
            className={styles.textarea}
            style={{ minHeight: "3rem" }}
            value={entry.comment ?? ""}
            onChange={(ev) => onPatch({ comment: ev.target.value || null })}
          />
        </label>
      )}

      {(show("groupTuning") || show("useMemo") || show("delayUntilRecursion")) && (
        <div className={styles.timeRow}>
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
                className={entry.groupOverride === true ? `${styles.fldBtn} ${styles.fldOn}` : styles.fldBtn}
                aria-pressed={entry.groupOverride === true}
                title="This entry always wins its inclusion group"
                onClick={() => onPatch({ groupOverride: entry.groupOverride === true ? undefined : true })}
              >
                Group override
              </button>
              <button
                type="button"
                className={entry.useGroupScoring === true ? `${styles.fldBtn} ${styles.fldOn}` : styles.fldBtn}
                aria-pressed={entry.useGroupScoring === true}
                title="Pick the group winner by match score instead of weight"
                onClick={() => onPatch({ useGroupScoring: entry.useGroupScoring === true ? undefined : true })}
              >
                Group scoring
              </button>
            </>
          )}
          {show("useMemo") && (
            <button
              type="button"
              className={entry.useMemo ? `${styles.fldBtn} ${styles.fldOn}` : styles.fldBtn}
              aria-pressed={entry.useMemo}
              title="Remember this entry once triggered"
              onClick={() => onPatch({ useMemo: !entry.useMemo })}
            >
              Memo
            </button>
          )}
          {show("delayUntilRecursion") && (
            <label className={styles.fld}>
              <span>Recursion level</span>
              <input
                className={styles.num}
                type="number"
                min={0}
                value={entry.delayUntilRecursion}
                aria-label="Only activate at recursion level N (0 = first pass)"
                onChange={(ev) => onPatch({ delayUntilRecursion: Number(ev.target.value) || 0 })}
              />
            </label>
          )}
        </div>
      )}

      {show("characterFilter") && (
        <>
          <span className={styles.label}>Character filter</span>
          <div className={styles.timeRow}>
            <select
              className={styles.miniSel}
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
              <option value="include">Only for…</option>
              <option value="exclude">Never for…</option>
            </select>
            {mode !== "off" && (
              <>
                <label className={styles.fld}>
                  <span>Names</span>
                  <CsvInput
                    value={entry.characterFilter?.names ?? []}
                    onCommit={(names) => patchFilter(mode, joinCsv(names), joinCsv(entry.characterFilter?.tags ?? []))}
                    className={styles.groupIn}
                    placeholder="comma-separated"
                    ariaLabel="Character names (comma-separated)"
                  />
                </label>
                <label className={styles.fld}>
                  <span>Tags</span>
                  <CsvInput
                    value={entry.characterFilter?.tags ?? []}
                    onCommit={(tags) => patchFilter(mode, joinCsv(entry.characterFilter?.names ?? []), joinCsv(tags))}
                    className={styles.groupIn}
                    placeholder="comma-separated"
                    ariaLabel="Character tags (comma-separated)"
                  />
                </label>
              </>
            )}
          </div>
        </>
      )}

      {show("scanSources") && (
        <div className={styles.tools}>
          {(
            [
              ["scanCharacterDescription", "Scan description"],
              ["scanCharacterPersonality", "Scan personality"],
              ["scanUserPersona", "Scan persona"],
              ["scanScenario", "Scan scenario"],
              ["scanCharacterDepthPrompt", "Scan depth prompt"],
              ["scanCreatorNotes", "Scan creator notes"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={styles.chip}>
              <input
                type="checkbox"
                checked={entry[key] === true}
                onChange={(ev) => onPatch({ [key]: ev.target.checked })}
              />{" "}
              {label}
            </label>
          ))}
        </div>
      )}

      {show("vectorized") && (
        <label className={styles.chip}>
          <input
            type="checkbox"
            checked={entry.vectorized === true}
            onChange={(ev) => onPatch({ vectorized: ev.target.checked })}
          />{" "}
          Vectorized (RAG)
        </label>
      )}
      {/* folder (categoryId) assignment lives in the SIDEBAR's quick controls, beside the folders */}
      {show("automationId") && (
        <label className={styles.field}>
          <span className={styles.label}>Automation id</span>
          <input
            className={styles.input}
            value={entry.automationId ?? ""}
            onChange={(ev) => onPatch({ automationId: ev.target.value || null })}
          />
        </label>
      )}

      {show("naiActivation") && (
        <div className={styles.tools}>
          <label className={styles.chip}>
            <input
              type="checkbox"
              checked={entry.keyRelative === true}
              onChange={(ev) => onPatch({ keyRelative: ev.target.checked })}
            />{" "}
            Keys match near the entry (NovelAI)
          </label>
          <label className={styles.chip}>
            <input
              type="checkbox"
              checked={entry.nonStoryActivatable === true}
              onChange={(ev) => onPatch({ nonStoryActivatable: ev.target.checked })}
            />{" "}
            Can activate outside story text (NovelAI)
          </label>
        </div>
      )}

      {show("contextConfig") && (
        <>
          <span className={styles.label}>Context assembly (NovelAI)</span>
          <div className={styles.timeRow}>
            <label className={styles.fld}>
              <span>Prefix</span>
              <input
                className={styles.groupIn}
                value={cc?.prefix ?? ""}
                onChange={(ev) => patchCc({ prefix: ev.target.value || undefined })}
              />
            </label>
            <label className={styles.fld}>
              <span>Suffix</span>
              <input
                className={styles.groupIn}
                value={cc?.suffix ?? ""}
                onChange={(ev) => patchCc({ suffix: ev.target.value || undefined })}
              />
            </label>
            <label className={styles.fld}>
              <span>Token cap</span>
              <input
                className={styles.num}
                type="number"
                min={0}
                value={cc?.tokenBudget ?? ""}
                placeholder="none"
                onChange={(ev) => patchCc({ tokenBudget: ev.target.value === "" ? undefined : Number(ev.target.value) || 0 })}
              />
            </label>
            <label className={styles.fld}>
              <span>Reserved</span>
              <input
                className={styles.num}
                type="number"
                min={0}
                value={cc?.reservedTokens ?? ""}
                placeholder="0"
                onChange={(ev) => patchCc({ reservedTokens: ev.target.value === "" ? undefined : Number(ev.target.value) || 0 })}
              />
            </label>
            <label className={styles.fld}>
              <span>Offset</span>
              <input
                className={styles.num}
                type="number"
                value={cc?.insertionPosition ?? ""}
                placeholder="0"
                onChange={(ev) => patchCc({ insertionPosition: ev.target.value === "" ? undefined : Number(ev.target.value) || 0 })}
              />
            </label>
          </div>
          <div className={styles.timeRow}>
            {(
              [
                ["trimDirection", "Trim", ["doNotTrim", "trimBottom", "trimTop"]],
                ["insertionType", "Join by", ["newline", "space", "token"]],
                ["maximumTrimType", "Trim by", ["sentence", "newline", "token"]],
              ] as const
            ).map(([key, label, known]) => (
              <label key={key} className={styles.fld}>
                <span>{label}</span>
                <select
                  className={styles.miniSel}
                  value={cc?.[key] ?? ""}
                  aria-label={label}
                  onChange={(ev) => patchCc({ [key]: ev.target.value || undefined })}
                >
                  <option value="">default</option>
                  {openOptions(known, cc?.[key]).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </>
      )}

      {show("sideEffects") && (
        <>
          <span className={styles.label}>Side effects (declared data · never executed in Studio)</span>
          <div className={styles.tools}>
            <label className={styles.chip}>
              <input
                type="checkbox"
                checked={entry.sideEffects?.onlyOnFirstTrigger === true}
                onChange={(ev) => patchSe(seRows, ev.target.checked, undefined)}
              />{" "}
              Only on first trigger
            </label>
            <label className={styles.chip}>
              <input
                type="checkbox"
                checked={entry.sideEffects?.clearOnDeactivate === true}
                onChange={(ev) => patchSe(seRows, undefined, ev.target.checked)}
              />{" "}
              Clear on deactivate
            </label>
          </div>
          <ListEditor
            items={seRows}
            fields={SIDE_EFFECT_FIELDS}
            onChange={(rows) => patchSe(rows)}
            addLabel="+ add a side effect"
            itemTitle={(it, i) => (typeof it.variable === "string" && it.variable ? `${it.type} · ${it.variable}` : `Effect ${i + 1}`)}
            makeItem={() => ({ type: "setvar", variable: "", value: "", scope: "local" })}
          />
        </>
      )}
    </details>
  );
}
