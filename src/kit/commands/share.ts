/**
 * /share: point Kit at a folder it may READ.
 *
 * The one place a folder outside the studio becomes reachable, which is why the readout says what
 * sharing does rather than only confirming it. Kit can list and open files in a shared folder and
 * cannot write to one, ever: to change something it copies the file into the studio first, where the
 * ordinary draft, review and receipt apply. Stated here because this is the moment a person decides.
 *
 * Bare /share lists what is shared, so "what can Kit see" is answerable without remembering.
 */
import type { KitCommand } from "./command";

const UNAVAILABLE = "Folder sharing is unavailable in this build.";

const HOW = "Kit reads shared folders and never writes to them. `/share <folder>` to add one, "
  + "`/unshare <folder>` to stop.";

const command: KitCommand = {
  name: "/share",
  aliases: ["/folders"],
  summary: "let Kit read a folder outside the studio",
  group: "session",
  run: async (ctx) => {
    const folders = ctx.folders;
    if (!folders) return ctx.say(UNAVAILABLE);

    const path = ctx.arg.trim().replace(/^["']|["']$/g, "");
    if (!path) {
      const shared = folders.list();
      if (shared.length === 0) return ctx.say(`No folders are shared with Kit.\n\n${HOW}`);
      const rows = shared.map((grant) => `- ${grant.root}`).join("\n");
      return ctx.say(`Kit can read:\n${rows}\n\n${HOW}`);
    }

    const outcome = await folders.share(path);
    if (!outcome.ok) return ctx.say(outcome.detail);
    if (outcome.already) return ctx.say(`Already shared: ${outcome.grant.root}`);
    ctx.say(`Sharing ${outcome.grant.root}.\n\nKit can read what is in there and cannot write to it.`);
  },
};

export default command;
