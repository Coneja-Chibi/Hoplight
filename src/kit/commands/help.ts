/** /help: open the registry-driven command and keyboard reference stage. */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/help",
  aliases: ["/?"],
  summary: "open commands and keyboard help",
  group: "moving",
  run: (ctx) => ctx.openHelp(),
};

export default command;
