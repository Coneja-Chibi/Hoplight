/**
 * `/rail`, from Kit's side.
 *
 * ONE SURFACE, TWO DOORS. There is exactly one rail. A person opens it by typing `/rail`; Kit opens
 * it by calling this. Named to say so, after a shorter-lived name that described what it did to a
 * preset instead - which read as a second feature, and had to be explained rather than recognised.
 *
 * WHY A TOOL AND NOT PROSE. Kit can already say "I have opened Paramnesia for you", and a shell that
 * had to read that out of a sentence would eventually open the wrong thing. Worse, a model able to
 * open a view by CLAIMING to have opened it can be wrong without anything catching it. So the shell
 * acts on a structured `show`, and the sentence is only ever a description of something that did
 * happen.
 *
 * READ-ONLY, AND THAT IS LOAD-BEARING. Opening a view changes nothing on disk, so it needs no
 * confirmation, and needing none is what makes it usable in the middle of a sentence. That is a
 * property of this door, not of the rail: the rail is a write surface whichever way it was opened,
 * and every edit made there meets the gate. Kit's own block edits go through `preset.blocks.manage`,
 * which is a draft and a gate like everything else. This tool cannot move a block.
 *
 * IT REFUSES TO GUESS. Two presets matching one word is a question, not a coin toss: opening the
 * wrong one and rearranging it is the failure this whole surface exists to prevent.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";

/**
 * `show` REQUIRES a preset, enforced here rather than in execute.
 *
 * Making `preset` optional for `status` quietly let `{}` parse, which moved a fail-closed refusal
 * from the schema boundary into a branch - the same guarantee, one layer further from where it can
 * be relied on. The refinement keeps the boundary where the doctrine puts it: parse untrusted input
 * once, at the edge, into something that cannot be wrong later.
 */
const input = z.strictObject({
  action: z.enum(["show", "status"]).default("show")
    .describe("show puts a preset on the rail; status reports what is on it right now"),
  preset: z.string().trim().min(1).max(120).optional()
    .describe("a preset's studio id, or part of its name; required for show"),
}).refine((value) => value.action !== "show" || (value.preset ?? "") !== "", {
  message: "show needs a preset to put on the rail",
  path: ["preset"],
});

const railOpen: HarnessTool<z.infer<typeof input>> = {
  name: "rail_open",
  description:
    "Open a preset on the rail beside the conversation, the same view the user gets from /rail. They "
    + "can watch its block order while you work and rearrange it themselves. Use it when they ask to "
    + "see a preset and after creating one. Opening the rail writes nothing.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: () => "rail-open",
  async execute(args, ctx) {
    /**
     * READ THE RAIL, do not remember it.
     *
     * Asked "which preset do I have up?", Kit used to answer from what it had opened earlier in the
     * conversation - and was wrong the moment the person opened a different one themselves. The rail
     * said Paramnesia; Kit said Empty Base, with no hedging, because nothing had ever let it look.
     */
    if (args.action === "status") {
      const open = ctx.rail?.() ?? null;
      if (!open) {
        return {
          summary: "rail_open status: nothing on the rail",
          output: "The rail is not showing a preset right now.",
        };
      }
      const unsaved = open.pending > 0
        // Naming the gap matters: reading the preset from storage would describe a file the person
        // can SEE is out of date on their own screen.
        ? ` There ${open.pending === 1 ? "is" : "are"} ${open.pending} unsaved change`
          + `${open.pending === 1 ? "" : "s"} on the rail, so the stored preset is behind what they see.`
        : "";
      return {
        summary: `rail_open status: ${open.presetId}`,
        output: `${open.title} (${open.presetId}) is on the rail: ${open.blocks} blocks, `
          + `${open.enabled} enabled.${unsaved}`,
      };
    }

    if (!args.preset) {
      return {
        summary: "rail_open: no preset named",
        output: "Name a preset to show, or use action \"status\" to see what is already on the rail.",
      };
    }
    const presets = await ctx.bridge.list("preset");
    if (presets.length === 0) {
      return { summary: "rail_open: none", output: "There are no presets in the studio." };
    }

    const needle = args.preset.trim().toLowerCase();
    const found = presets.filter(
      (piece) => piece.id.toLowerCase().includes(needle) || piece.name.toLowerCase().includes(needle),
    );

    if (found.length === 0) {
      return {
        summary: `rail_open: no match for "${args.preset}"`,
        output: `No preset matches "${args.preset}". There is: ${presets.map((p) => p.id).join(", ")}`,
      };
    }
    if (found.length > 1) {
      return {
        summary: `rail_open: ${found.length} match "${args.preset}"`,
        output: `Several match: ${found.map((p) => p.id).join(", ")}. Ask which one; do not pick.`,
      };
    }

    const piece = found[0]!;
    return {
      summary: `rail_open ${piece.id}`,
      // The shell opens it from this, not from anything said about it.
      show: { kind: "preset", id: piece.id },
      output: `${piece.name || piece.id} is now on the rail beside the conversation. The user can see`
        + " its blocks in evaluation order and rearrange them there.",
    };
  },
};

export default railOpen;
