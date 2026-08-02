/**
 * /context: what the next request carries, shown before it is sent.
 *
 * The companion to /privacy, pointing the other way in time. That command reports what already left;
 * this one reports what is about to, while there is still a chance to do something about it. The
 * parts a person did not write, the standing guidance and the tool belt, are the point: they ride on
 * every turn and were otherwise invisible.
 */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/context",
  summary: "preview what the next request will send",
  group: "session",
  run: (ctx) => ctx.say(ctx.contextPreview()),
};

export default command;
