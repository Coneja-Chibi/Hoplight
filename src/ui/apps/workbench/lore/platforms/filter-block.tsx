/**
 * Character-filter zone - shared by SillyTavern and RoleCall cards.
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
    <div className={styles.pcZone}>
      <div className={styles.pcZh}>
        <b>Character filter</b>
        <span>who this entry is allowed to bind to</span>
      </div>
      <div className={styles.pcRow}>
        <span className={styles.pcK}>Applies to</span>
        <select
          className={styles.pcSel}
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
          <option value="include">Only these…</option>
          <option value="exclude">All except…</option>
        </select>
      </div>
      {mode !== "off" && (
        <>
          <div className={styles.pcRow}>
            <span className={styles.pcK}>Names</span>
            <input
              className={styles.pcText}
              value={joinCsv(entry.characterFilter?.names ?? [])}
              placeholder="comma-separated"
              aria-label="Character names (comma-separated)"
              onChange={(ev) =>
                patchFilter(mode, ev.target.value, joinCsv(entry.characterFilter?.tags ?? []))
              }
            />
          </div>
          <div className={styles.pcRow}>
            <span className={styles.pcK}>Tags</span>
            <input
              className={styles.pcText}
              value={joinCsv(entry.characterFilter?.tags ?? [])}
              placeholder="comma-separated"
              aria-label="Character tags (comma-separated)"
              onChange={(ev) =>
                patchFilter(mode, joinCsv(entry.characterFilter?.names ?? []), ev.target.value)
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
