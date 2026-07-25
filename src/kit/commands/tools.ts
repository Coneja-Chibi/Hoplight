/**
 * /tools: open the human capability browser without exposing more tools to the model.
 */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/tools",
  summary: "browse what Kit can do to each piece",
  group: "moving",
  run: (ctx) => ctx.openTools?.(),
};

export default command;
