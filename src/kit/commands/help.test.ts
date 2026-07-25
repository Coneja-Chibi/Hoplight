/** Verifies help output for the discovered Kit command catalog. */
import { test, expect } from "bun:test";
import help from "./help";
import type { CommandContext, KitCommand } from "./command";

const cmd = (name: string, group?: string): KitCommand => ({
  name,
  summary: `do ${name}`,
  group,
  run: () => {},
});

const capture = (commands: KitCommand[]): string => {
  let out = "";
  const ctx: CommandContext = {
    arg: "",
    commands,
    decks: [],
    openSettings: () => {},
    quit: () => {},
    probe: async () => {},
    doctor: async () => {},
    say: (text) => {
      out = text;
    },
    egressSummary: () => "",
  };
  help.run(ctx);
  return out;
};

test("/help groups commands into ordered sections", () => {
  const out = capture([cmd("/model", "setup"), help, cmd("/quit", "session")]);
  expect(out).toContain("**Setup**");
  expect(out).toContain("**Session**");
  expect(out).toContain("**Moving**");
  expect(out).toContain("`/model`");
  // Known groups render in order: Setup before Session before Moving.
  expect(out.indexOf("**Setup**")).toBeLessThan(out.indexOf("**Session**"));
  expect(out.indexOf("**Session**")).toBeLessThan(out.indexOf("**Moving**"));
});

test("/help files an ungrouped command under Other, last", () => {
  const out = capture([cmd("/mystery"), cmd("/model", "setup")]);
  expect(out).toContain("**Other**");
  expect(out.indexOf("**Setup**")).toBeLessThan(out.indexOf("**Other**"));
});
