/**
 * Read-only list, show, and validation controls for complete session-local change drafts.
 */
import { z } from "zod";
import type { ChangeSession } from "../changes/session";
import { validateChangeDraft } from "../changes/validate";
import type { CapturedResult } from "../results/store";
import type { HarnessTool } from "./tool";

const input = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("list") }),
  z.strictObject({
    action: z.literal("show"),
    draftId: z.string().min(1),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(12_000).optional(),
  }),
  z.strictObject({
    action: z.literal("validate"),
    draftId: z.string().min(1),
  }),
]);

const draftSummary = (draft: NonNullable<ReturnType<ChangeSession["get"]>>) => ({
  id: draft.id,
  target: draft.target,
  status: draft.status,
  operationCount: draft.operations.length,
  changeCount: draft.operations.reduce(
    (total, operation) => total + operation.changes.length,
    0,
  ),
  warningCount: draft.warnings.length,
  platformImpactCount: draft.platformImpact.length,
});

/** Bind read-only draft inspection to one session-local change store. */
export function createChangeQueryTool(
  changes: ChangeSession,
): HarnessTool<z.infer<typeof input>> {
  return {
    name: "change_query",
    description:
      "List change drafts, show one complete accumulated proposal, or validate it without writing.",
    exposure: "direct",
    effect: "read",
    input,
    concurrencyKey: (args) =>
      `changes/${"draftId" in args ? args.draftId : "list"}`,
    async execute(args, { bridge, results }) {
      if (args.action === "list") {
        return {
          summary: `change list: ${changes.list().length}`,
          output: JSON.stringify({
            drafts: changes.list().map(draftSummary),
          }),
        };
      }
      const draft = changes.get(args.draftId);
      if (!draft) {
        return {
          summary: `change ${args.action} ${args.draftId}: unavailable`,
          output: `No change draft named "${args.draftId}".`,
        };
      }
      if (args.action === "validate") {
        const validation = await validateChangeDraft(draft, bridge);
        return {
          summary: `change validate ${draft.id}: ${validation.valid ? "valid" : "invalid"}`,
          output: JSON.stringify(validation),
        };
      }
      const output = JSON.stringify({ draft });
      if (args.offset !== undefined || args.limit !== undefined) {
        const offset = Math.max(0, Math.min(output.length, args.offset ?? 0));
        const limit = Math.max(1, Math.min(12_000, args.limit ?? 4_096));
        const content = output.slice(offset, offset + limit);
        const end = offset + content.length;
        return {
          summary: `change show ${draft.id}: page ${offset}`,
          output: JSON.stringify({
            draftId: draft.id,
            content,
            offset,
            limit,
            totalChars: output.length,
            nextOffset: end < output.length ? end : null,
          }),
        };
      }
      if (!results) {
        return {
          summary: `change show ${draft.id}`,
          output: output.length <= 12_000
            ? output
            : JSON.stringify({
                draftId: draft.id,
                content: output.slice(0, 4_096),
                offset: 0,
                limit: 4_096,
                totalChars: output.length,
                nextOffset: 4_096,
              }),
        };
      }
      let captured: CapturedResult;
      try {
        captured = results.capture(`change/${draft.id}`, output);
      } catch {
        return {
          summary: `change show ${draft.id}: page 0`,
          output: JSON.stringify({
            draftId: draft.id,
            content: output.slice(0, 4_096),
            offset: 0,
            limit: 4_096,
            totalChars: output.length,
            nextOffset: 4_096,
          }),
        };
      }
      return {
        summary: captured.spilled
          ? `change show ${draft.id}: spilled ${captured.totalChars} chars`
          : `change show ${draft.id}`,
        output: captured.spilled ? JSON.stringify(captured) : captured.content,
      };
    },
  };
}
