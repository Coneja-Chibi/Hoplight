/** /model: open provider setup (connect or switch a provider). Aliased /providers. */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/model",
  aliases: ["/providers"],
  summary: "connect or switch a provider",
  group: "setup",
  run: (ctx) => ctx.openSettings(),
};

export default command;
