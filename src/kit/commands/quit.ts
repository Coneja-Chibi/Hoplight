/** /quit: leave Kit. Aliased /q. */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/quit",
  aliases: ["/q"],
  summary: "leave Kit",
  run: (ctx) => ctx.quit(),
};

export default command;
