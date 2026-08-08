/**
 * The staging action bar: only real when pieces are picked, and ONE Send commits the whole set.
 *
 * Lifted out of the room when the search box arrived and index.tsx hit its line cap. It is a clean
 * seam rather than a filing exercise: the bar's whole job is turning a set of staged KEYS back into
 * the pieces they name, which is the one thing every button here needs and nothing else in the room
 * does. Resolving through the live entity list (never a snapshot taken at stage time) is what keeps
 * the count honest after a delete or an import lands underneath the selection.
 *
 * STAGING OUTLIVES BOTH THE DECK AND THE SEARCH, and that is a decision rather than an oversight.
 * A selection already survives switching decks - that is the whole point of gathering a batch - so
 * having a search box quietly drop pieces out of it would make typing a destructive act on work
 * somebody had already picked. The count and the buttons therefore cover pieces the current filter
 * hides. `entities` is the WHOLE studio for exactly that reason; narrowing it to the visible shelf
 * would silently shrink a Delete the user already aimed.
 */
import type { JSX } from "react";
import type { StudioEntitySummary } from "../../app-contract";
import { pieceKey } from "./view-contract";

export interface SendBarProps {
  /** "kind:id" keys of the staged pieces, already validated against what is still on the shelf */
  staged: ReadonlySet<string>;
  entities: readonly StudioEntitySummary[];
  onSend: (batch: StudioEntitySummary[]) => void;
  onDelete: (batch: StudioEntitySummary[]) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function SendBar({
  staged,
  entities,
  onSend,
  onDelete,
  onSelectAll,
  onClear,
}: SendBarProps): JSX.Element | null {
  if (staged.size === 0) return null;
  const batch = (): StudioEntitySummary[] => {
    const byKey = new Map(entities.map((e) => [pieceKey(e), e]));
    return [...staged].map((k) => byKey.get(k)).filter((e): e is StudioEntitySummary => !!e);
  };
  const many = staged.size === 1 ? "it" : `all ${String(staged.size)}`;
  return (
    <div className="sendbar">
      <span className="cnt">{`${String(staged.size)} ${staged.size === 1 ? "piece" : "pieces"} staged`}</span>
      <button className="send" onClick={() => onSend(batch())}>
        {`Send ${many} to the Workbench`}
      </button>
      <button className="del" onClick={() => onDelete(batch())}>
        {`Delete ${many}`}
      </button>
      <button className="clear" onClick={onSelectAll}>
        Select all
      </button>
      <button className="clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
