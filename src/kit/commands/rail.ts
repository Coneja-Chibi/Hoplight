/**
 * /rail: keep a preset's block list open beside the conversation.
 *
 * The order a preset evaluates in is the thing least visible in a chat and most likely to be what
 * went wrong, so this is the one view worth keeping open rather than asking for. With it up, a move
 * Kit makes is something watched rather than something reported afterwards.
 *
 * Naming a preset is optional when there is only one. Being asked which of one is a question with a
 * known answer, and a command that asks it is a command people stop using.
 */
import type { KitCommand } from "./command";

const UNAVAILABLE = "The preset rail is unavailable in this build.";

const command: KitCommand = {
  name: "/rail",
  aliases: ["/blocks", "/outline"],
  summary: "keep a preset's blocks open beside the chat",
  group: "session",
  /**
   * The presets you have, plus the two words that close the rail.
   *
   * This is the argument most worth completing in Kit: a studio id is exact, lowercase, hyphenated
   * and nothing like the display name somebody remembers - `paramnesia-vi-rc` for "Paramnesia VI".
   * Typing it from memory is a coin flip, and the failure is silent-ish: you get "no preset called
   * that" and no list.
   *
   * The display name rides along as the note, so the list reads as the pieces you know rather than as
   * a column of slugs.
   */
  complete: async (_prefix, ctx) => {
    const presets = (await ctx.pieces?.("preset")) ?? [];
    return [
      ...presets.map((piece) => ({
        value: piece.id,
        ...(piece.name && piece.name !== piece.id ? { note: piece.name } : {}),
      })),
      { value: "off", note: "close the rail" },
    ];
  },
  run: async (ctx) => {
    if (!ctx.rail) return ctx.say(UNAVAILABLE);
    const query = ctx.arg.trim();
    if (query.toLowerCase() === "off" || query.toLowerCase() === "close") {
      ctx.rail.close();
      return ctx.say("Rail closed.");
    }
    const outcome = await ctx.rail.open(query);
    if (outcome.ok) return;
    ctx.say(outcome.detail);
  },
};

export default command;
