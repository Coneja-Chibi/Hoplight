/**
 * What counts as an unapplied change.
 *
 * One answer, used by three things that must agree: the badge that shows a count, the Enter key that
 * decides whether there is anything to apply, and the step keys that refuse to walk away from unsaved
 * work. When they disagreed, the rail reported a pending change, refused to move because of it, and
 * then said "nothing to apply" when asked to write it - three symptoms of one miscount.
 */
import { diffOutline, type OutlineRow } from "../../../core/preset/outline";
import { railIsDirty } from "../../../core/preset/rail-edit";

/** The staged things that live beside the rows rather than in them. */
export interface RailMeta {
  readonly name: string | null;
  readonly note: string | null;
}

/** Has this row been typed into? */
const rowEdited = (row: OutlineRow): boolean =>
  row.editedName !== undefined || row.editedContent !== undefined;

/**
 * Is there anything unapplied?
 *
 * A RETYPED NAME IS A CHANGE. Dirtiness was once measured only by comparing rows, so the rail
 * refused to apply a rename that touched no block.
 */
export const railDirty = (
  baseline: readonly OutlineRow[],
  rows: readonly OutlineRow[],
  meta: RailMeta,
): boolean =>
  railIsDirty(baseline, rows) || meta.name !== null || meta.note !== null || rows.some(rowEdited);

/** How many unapplied changes there are, for the badge and for what the rail says out loud. */
export function railPending(
  baseline: readonly OutlineRow[],
  rows: readonly OutlineRow[],
  meta: RailMeta,
): number {
  const diff = diffOutline(baseline, rows);
  const typed = rows.filter(rowEdited).length
    + (meta.name !== null ? 1 : 0)
    + (meta.note !== null ? 1 : 0);
  return (diff ? diff.changes.length : 0) + typed;
}
