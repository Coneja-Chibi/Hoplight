/**
 * The only adapter from pure content capabilities to Kit's HarnessTool runtime.
 */
import {
  parseCanonicalEntity,
} from "../../entities/runtime-schema";
import {
  providerToolName,
  type ContentCapability,
} from "../../entities/capabilities";
import type { ChangeSession } from "../changes/session";
import { reviewChangeDraft } from "../changes/review";
import type { HarnessTool } from "../tools/tool";

const plural = (count: number): string => count === 1 ? "change" : "changes";
const jsonEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** Bind a pure capability to Kit's bridge and one session-local draft composer. */
export function capabilityToHarnessTool(
  capability: ContentCapability,
  changes: ChangeSession,
): HarnessTool {
  return {
    name: providerToolName(capability.id),
    description: capability.effect === "read"
      ? `${capability.summary} Reads deterministic analysis; it does not create a draft.`
      : `${capability.summary} Creates a preview draft; it does not save the piece.`,
    exposure: capability.exposure,
    effect: capability.effect,
    input: capability.input,
    concurrencyKey: (args) => capability.concurrencyKey(args),
    async execute(args, { bridge, results }) {
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

      if (capability.effect === "read") {
        const sourceEntity = parseCanonicalEntity(entity);
        const preview = capability.preview(sourceEntity, args);
        const observedEntity = parseCanonicalEntity(preview.entity);
        if (!jsonEqual(observedEntity, sourceEntity) || preview.changes.length > 0) {
          throw new Error(`${capability.id}: read capability attempted to change canonical content`);
        }
        const output = JSON.stringify({
          capabilityId: capability.id,
          target: { kind: capability.kind, id },
          observation: preview.observation ?? null,
          warnings: preview.warnings,
          platformImpact: preview.platformImpact,
        });
        const captured = results?.capture(`capability/${capability.id}`, output);
        return {
          summary: `read ${capability.id}`,
          output: captured?.spilled
            ? JSON.stringify(captured)
            : captured?.content ?? output,
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
          operations: draft.operations,
          warnings: draft.warnings,
          platformImpact: draft.platformImpact,
        }),
        outcome: "draft",
        review: reviewChangeDraft(draft),
      };
    },
  };
}
