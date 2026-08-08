/**
 * Write tool: take a block out of a preset and keep it.
 *
 * THE MISSING THIRD OPTION. Until this existed, a block that was plainly not wanted had two futures:
 * stay in the preset and keep costing tokens, or be deleted and be gone. So they stayed. This is the
 * one somebody actually wants - out of the preset, still theirs, findable.
 *
 * TWO WRITES, ONE ACT, AND THE ORDER MATTERS. The block is buried FIRST and removed from the preset
 * second, because the failure modes are not symmetrical: a burial that lands with no removal leaves
 * a harmless duplicate, and a removal that lands with no burial destroys the block. Whichever half
 * fails, the copy exists.
 *
 * The preset edit is a DRAFT, like every other change to a piece, so the removal meets the same
 * review the person already knows before anything leaves their preset.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { bury, type Grave } from "../../studio/graveyard-shape";
import { reviewChangeDraft } from "../changes/review";

const input = z.strictObject({
  preset: z.string().trim().min(1).max(120).describe("the preset's studio id"),
  blockId: z.string().trim().min(1).describe("the id of the block to set aside"),
  note: z.string().trim().max(400).optional()
    .describe("why it was set aside, in the person's words where they gave any"),
});

const graveyardBury: HarnessTool<z.infer<typeof input>> = {
  name: "studio_graveyard_bury",
  description:
    "Set a prompt block aside: copy it to the block graveyard and stage its removal from the "
    + "preset. Use this instead of deleting a block, so the writing survives. The removal is a "
    + "draft the person reviews; the copy is kept either way.",
  exposure: "direct",
  effect: "draft",
  input,
  concurrencyKey: ({ preset }) => `studio/preset/${preset}`,
  async execute({ preset, blockId, note }, ctx) {
    const entity = await ctx.bridge.read("preset", preset);
    if (!entity) return { summary: `bury: no preset ${preset}`, output: `No preset with id "${preset}".` };

    const body = entity.body as { prompts?: { id: string; name?: string }[]; name?: string };
    const prompts = Array.isArray(body.prompts) ? body.prompts : [];
    const block = prompts.find((p) => p.id === blockId);
    if (!block) {
      return {
        summary: `bury: no block ${blockId}`,
        output: `That preset has no block "${blockId}". It has: ${prompts.map((p) => p.id).slice(0, 20).join(", ")}`,
      };
    }

    if (!ctx.graveyard) {
      return { summary: "bury: no graveyard", output: "This session has no graveyard to bury into." };
    }

    /**
     * THE COPY FIRST. If this fails, nothing has been taken out of the preset and the person is
     * exactly where they started - which is the only failure worth having.
     */
    const grave: Grave = {
      id: `grave-${blockId}-${String(ctx.now?.() ?? Date.now())}`,
      block: block as Grave["block"],
      from: { presetId: preset, presetName: typeof body.name === "string" ? body.name : preset },
      at: ctx.now?.() ?? Date.now(),
      ...(note ? { note } : {}),
    };
    await ctx.graveyard.edit((current) => bury(current, grave));

    if (!ctx.changes) {
      return {
        summary: `buried ${blockId}`,
        output: `Kept "${block.name ?? blockId}" in the graveyard as ${grave.id}. `
          + "This session cannot stage the removal, so the block is still in the preset.",
      };
    }

    /**
     * `revise` rather than `draft`, because this is a before and an after with no capability behind
     * it - the same seam the rail uses when a person rearranges blocks by hand. It still becomes an
     * ordinary draft, so it still meets the ordinary Gate, revision check and receipt.
     */
    const next = { ...entity, body: { ...body, prompts: prompts.filter((p) => p.id !== blockId) } };
    const draft = ctx.changes.revise(entity, next, {
      capabilityId: "preset.blocks.bury",
      input: { preset, blockId },
      /**
       * The review says where the block WENT, not just that it left. "Removed" and "set aside, and
       * here is where it is" are different sentences to be asked to approve, and only one of them
       * is true.
       */
      changes: [{
        path: `prompts.${blockId}`,
        label: block.name ?? blockId,
        before: "in the preset",
        after: `kept in the graveyard as ${grave.id}`,
      }],
      warnings: [],
      platformImpact: [],
    });
    return {
      summary: `bury ${blockId}: staged`,
      outcome: "draft",
      review: reviewChangeDraft(draft),
      output: `Kept "${block.name ?? blockId}" in the graveyard as ${grave.id}, and staged its `
        + "removal from the preset. The copy is safe whether or not the removal is applied.",
    };
  },
};

export default graveyardBury;
