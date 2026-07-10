/**
 * Character-filter block - shared by the SillyTavern and RoleCall cards (both wires carry it).
 * Whitelist/blacklist an entry to characters by name or tag.
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../../entities/lorebook/schema";
import { filterFromInputs, filterMode, joinCsv, type FilterMode } from "../entry-extras";

export function CharacterFilterBlock({
  entry,
  styles,
  onPatch,
}: {
  entry: LorebookEntry;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
}): JSX.Element {
  const mode = filterMode(entry.characterFilter);
  const patchFilter = (nextMode: FilterMode, names: string, tags: string): void =>
    onPatch({ characterFilter: filterFromInputs(nextMode, names, tags) });

  return (
    <>
      <span className={styles.plabel}>Character filter</span>
      <div className={styles.timeRow2}>
        <select
          className={styles.headSel}
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
            <label className={styles.headFld}>
              <span>Names</span>
              <input
                className={styles.groupIn}
                value={joinCsv(entry.characterFilter?.names ?? [])}
                placeholder="comma-separated"
                aria-label="Character names (comma-separated)"
                onChange={(ev) => patchFilter(mode, ev.target.value, joinCsv(entry.characterFilter?.tags ?? []))}
              />
            </label>
            <label className={styles.headFld}>
              <span>Tags</span>
              <input
                className={styles.groupIn}
                value={joinCsv(entry.characterFilter?.tags ?? [])}
                placeholder="comma-separated"
                aria-label="Character tags (comma-separated)"
                onChange={(ev) => patchFilter(mode, joinCsv(entry.characterFilter?.names ?? []), ev.target.value)}
              />
            </label>
          </>
        )}
      </div>
    </>
  );
}
