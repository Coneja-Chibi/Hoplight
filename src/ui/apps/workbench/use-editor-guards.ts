/** Shared Ctrl+S, window-close, and shell dirty-state wiring for every Workbench editor. */
import { useEffect } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";

export function useEditorGuards(
  ctx: AppContext,
  piece: StudioEntitySummary,
  dirty: boolean,
  save: () => Promise<void>,
): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty, save]);

  useEffect(() => {
    ctx.workbench.setDirty(piece.id, piece.kind, dirty);
    // ctx is a stable adapter whose identity changes on shell writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, piece.id, piece.kind]);
}
