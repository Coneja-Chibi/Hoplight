/**
 * Committing what the rail staged, through the ordinary Gate.
 *
 * ONE IMPLEMENTATION, TWO DOORS: the Enter key and the pending badge. The badge exists because
 * every edit can be made with the pointer now - click a mark, a name, the title - and applying was
 * the one step that still demanded a keyboard the rail often did not have. A rename staged by
 * clicking the title could not be applied by clicking anything, and Enter went to the composer
 * instead and did nothing at all.
 *
 * NOTHING IS ADOPTED UNTIL A REAL APPLIED RECEIPT COMES BACK. A denied, stale or failed attempt
 * leaves every edit exactly where it was, which is what makes refusing safe to do.
 */
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { OutlineRow } from "../../../core/preset/outline";
import type { RailState } from "../../../core/preset/rail-edit";

export interface RailApplyDeps {
  dirty: boolean;
  rows: readonly OutlineRow[];
  pendingName: string | null;
  pendingNote: string | null;
  /** Writes the rows and reports the id it wrote to. Null means nothing was written. */
  onCommit?: (
    rows: readonly OutlineRow[],
    meta?: { name?: string; note?: string },
  ) => Promise<string | null>;
  setBaseline: Dispatch<SetStateAction<readonly OutlineRow[]>>;
  setState: Dispatch<SetStateAction<RailState>>;
  setTitle: Dispatch<SetStateAction<string>>;
  setPendingName: Dispatch<SetStateAction<string | null>>;
  setPendingNote: Dispatch<SetStateAction<string | null>>;
  /** Point the rail at the piece that was actually written, which a foreign edit relocates. */
  setPresetId: Dispatch<SetStateAction<string | null>>;
}

export function useRailApply(deps: RailApplyDeps): () => void {
  const { dirty, rows, pendingName, pendingNote, onCommit } = deps;
  const { setBaseline, setState, setTitle, setPendingName, setPendingNote, setPresetId } = deps;

  return useCallback(() => {
    if (!dirty) return;
    const meta = {
      ...(pendingName !== null ? { name: pendingName } : {}),
      ...(pendingNote !== null ? { note: pendingNote } : {}),
    };
    // .catch is not optional: a throw out of stage or commit had nowhere to go, and opentui routes
    // an unhandled rejection into a hidden debug overlay, so the failure was invisible.
    void onCommit?.(rows, meta).catch(() => null).then((writtenId) => {
      if (!writtenId) return;
      /**
       * FOLLOW WHAT WAS WRITTEN, WHICH IS NOT ALWAYS WHAT WAS OPENED.
       *
       * A foreign piece is saved as a Hoplight COPY under a free id, deliberately: the original is
       * a raw export and the whole point of that path is never to write over it. But the rail kept
       * pointing at the original, so the header snapped straight back to the untouched source and
       * the rename looked lost. It was not lost - it was in a file the rail had stopped looking at,
       * and the next apply would have made another copy beside it.
       */
      setPresetId(writtenId);
      // Adopting the written rows is what clears the pending badge, so it happens only here.
      setBaseline(rows.map((row) => ({
        ...row,
        ...(row.editedName !== undefined ? { name: row.editedName } : {}),
      })));
      setState((current) => ({
        ...current,
        rows: current.rows.map(({ editedName, editedContent, ...row }) => ({
          ...row,
          ...(editedName !== undefined ? { name: editedName } : {}),
        })),
      }));
      if (pendingName !== null) setTitle(pendingName);
      setPendingName(null);
      setPendingNote(null);
    });
  }, [
    dirty, rows, pendingName, pendingNote, onCommit,
    setBaseline, setState, setTitle, setPendingName, setPendingNote, setPresetId,
  ]);
}
