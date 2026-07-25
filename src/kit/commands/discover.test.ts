/** Verifies command discovery across Kit's drop-in command folders. */
import { expect, test } from "bun:test";
import { discoverCommands } from "./discover";

test("production discovery includes nested session command folders exactly once", async () => {
  const names = (await discoverCommands()).map((command) => command.name);
  for (const name of ["/decks", "/session", "/resume", "/rewind", "/export"]) {
    expect(names.filter((candidate) => candidate === name)).toHaveLength(1);
  }
});
