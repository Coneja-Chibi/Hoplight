/**
 * Copy prompt blocks from one preset into another.
 *
 * WHY IT IS A TOOL AND NOT A CAPABILITY. Capabilities take ONE entity - `preview(entity, input)` -
 * so a cross-piece operation is structurally impossible there. The model could already approximate
 * this by reading a preset and calling `blocks.add` with the text typed back out, and that is the
 * thing worth avoiding: a 3.8k block of hand-laid unicode retyped through a model is expensive,
 * lossy, and silently different from what was copied. This copies BY REFERENCE, so what lands is
 * byte-for-byte what was read.
 *
 * IT STAGES, IT DOES NOT WRITE. The result is an ordinary draft that meets the ordinary Gate, so a
 * copy is reviewed like every other change and applied by the same path.
 */
import { z } from "zod";
import type { ChangeSession } from "../changes/session";
import type { HarnessTool } from "./tool";
import type { PresetBody, PresetPrompt } from "../../entities/preset/schema";
import { addPresetBlock, type BlockPlacement } from "../../entities/preset/operations";
import { reviewChangeDraft } from "../changes/review";
import type { CanonicalPreset } from "../../entities/preset/schema";

const input = z.strictObject({
  fromPreset: z.string().min(1).describe("the preset id to copy blocks OUT of"),
  toPreset: z.string().min(1).describe("the preset id to copy them INTO; may be the same preset"),
  blockIds: z.array(z.string().min(1)).min(1).max(64)
    .describe("the ids of the blocks to copy, in the order they should land"),
  /**
   * Where they go. Named separately from the ids because "copy these" and "put them here" are two
   * decisions, and the second one is the one somebody notices getting wrong.
   */
  place: z.union([
    z.literal("first"),
    z.literal("last"),
    z.strictObject({ before: z.string().min(1) }),
    z.strictObject({ after: z.string().min(1) }),
  ]).optional().describe("first, last, or beside a named block in the target; defaults to last"),
});

type Input = z.infer<typeof input>;

/**
 * A copied block needs its own id in the target.
 *
 * TWO BLOCKS SHARING AN ID is how a preset silently loses one: every operation that addresses a
 * block by id - move, patch, remove, group - would hit whichever came first. Copying a block into
 * the preset it came from is the ordinary case that produces this, not an exotic one.
 */
function freshId(taken: ReadonlySet<string>, from: string): string {
  if (!taken.has(from)) return from;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${from}-copy${n === 2 ? "" : String(n)}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${from}-copy-${String(taken.size)}`;
}

export function createPresetCopyBlocksTool(changes: ChangeSession): HarnessTool<Input> {
  return {
    name: "preset_copy_blocks",
    description:
      "Copy one or more prompt blocks from a preset into another preset (or elsewhere in the same "
      + "one), keeping their content exactly. Stages a draft for review; it does not write.",
    exposure: "direct",
    effect: "draft",
    input,
    concurrencyKey: ({ toPreset }) => `preset/${toPreset}`,
    async execute(args, { bridge }) {
      const source = await bridge.read("preset", args.fromPreset);
      if (!source || source.kind !== "preset") {
        return {
          summary: `copy blocks: ${args.fromPreset} not found`,
          output: `No preset with id "${args.fromPreset}" in the studio.`,
        };
      }
      const target = args.toPreset === args.fromPreset
        ? source
        : await bridge.read("preset", args.toPreset);
      if (!target || target.kind !== "preset") {
        return {
          summary: `copy blocks: ${args.toPreset} not found`,
          output: `No preset with id "${args.toPreset}" in the studio.`,
        };
      }

      const fromBody = (source as CanonicalPreset).body;
      const byId = new Map(fromBody.prompts.map((p) => [p.id, p]));
      /**
       * NAMED BUT ABSENT IS A REFUSAL, not a quiet partial copy. Copying three of the four blocks
       * somebody asked for, and reporting success, is the kind of result that is only discovered
       * later by the person who trusted it.
       */
      const missing = args.blockIds.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        return {
          summary: `copy blocks: ${String(missing.length)} not in ${args.fromPreset}`,
          output: `These blocks are not in "${args.fromPreset}": ${missing.join(", ")}. Nothing was copied.`,
        };
      }

      const baseline = target as CanonicalPreset;
      const targetBody = baseline.body;
      const taken = new Set(targetBody.prompts.map((p) => p.id));
      const place: BlockPlacement = args.place ?? "last";

      let next = targetBody;
      const landed: string[] = [];
      /**
       * Placed in the order given, each after the one before it, so a run of blocks arrives in the
       * order it was asked for rather than reversed - which is what inserting each at the same
       * anchor would do.
       */
      let anchor: BlockPlacement = place;
      for (const id of args.blockIds) {
        const original = byId.get(id);
        if (!original) continue;
        const copy: PresetPrompt = { ...original, id: freshId(taken, original.id) };
        taken.add(copy.id);
        next = addPresetBlock(next, copy, anchor);
        landed.push(copy.id);
        anchor = { after: copy.id };
      }

      const draft = changes.revise(
        baseline,
        { ...baseline, body: next },
        {
          capabilityId: "preset.blocks.copy",
          input: args,
          /**
           * One row per block, pointing at where it landed. The Gate reads these, so the path is
           * the real JSON Pointer into the target rather than a label: it is what lets somebody
           * see WHERE a copy went, which is the half of "copy these there" most easily got wrong.
           */
          changes: landed.map((id, at) => {
            const source = args.blockIds[at] ?? id;
            const index = next.prompts.findIndex((p) => p.id === id);
            return {
              path: `/prompts/${String(index)}`,
              label: `copy ${byId.get(source)?.name ?? source}`,
              before: null,
              after: id,
            };
          }),
          warnings: landed.some((id, at) => id !== args.blockIds[at])
            ? ["Some copies were renamed, because the target already held a block with that id."]
            : [],
          platformImpact: [],
        },
      );

      return {
        summary: `copy ${String(landed.length)} block(s) into ${args.toPreset}: staged`,
        output: JSON.stringify({
          draftId: draft.id,
          from: args.fromPreset,
          to: args.toPreset,
          copied: landed,
          place,
        }),
        outcome: "draft",
        // The Gate renders the semantic diff from this rather than from the sentence above it.
        review: reviewChangeDraft(draft),
      };
    },
  };
}
