/**
 * Ask the person to pick one, as a list rather than as a sentence.
 *
 * WHY A TOOL AND NOT PROSE. Kit could always write "which one: empty-base, paramnesia-vi-rc,
 * paramnesia-vi-rc-converted", and every time it did, somebody had to read a comma-separated wall and
 * retype an exact studio id out of it - hyphens and all, from memory, having just been shown it. The
 * information was there and the ACTION was not.
 *
 * Parsing that sentence back into buttons was the obvious alternative and is a trap: a detector good
 * enough to catch most offers will turn some prose into controls and leave the rest as text, and
 * nobody can tell by looking which they are dealing with. Inconsistent affordances are worse than
 * none. So the model emits DATA, the shell renders it, and the rule stays the one it is everywhere
 * else in Kit: prose from a model is never the interaction surface.
 *
 * IT DOES NOT ANSWER FOR ANYBODY, and that is now two visible steps rather than a hidden one.
 * Clicking or pressing a number SELECTS; enter sends. Picking used to fill the composer and stop,
 * which bought the same protection invisibly and charged for it in confusion: people clicked, saw
 * their answer appear in the text box, and reported it as broken. The two steps are the protection,
 * so the answer can go straight out once it is armed - and the panel states what enter will send
 * before it goes.
 *
 * A NOTE RIDES ALONG. "Trackers, but only for the ones with art" is one thought, and it goes as one
 * message: sending the pick and the caveat separately would let the model answer the first before
 * reading the second.
 *
 * Read-only, and genuinely so: it stores nothing, reads nothing, and touches no boundary. All it does
 * is hand the shell a shape it knows how to draw.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";

const input = z.strictObject({
  question: z.string().trim().min(1).max(200)
    .describe("what you are asking, in one line"),
  options: z.array(z.strictObject({
    value: z.string().trim().min(1).max(200)
      .describe("the exact text that goes into their message when they pick this"),
    note: z.string().trim().max(200).optional()
      .describe("a short right-hand explanation: a display name, a count, a consequence"),
  })).min(2).max(12)
    .describe("at least two - offering one option is not a question"),
});

type Input = z.infer<typeof input>;

const askChoice: HarnessTool<Input> = {
  name: "ask_choice",
  description:
    "Offer the user a list to pick from instead of writing the options into a sentence. Use it "
    + "whenever you would otherwise say \"which one:\" and list ids or names. They select, then "
    + "press enter to send, and may attach a note or write their own answer instead. Their reply "
    + "arrives as an ordinary next message, so ask one question at a time and wait. Writes nothing.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: () => "ask-choice",

  async execute(args: Input) {
    return {
      summary: `ask_choice: ${args.options.length} options`,
      // The shell renders FROM THIS, never from the sentence below - the same separation `show` uses,
      // so a model cannot offer a choice by merely claiming to have offered one.
      choices: { question: args.question, options: args.options },
      // The model still gets a readable observation, because it has to know what it asked in order
      // to make sense of the answer that comes back as the next message.
      output: `Asked: ${args.question}\nOptions offered: ${args.options.map((o) => o.value).join(", ")}`
        + `\nThe list is on their screen. Wait for their reply; do not pick for them.`,
    };
  },
};

export default askChoice;
