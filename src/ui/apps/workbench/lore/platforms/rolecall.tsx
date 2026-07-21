/**
 * RoleCall lore long tail: memo, side-effect deck, character filter.
 * Layout: design/vs-lore-platform-extras.html pass 3.2. Codec: formats/rolecall/lorebook.ts.
 */
import { useEffect, useState, type JSX } from "react";
import type { FormField } from "../../../../components/field-form";
import { ListEditor } from "../../../../components/list-editor";
import { rowsFromSideEffects, sideEffectsFromRows } from "../entry-extras";
import type { LorePlatformCard, LorePlatformCardProps } from "./card-contract";
import { CharacterFilterBlock } from "./filter-block";

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

function Component({ entry, show, styles, onPatch }: LorePlatformCardProps): JSX.Element | null {
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

  const any = show("useMemo") || show("sideEffects") || show("characterFilter");
  if (!any) return null;

  return (
    <>
      {show("useMemo") && (
        <div className={styles.pcZone}>
          <div className={styles.pcZh}>
            <b>Memory</b>
            <span>once this entry has spoken</span>
          </div>
          <div className={styles.pcMemo}>
            <b>Memo</b>
            <span>Remember this entry once it has fired.</span>
            <button
              type="button"
              className={entry.useMemo ? styles.pcSwitch : `${styles.pcSwitch} ${styles.pcSwitchOff}`}
              role="switch"
              aria-checked={entry.useMemo}
              aria-label="Memo: remember this entry once triggered"
              onClick={() => onPatch({ useMemo: !entry.useMemo })}
            />
          </div>
        </div>
      )}

      {show("sideEffects") && (
        <div className={styles.pcZone}>
          <div className={styles.pcZh}>
            <b>Side effects</b>
            <span>declared data · Studio never runs these</span>
            <em>
              {seRows.length} effect{seRows.length === 1 ? "" : "s"}
            </em>
          </div>
          <div className={styles.pcPair} style={{ marginBottom: "0.4rem" }}>
            <div className={styles.pcCell}>
              <div className={styles.pcCellT}>
                <b>Only on first trigger</b>
              </div>
              <button
                type="button"
                className={
                  entry.sideEffects?.onlyOnFirstTrigger === true
                    ? styles.pcSwitch
                    : `${styles.pcSwitch} ${styles.pcSwitchOff}`
                }
                role="switch"
                aria-checked={entry.sideEffects?.onlyOnFirstTrigger === true}
                aria-label="Only on first trigger"
                onClick={() =>
                  patchSe(seRows, !(entry.sideEffects?.onlyOnFirstTrigger === true), undefined)
                }
              />
            </div>
            <div className={styles.pcCell}>
              <div className={styles.pcCellT}>
                <b>Clear on deactivate</b>
              </div>
              <button
                type="button"
                className={
                  entry.sideEffects?.clearOnDeactivate === true
                    ? styles.pcSwitch
                    : `${styles.pcSwitch} ${styles.pcSwitchOff}`
                }
                role="switch"
                aria-checked={entry.sideEffects?.clearOnDeactivate === true}
                aria-label="Clear on deactivate"
                onClick={() =>
                  patchSe(seRows, undefined, !(entry.sideEffects?.clearOnDeactivate === true))
                }
              />
            </div>
          </div>
          <ListEditor
            items={seRows}
            fields={SIDE_EFFECT_FIELDS}
            onChange={(rows) => patchSe(rows)}
            addLabel="+ add a side effect"
            itemTitle={(it, i) =>
              typeof it.variable === "string" && it.variable
                ? `${it.type} · ${it.variable}`
                : `Effect ${i + 1}`
            }
            makeItem={() => ({ type: "setvar", variable: "", value: "", scope: "local" })}
          />
        </div>
      )}

      {show("characterFilter") && (
        <CharacterFilterBlock entry={entry} styles={styles} onPatch={onPatch} />
      )}
    </>
  );
}

const card: LorePlatformCard = {
  id: "rolecall",
  label: "RoleCall",
  lenses: ["rolecall"],
  Component,
};

export default card;
