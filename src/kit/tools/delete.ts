/**
 * Studio lifecycle: remove one piece from the studio. This is the only Kit tool that destroys
 * canonical content, and its exposure is a deliberate, narrow choice.
 *
 * WHY DIRECT AND NOT DEFERRED. capabilities/runtime.ts refuses any DEFERRED workflow whose effect is
 * `apply`, because discovery metadata must never be the thing that classifies a write. This tool
 * therefore carries no discovery descriptor at all: its one and only classification is the explicit
 * `["studio_delete", "delete"]` entry in the safety-owned trust map, which is the danger floor and
 * forces the Gate in every mode but full control. Nothing about this tool can be inferred; it has to
 * be granted by name.
 *
 * There is no draft stage: a draft models a proposed canonical entity, and a removal has no "after"
 * to review. The Gate peek plus this tool's pre-read is the review. Routing removal through the
 * draft/apply path instead would need ChangeDraftMode to grow a "remove" arm and `proposed` to
 * become optional - a change to a core authority that belongs in its own design pass, not here.
 *
 * HONEST LIMIT: nothing here checks whether other pieces reference the target. Deleting a lorebook
 * that a character links to leaves that character's knowledgeRefs dangling. The output says so
 * rather than implying a check that does not happen.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";

/** Kinds whose ids other pieces can point at, so the receipt only warns where a dangle is possible. */
const REFERENCEABLE = new Set(["lorebook", "pack", "regex"]);

const input = z.strictObject({
  kind: z.enum(STUDIO_ENTITY_KINDS).describe("the deck the piece lives in"),
  id: z.string().trim().min(1).max(120).describe("exact studio id of the piece to remove"),
});

const remove: HarnessTool<z.infer<typeof input>> = {
  name: "studio_delete",
  description:
    "Permanently remove one piece from the studio. This cannot be undone and does not check for "
    + "other pieces that reference it. Read the piece first if you are not certain it is the right one.",
  exposure: "direct",
  effect: "apply",
  input,
  concurrencyKey: ({ kind, id }) => `studio/${kind}/${id}`,
  async execute({ kind, id }, { bridge }) {
    const existing = await bridge.read(kind, id);
    if (!existing) {
      return {
        summary: `delete ${kind}/${id}: not found`,
        output: `No ${kind} with id "${id}" in the studio. Nothing was removed.`,
        outcome: "stale",
      };
    }
    const removed = await bridge.delete(kind, id);
    if (!removed) {
      return {
        summary: `delete ${kind}/${id}: failed`,
        output: `Could not remove ${kind}/${id}. The piece is still in the studio.`,
        outcome: "failed",
      };
    }
    const dangleNote = REFERENCEABLE.has(kind)
      ? ` Any character linking to this ${kind} now has a dangling reference; references were not checked.`
      : "";
    return {
      summary: `delete ${kind}/${id}: removed`,
      output: `Removed ${kind}/${id} from the studio. This cannot be undone.${dangleNote}`,
      outcome: "applied",
    };
  },
};

export default remove;
