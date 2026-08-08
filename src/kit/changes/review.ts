/**
 * Build the bounded, presentation-safe change review carried from a draft result into Kit's Gate.
 */
import type { DraftReview } from "../tools/tool";
import type { ChangeDraft } from "./types";

/** Project one complete draft into semantic change rows without exposing its canonical payload. */
export function reviewChangeDraft(draft: ChangeDraft): DraftReview {
  return {
    draftId: draft.id,
    target: {
      kind: draft.target.kind,
      id: draft.target.id,
    },
    changes: draft.operations.flatMap((operation) =>
      operation.changes.map((change) => ({
        label: change.label,
        before: change.before,
        after: change.after,
      }))
    ),
    warningCount: draft.warnings.length,
    warnings: draft.warnings,
  };
}
