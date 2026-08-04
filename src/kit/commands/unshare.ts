/**
 * /unshare: stop Kit reading a folder.
 *
 * Separate from /share rather than a flag on it, because a path is a free-form argument and any
 * in-band verb ("/share remove C:\...") is ambiguous against a folder actually named that. Removing
 * access should never depend on parsing a word out of a path.
 */
import type { KitCommand } from "./command";

const UNAVAILABLE = "Folder sharing is unavailable in this build.";

const command: KitCommand = {
  name: "/unshare",
  summary: "stop Kit reading a shared folder",
  group: "session",
  run: (ctx) => {
    const folders = ctx.folders;
    if (!folders) return ctx.say(UNAVAILABLE);

    const path = ctx.arg.trim().replace(/^["']|["']$/g, "");
    if (!path) return ctx.say("Name the folder to stop sharing, or run `/share` to see the list.");
    if (!folders.revoke(path)) return ctx.say(`${path} was not shared. Run \`/share\` to see the list.`);
    ctx.say(`Stopped sharing ${path}.`);
  },
};

export default command;
