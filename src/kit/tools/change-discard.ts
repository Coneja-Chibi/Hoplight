/**
 * Direct tool factory for discarding one session-local preview draft without touching the Studio.
 */
import { z } from "zod";
import type { ChangeSession } from "../changes/session";
import type { HarnessTool } from "./tool";

const input = z.strictObject({
  draftId: z.string().min(1),
});

/** Bind draft discard to one Kit session. */
export function createChangeDiscardTool(
  changes: ChangeSession,
): HarnessTool<z.infer<typeof input>> {
  return {
    name: "change_discard",
    description: "Discard one preview draft. This never changes the saved piece.",
    exposure: "direct",
    effect: "draft",
    input,
    concurrencyKey: ({ draftId }) => `draft/${draftId}`,
    async execute({ draftId }) {
      const draft = changes.discard(draftId);
      if (!draft) {
        return {
          summary: `discard ${draftId}: unavailable`,
          output: `Draft "${draftId}" is missing or no longer discardable.`,
        };
      }
      return {
        summary: `discard ${draftId}: discarded`,
        output: JSON.stringify({
          draftId,
          target: draft.target,
          status: draft.status,
        }),
        outcome: "discarded",
      };
    },
  };
}
