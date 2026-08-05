/**
 * `studio_art`: put a piece's own card art on screen.
 *
 * WHY A TOOL AND NOT A DESCRIPTION. Kit can already write "she has dark hair and a scar" from the
 * card text, and that is a paraphrase of a picture nobody was shown. The studio has been full of
 * portraits with no route to the terminal at all, so the model's only option was to talk about them.
 *
 * READ-ONLY, and load-bearing for the same reason `rail_open` is: showing a picture changes nothing,
 * so it needs no confirmation, and needing none is what makes it usable in the middle of a sentence.
 *
 * IT REFUSES TO GUESS between several matches. Showing the wrong face is a small failure and a
 * confusing one, and one more question is cheaper than somebody wondering why Kit thinks that is Wren.
 *
 * The BYTES do not pass through here. The result carries a structured `show` and the shell resolves
 * the art itself, which keeps a base64 portrait out of the model's context: a card image is often
 * hundreds of kilobytes, the provider takes text, and paying for it in tokens to render something the
 * model cannot see would be the worst possible trade.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { hasPortrait } from "../../studio/portrait";

const input = z.strictObject({
  piece: z.string().trim().min(1).max(120)
    .describe("the piece's studio id, or part of its name"),
  kind: z.enum(["character", "pack", "persona"]).default("character")
    .describe("which deck to look in; characters carry portraits, packs carry faces"),
});

const studioArt: HarnessTool<z.infer<typeof input>> = {
  name: "studio_art",
  description:
    "Show a piece's card art to the user, in the conversation. Use it when they ask what someone "
    + "looks like, when you are comparing characters, or after opening one. You do not see the "
    + "image; the user does. Showing art writes nothing.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: () => "studio-art",
  async execute(args, ctx) {
    const pieces = await ctx.bridge.list(args.kind);
    if (pieces.length === 0) {
      return { summary: `studio_art: no ${args.kind}s`, output: `There are no ${args.kind}s in the studio.` };
    }
    const needle = args.piece.trim().toLowerCase();
    const exact = pieces.find((piece) => piece.id.toLowerCase() === needle);
    const found = exact
      ? [exact]
      : pieces.filter(
        (piece) => piece.id.toLowerCase().includes(needle) || piece.name.toLowerCase().includes(needle),
      );

    if (found.length === 0) {
      return {
        summary: `studio_art: no match for "${args.piece}"`,
        output: `No ${args.kind} matches "${args.piece}".`,
      };
    }
    if (found.length > 1) {
      return {
        summary: `studio_art: ${found.length} match "${args.piece}"`,
        output: `Several match: ${found.map((p) => p.id).join(", ")}. Ask which one; do not pick.`,
      };
    }

    const piece = found[0]!;
    const entity = await ctx.bridge.read(args.kind, piece.id);
    // Checked BEFORE claiming to have shown anything. A tool that reports success and draws nothing
    // teaches the model to describe a picture the person is not looking at.
    if (!entity || !hasPortrait(entity)) {
      return {
        summary: `studio_art: ${piece.id} has no art`,
        output: `${piece.name || piece.id} carries no card art, so there is nothing to show. Its `
          + "description is the only picture of it there is.",
      };
    }
    return {
      summary: `studio_art ${piece.id}`,
      // The shell draws it from this, not from anything said about it.
      show: { kind: args.kind, id: piece.id },
      output: `${piece.name || piece.id}'s card art is now on screen for the user. You cannot see it; `
        + "do not describe what is in it beyond what the card's own text says.",
    };
  },
};

export default studioArt;
