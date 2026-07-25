/**
 * /decks: an on-demand inventory of the studio's canonical deck counts, kept out of persistent chrome.
 */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/decks",
  aliases: ["/inventory"],
  summary: "show the studio deck counts",
  group: "session",
  run: (ctx) => {
    const total = ctx.decks.reduce((sum, deck) => sum + deck.count, 0);
    const rows = ctx.decks.map((deck) => `- ${deck.label}: ${deck.count}`);
    ctx.say([`**Studio decks · ${total} pieces**`, ...rows].join("\n"));
  },
};

export default command;
