/**
 * RoleCall's lore long tail: the memo flag, declared side effects (data only - Studio never
 * executes them), and the character filter. RoleCall has no Write-for lens (the Vaude full card
 * covers its wire), so this card surfaces on the full lens. Codec: formats/rolecall/lorebook.ts.
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
  // side-effect rows are a LOCAL draft: a just-added row has an empty variable and would be
  // filtered out of the body before it could be typed into; re-seeds when the page shows
  // a different entry
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
        <div className={styles.timeRow2}>
          <button
            type="button"
            className={entry.useMemo ? `${styles.fldBtn} ${styles.fldOn}` : styles.fldBtn}
            aria-pressed={entry.useMemo}
            title="Remember this entry once triggered"
            onClick={() => onPatch({ useMemo: !entry.useMemo })}
          >
            Memo
          </button>
        </div>
      )}
      {show("sideEffects") && (
        <>
          <span className={styles.plabel}>Side effects (declared data · never executed in Studio)</span>
          <div className={styles.timeRow2}>
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
            itemTitle={(it, i) =>
              typeof it.variable === "string" && it.variable ? `${it.type} · ${it.variable}` : `Effect ${i + 1}`
            }
            makeItem={() => ({ type: "setvar", variable: "", value: "", scope: "local" })}
          />
        </>
      )}
      {show("characterFilter") && <CharacterFilterBlock entry={entry} styles={styles} onPatch={onPatch} />}
    </>
  );
}

const card: LorePlatformCard = {
  id: "rolecall",
  label: "RoleCall",
  lenses: [],
  Component,
};

export default card;
