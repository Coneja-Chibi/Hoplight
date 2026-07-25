/** /resume [name]: jump straight back into a session. With no argument it resumes the most recent OTHER
 * session; with an argument it fuzzy-matches a title and resumes it when exactly one matches. Zero or
 * ambiguous matches open the playbill so the user picks (fail-closed: never guess wrong). */
import type { KitCommand } from "../../commands/command";
import type { SessionCommandContext } from "../session-actions";

const UNAVAILABLE = "Sessions are unavailable in this build.";

const command: KitCommand = {
  name: "/resume",
  summary: "resume a recent session by name",
  run: async (ctx: SessionCommandContext) => {
    const sessions = ctx.sessions;
    if (!sessions) return ctx.say(UNAVAILABLE);
    const summaries = await sessions.list();
    const currentId = sessions.current().id;
    const others = summaries.filter((summary) => summary.id !== currentId);
    const needle = ctx.arg.trim().toLowerCase();

    if (!needle) {
      const recent = others[0];
      if (recent) return sessions.open(recent.id);
      return ctx.say("No other sessions to resume.");
    }

    const matches = others.filter((summary) => summary.displayTitle.toLowerCase().includes(needle));
    if (matches.length === 1) return sessions.open(matches[0]!.id);
    sessions.openPlaybill();
  },
};

export default command;
