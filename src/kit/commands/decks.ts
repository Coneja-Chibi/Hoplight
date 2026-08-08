/**
 * /decks: an on-demand inventory of the studio's canonical deck counts, kept out of persistent chrome.
 *
 * It also reports what is NOT counted, which is the part worth having. A real studio held 147 preset
 * files and Kit listed three of them: 122 had names an id cannot carry (a space, an apostrophe, an
 * emoji) and 22 were raw platform exports rather than canonical pieces. Every one was skipped in
 * silence, so the honest reading of "3 presets" was "3 presets", and the true one was "3 of 147".
 */
import type { KitCommand } from "./command";

/** What each reason means to somebody looking at their own folder. */
const WHY: Record<string, string> = {
  "unusable-filename": "named something an id cannot carry (spaces, punctuation, emoji)",
  "unreadable-json": "not readable as JSON",
  "schema-mismatch": "not a canonical piece (a raw export from another app, most likely)",
  "kind-mismatch": "filed under the wrong deck",
  "id-mismatch": "the id inside disagrees with the filename",
};

const command: KitCommand = {
  name: "/decks",
  aliases: ["/inventory"],
  summary: "show the studio deck counts",
  group: "session",
  run: async (ctx) => {
    const total = ctx.decks.reduce((sum, deck) => sum + deck.count, 0);
    const rows = ctx.decks.map((deck) => `- ${deck.label}: ${deck.count}`);
    const lines = [`**Studio decks · ${total} pieces**`, ...rows];

    const unlisted = (await ctx.unlisted?.()) ?? [];
    if (unlisted.length > 0) {
      const skipped = unlisted.reduce((sum, group) => sum + group.count, 0);
      lines.push("", `**${skipped} file(s) in the studio folder are not listed above**`);
      for (const group of unlisted) {
        // The examples are what make this actionable: a count alone leaves somebody guessing which
        // of their files Kit means.
        const why = WHY[group.reason] ?? group.reason;
        lines.push(`- ${group.count} ${why}`, `  e.g. ${group.examples.join(", ")}`);
      }
      lines.push("", "Import one with a shared folder and folder_import, or rename it and reload.");
    }
    ctx.say(lines.join("\n"));
  },
};

export default command;
