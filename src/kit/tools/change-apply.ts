/**
 * Direct tool factory for confirmed one-shot draft apply and verified receipts.
 */
import { z } from "zod";
import type { ChangeSession } from "../changes/session";
import { applyChangeDraft } from "../changes/apply";
import type { HarnessTool } from "./tool";

const input = z.strictObject({
  draftId: z.string().min(1),
});

/** Bind revision-checked apply to one Kit session. */
export function createChangeApplyTool(
  changes: ChangeSession,
): HarnessTool<z.infer<typeof input>> {
  return {
    name: "change_apply",
    description: "Apply one preview draft exactly once, then re-read and verify the saved canonical piece.",
    exposure: "direct",
    effect: "apply",
    input,
    concurrencyKey: ({ draftId }) => `draft/${draftId}`,
    async execute({ draftId }, { bridge }) {
      const receipt = await applyChangeDraft(changes, bridge, draftId);
      return {
        summary: `apply ${draftId}: ${receipt.status}`,
        output: JSON.stringify(receipt),
        outcome: receipt.status,
      };
    },
  };
}
