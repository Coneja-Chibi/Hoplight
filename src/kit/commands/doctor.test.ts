/** Verifies /doctor delegates to the shell's diagnostic runner. */
import { expect, test } from "bun:test";
import type { CommandContext } from "./command";
import doctor from "./doctor";

test("/doctor runs the diagnostic playbill", async () => {
  let runs = 0;
  const ctx = {
    arg: "",
    commands: [doctor],
    decks: [],
    openSettings: () => {},
    quit: () => {},
    probe: () => false,
    doctor: async () => {
      runs += 1;
    },
    say: () => {},
    egressSummary: () => "",
  } satisfies CommandContext;

  await doctor.run(ctx);
  expect(runs).toBe(1);
});
