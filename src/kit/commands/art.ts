/**
 * /art: show a piece's card art in the conversation.
 *
 * The studio has been full of portraits the whole time with no way to look at one from Kit. This is
 * the direct door; `studio_art` is the one Kit itself uses when a face is worth showing mid-sentence.
 */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/art",
  aliases: ["/portrait", "/face"],
  summary: "show a character's card art",
  group: "session",
  complete: async (prefix, ctx) => {
    const pieces = (await ctx.pieces?.("character")) ?? [];
    const wanted = prefix.trim().toLowerCase();
    return pieces
      .filter((piece) => !wanted || piece.id.toLowerCase().includes(wanted) || (piece.name ?? "").toLowerCase().includes(wanted))
      .slice(0, 8)
      .map((piece) => ({ value: piece.id, note: piece.name ?? "" }));
  },
  run: async (ctx) => {
    if (!ctx.art) {
      ctx.say("This shell cannot draw pictures.");
      return;
    }
    const outcome = await ctx.art.show(ctx.arg);
    if (!outcome.ok) ctx.say(outcome.detail);
  },
};

export default command;
