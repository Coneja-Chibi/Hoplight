/** /help: list every command, read from the registry so it can never drift from what's wired. */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/help",
  aliases: ["/?"],
  summary: "list the commands",
  run: (ctx) => {
    const rows = ctx.commands
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => {
        const also = c.aliases && c.aliases.length > 0 ? ` (${c.aliases.join(", ")})` : "";
        return `- \`${c.name}${also}\` — ${c.summary}`;
      });
    ctx.say(["**Commands**", ...rows].join("\n"));
  },
};

export default command;
