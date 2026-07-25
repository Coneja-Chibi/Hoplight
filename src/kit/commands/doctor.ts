/** /doctor: run the read-only, bounded diagnostic playbill. */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/doctor",
  aliases: ["/diagnose"],
  summary: "check the vault, provider, studio, and runtime",
  group: "setup",
  run: (context) => context.doctor(),
};

export default command;
