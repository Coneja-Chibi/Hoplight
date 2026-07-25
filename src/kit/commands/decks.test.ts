/** Verifies the on-demand deck inventory readout. */
import { expect, test } from "bun:test";
import type { CommandContext } from "./command";
import decks from "./decks";

test("/decks prints the total and every canonical deck count", () => {
  let output = "";
  const ctx: CommandContext = {
    arg: "",
    commands: [decks],
    decks: [
      { label: "Characters", count: 13 },
      { label: "Lorebooks", count: 3 },
      { label: "Regex", count: 0 },
    ],
    openSettings: () => {},
    quit: () => {},
    probe: () => false,
    doctor: async () => {},
    say: (text) => {
      output = text;
    },
    egressSummary: () => "",
  };

  decks.run(ctx);

  expect(output).toContain("Studio decks · 16 pieces");
  expect(output).toContain("Characters: 13");
  expect(output).toContain("Lorebooks: 3");
  expect(output).toContain("Regex: 0");
});
