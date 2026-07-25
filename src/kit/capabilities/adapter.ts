/**
 * The only adapter from pure content capabilities to Kit's HarnessTool runtime.
 */
import {
  providerToolName,
  type ContentCapability,
} from "../../entities/capabilities";
import type { ChangeSession } from "../changes/session";
import type { HarnessTool } from "../tools/tool";

const plural = (count: number): string => count === 1 ? "change" : "changes";

/** Bind a pure capability to Kit's bridge and one session-local draft composer. */
export function capabilityToHarnessTool(
  capability: ContentCapability,
  changes: ChangeSession,
): HarnessTool {
  return {
    name: providerToolName(capability.id),
    description: `${capability.summary} Creates a preview draft; it does not save the piece.`,
    exposure: capability.exposure,
    effect: "draft",
    input: capability.input,
    concurrencyKey: (args) => capability.concurrencyKey(args),
    async execute(args, { bridge }) {
      const target = typeof args === "object" && args !== null
        ? (args as { target?: { id?: unknown } }).target
        : undefined;
      const id = typeof target?.id === "string" ? target.id : "";
      const entity = id ? await bridge.read(capability.kind, id) : null;
      if (!entity) {
        return {
          summary: `draft ${capability.id}: target not found`,
          output: `No ${capability.kind} with id "${id}" is available to draft.`,
        };
      }

      const draft = changes.draft(capability, args, entity);
      const latest = draft.operations.at(-1)!;
      const count = latest.changes.length;
      return {
        summary: `draft ${capability.id}: ${count} ${plural(count)}`,
        output: JSON.stringify({
          draftId: draft.id,
          target: draft.target,
          status: draft.status,
          changes: latest.changes,
          warnings: draft.warnings,
        }),
        outcome: "draft",
      };
    },
  };
}
