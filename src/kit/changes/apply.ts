/**
 * One-shot draft apply: compare revision, save once, re-read, and emit a truthful receipt.
 */
import type { KitBridge } from "../bridge";
import type { ChangeSession } from "./session";
import type { ChangeDraft, ChangeReceipt } from "./types";
import { verifySavedEntity } from "./verify";

const counts = (draft: ChangeDraft): Pick<ChangeReceipt, "operationCount" | "changeCount"> => ({
  operationCount: draft.operations.length,
  changeCount: draft.operations.reduce((sum, operation) => sum + operation.changes.length, 0),
});

const receipt = (
  draft: ChangeDraft,
  status: ChangeReceipt["status"],
  detail: string,
): ChangeReceipt => ({
  draftId: draft.id,
  target: draft.target,
  status,
  ...counts(draft),
  detail,
});

/** Apply a draft at most once through the bridge's compare-and-save seam. */
export async function applyChangeDraft(
  changes: ChangeSession,
  bridge: KitBridge,
  draftId: string,
): Promise<ChangeReceipt> {
  const draft = changes.startApply(draftId);
  if (!draft) {
    const found = changes.get(draftId);
    if (found) {
      const status = found.status === "discarded" ? "discarded" : "failed";
      return receipt(found, status, `Draft is already ${found.status}; it was not applied again.`);
    }
    return {
      draftId,
      target: null,
      status: "failed",
      operationCount: 0,
      changeCount: 0,
      detail: "Draft does not exist.",
    };
  }

  if (!bridge.compareAndSave) {
    changes.finishApply(draft.id, "failed");
    return receipt(draft, "failed", "The Studio does not support revision-checked saves.");
  }

  try {
    const result = await bridge.compareAndSave(draft.proposed, draft.target.revision);
    if (result.status === "stale") {
      changes.finishApply(draft.id, "stale");
      return receipt(draft, "stale", "The piece changed after this draft began; nothing was written.");
    }
    if (result.status === "missing") {
      changes.finishApply(draft.id, "failed");
      return receipt(draft, "failed", "The target no longer exists; nothing was written.");
    }

    const saved = await bridge.read(draft.target.kind, draft.target.id);
    if (!saved || !verifySavedEntity(draft.proposed, saved)) {
      changes.finishApply(draft.id, "failed");
      return receipt(
        draft,
        "failed",
        "The save returned but post-save verification did not match. Re-read before retrying.",
      );
    }
    changes.finishApply(draft.id, "applied");
    return receipt(draft, "applied", "Saved once and verified against the canonical piece.");
  } catch (error) {
    changes.finishApply(draft.id, "failed");
    return receipt(
      draft,
      "failed",
      `Apply failed without a verified receipt: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
