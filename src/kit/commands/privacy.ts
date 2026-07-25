/**
 * /privacy: the egress ledger, a plain readout of what has left this machine this session (which
 * provider each send reached, and the tokens it carried). Read straight from the shell's record so it
 * can never overstate or understate what was sent. Kit sends only when you send; this is the receipt.
 */
import type { KitCommand } from "./command";

const command: KitCommand = {
  name: "/privacy",
  aliases: ["/egress"],
  summary: "show what has left this machine",
  group: "session",
  run: (ctx) => ctx.say(ctx.egressSummary()),
};

export default command;
