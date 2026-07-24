import { describe, expect, test } from "bun:test";
import { matchCommand, type KitCommand } from "./command";

const cmds: KitCommand[] = [
  { name: "/model", aliases: ["/providers"], summary: "", run: () => {} },
  { name: "/quit", aliases: ["/q"], summary: "", run: () => {} },
];

describe("matchCommand", () => {
  test("matches by name", () => {
    expect(matchCommand(cmds, "/model")?.command.name).toBe("/model");
  });
  test("matches by alias", () => {
    expect(matchCommand(cmds, "/providers")?.command.name).toBe("/model");
  });
  test("is case-insensitive and captures the argument", () => {
    const m = matchCommand(cmds, "  /Quit now  ");
    expect(m?.command.name).toBe("/quit");
    expect(m?.arg).toBe("now");
  });
  test("plain text is not a command", () => {
    expect(matchCommand(cmds, "hello there")).toBeNull();
  });
  test("an unknown slash word is not a command", () => {
    expect(matchCommand(cmds, "/nope")).toBeNull();
  });
});
