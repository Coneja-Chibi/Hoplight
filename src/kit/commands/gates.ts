/**
 * /gates: how often Kit asks before it writes.
 *
 * The modes have existed since the gate was built, the labels below are the ones already written in
 * permission-mode.ts, and a comment in that file has referred to "the /gates screen" the whole time.
 * There was no way to reach any of it, so the answer to "stop asking me twice" was that you could
 * not. This is the door.
 *
 * The danger floor is not a mode and is not offered here: an unknown or executing call confirms in
 * every setting, which is exactly what makes turning the rest down safe rather than reckless.
 */
import type { KitCommand } from "./command";
import { GATE_MODES, MODE_HINT, MODE_LABEL } from "../tools/safety/permission-mode";

const command: KitCommand = {
  name: "/gates",
  aliases: ["/ask", "/permissions"],
  summary: "how often Kit asks before writing",
  group: "setup",
  complete: async (prefix) => {
    const wanted = prefix.trim().toLowerCase();
    return GATE_MODES
      .filter((mode) => !wanted || mode.startsWith(wanted))
      .map((mode) => ({ value: mode, note: `${MODE_LABEL[mode]} - ${MODE_HINT[mode]}` }));
  },
  run: (ctx) => {
    if (!ctx.gates) {
      ctx.say("This shell has no gate to set.");
      return;
    }
    const asked = ctx.arg.trim().toLowerCase();
    if (!asked) {
      const current = ctx.gates.mode();
      const rows = GATE_MODES.map((mode) =>
        `- ${mode === current ? "**" : ""}${mode}${mode === current ? "** (now)" : ""}`
        + `: ${MODE_LABEL[mode]} - ${MODE_HINT[mode]}`);
      ctx.say([`**Asking before writes · ${MODE_LABEL[current]}**`, ...rows, "", "Set one with /gates <mode>."].join("\n"));
      return;
    }
    const picked = GATE_MODES.find((mode) => mode === asked) as "guarded" | "autopilot" | "full" | undefined;
    if (!picked) {
      // Named rather than "invalid": the three words are the whole vocabulary and listing them is
      // shorter than explaining the mistake.
      ctx.say(`Not a mode. Pick one of: ${GATE_MODES.join(", ")}.`);
      return;
    }
    ctx.gates.set(picked);
    // Says it is remembered, because the whole complaint was having to set this every launch.
    ctx.say(`**${MODE_LABEL[picked]}** - ${MODE_HINT[picked]}. Remembered for next time; the danger `
      + "floor still asks, in every mode.");
  },
};

export default command;
