/**
 * Deletion for the shelves: the danger context-menu section, the plain-words confirm sheet, and
 * the batch runner. One hook owns the whole flow so the Library only asks for it and reloads.
 * Open pieces are refused (their editor could resurrect the file on the next save).
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { InkDialog } from "../../components/ink-dialog";

export interface EntityDelete {
  /** open the confirm sheet for this batch (empty batches are ignored) */
  requestDelete: (batch: StudioEntitySummary[]) => void;
  /** the confirm sheet, or null while nothing is pending; render it with the app's dialogs */
  confirm: JSX.Element | null;
}

export function useEntityDelete(ctx: AppContext, onDeleted: () => void): EntityDelete {
  const [pending, setPending] = useState<StudioEntitySummary[] | null>(null);

  useEffect(() => {
    return ctx.menus.register("entity", (t) => {
      const e = t.data as StudioEntitySummary;
      const open = ctx.workbench.pieces().some((p) => p.id === e.id && p.kind === e.kind);
      if (open) {
        return [{ label: "Close it on the Workbench to delete", disabled: true, onPick: () => undefined }];
      }
      return [{ label: "Delete from the studio", danger: true, onPick: () => setPending([e]) }];
    });
  }, [ctx]);

  const doDelete = async (): Promise<void> => {
    const batch = pending ?? [];
    setPending(null);
    let removed = 0;
    let failed = 0;
    for (const e of batch) {
      try {
        await ctx.api.deleteEntity(e.kind, e.id);
        removed++;
      } catch {
        failed++;
      }
    }
    onDeleted();
    ctx.setStatus(
      failed === 0
        ? `deleted ${removed} ${removed === 1 ? "piece" : "pieces"}`
        : `deleted ${removed}, could not delete ${failed}`,
    );
  };

  const confirm = pending ? (
    <InkDialog onDismiss={() => setPending(null)} ariaLabel="Delete pieces">
      <div className="delsheet">
        <b className="deltitle">
          {pending.length === 1
            ? `Delete "${pending[0]!.name}" from the studio?`
            : `Delete ${pending.length} pieces from the studio?`}
        </b>
        <p className="delbody">
          {pending.length === 1 ? "Its file is removed" : "Their files are removed"} from your
          studio folder. There is no undo.
        </p>
        <div className="delacts">
          <button className="delgo" onClick={() => void doDelete()}>
            Delete
          </button>
          <button className="delno" onClick={() => setPending(null)}>
            Keep
          </button>
        </div>
      </div>
    </InkDialog>
  ) : null;

  const requestDelete = (batch: StudioEntitySummary[]): void => {
    if (batch.length > 0) setPending(batch);
  };
  return { requestDelete, confirm };
}
