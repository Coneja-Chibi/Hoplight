/** Verifies /help opens the reference stage. */
import { expect, test } from "bun:test";
import help from "./help";
import type { CommandContext } from "./command";

test("/help opens the reference stage", () => {
  let opened = false;
  const ctx: CommandContext = {
    arg: "",
    commands: [help],
    decks: [],
    openSettings: () => {},
    openHelp: () => {
      opened = true;
    },
    quit: () => {},
    probe: async () => {},
    doctor: async () => {},
    say: () => {},
    egressSummary: () => "",
    contextPreview: () => "",
  };
  help.run(ctx);
  expect(opened).toBe(true);
});
