/**
 * /gallery: your card art along the bottom of the screen.
 *
 * The shelf you can look at, as opposed to /art which answers about one piece. Both read the same
 * seam; this one is the view.
 */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/gallery",
  aliases: ["/cast", "/faces"],
  summary: "show your card art along the bottom",
  group: "session",
  complete: async (prefix) => {
    const wanted = prefix.trim().toLowerCase();
    return ["character", "pack", "persona"]
      .filter((kind) => !wanted || kind.startsWith(wanted))
      .map((kind) => ({ value: kind, note: `${kind} art` }));
  },
  run: async (ctx) => {
    if (!ctx.gallery) {
      ctx.say("This shell cannot draw pictures.");
      return;
    }
    const kind = ctx.arg.trim() || "character";
    const outcome = await ctx.gallery.open(kind);
    if (!outcome.ok) {
      ctx.say(outcome.detail);
      return;
    }
    // Silent on success: the strip appearing IS the answer, and a line saying so would push the
    // conversation up to announce something already on screen.
    if (outcome.count === 0) ctx.say(`No ${kind} in the studio carries card art yet.`);
  },
};

export default command;
