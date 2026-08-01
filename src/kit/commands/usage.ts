/**
 * /usage: how much of a connected subscription is gone, straight from the provider.
 *
 * Deliberately NOT merged with /privacy. That command is Kit's own record of what it sent, which is
 * why it can be trusted absolutely. This one repeats a figure only the provider knows, so it says
 * where each number came from and how old it is rather than presenting them as one tidy total.
 *
 * An API-key provider has no plan to report, and says so plainly instead of showing zeros.
 */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/usage",
  aliases: ["/plan"],
  summary: "how much of your subscription plan is used",
  group: "session",
  run: async (ctx) => {
    const [{ formatUsage }, { claudeUsage, codexUsage }] = await Promise.all([
      import("../providers/plan-usage"),
      import("../providers/plan-usage-sources"),
    ]);
    // Both are asked every time. Somebody signed in to both should see both, and neither answer
    // costs a turn: Codex reports from headers already in hand, Claude from a cached read.
    const outcomes = [await claudeUsage(), codexUsage()];
    ctx.say(formatUsage(outcomes, Date.now()));
  },
};

export default command;
