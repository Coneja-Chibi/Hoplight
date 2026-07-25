/** /test: ping the connected provider once and show its greeting + latency (proof of life). */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/test",
  summary: "check the connected provider is alive",
  group: "setup",
  run: (ctx) => ctx.probe(),
};

export default command;
