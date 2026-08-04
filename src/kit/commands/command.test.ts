/** Verifies command matching, aliases, and slash-command argument extraction. */
import { describe, expect, test } from "bun:test";
import { matchCommand, nearestCommand, type KitCommand } from "./command";

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

describe("nearestCommand", () => {
  const commands = [
    { name: "/usage", aliases: ["/plan", "/status", "/quota"], summary: "plan usage", run: () => {} },
    { name: "/help", summary: "help", run: () => {} },
    { name: "/share", summary: "share a folder", run: () => {} },
    { name: "/quit", aliases: ["/q"], summary: "leave", run: () => {} },
  ];

  test("a real alias resolves through matchCommand, not the suggester", () => {
    // /status was the actual miss: it is now an alias, so it must MATCH rather than be suggested.
    expect(matchCommand(commands, "/status")?.command.name).toBe("/usage");
    expect(matchCommand(commands, "/quota")?.command.name).toBe("/usage");
  });

  test("a prefix of a real command is suggested", () => {
    expect(nearestCommand(commands, "/us")?.name).toBe("/usage");
    expect(nearestCommand(commands, "/sh")?.name).toBe("/share");
  });

  test("one typo is suggested", () => {
    expect(nearestCommand(commands, "/usge")?.name).toBe("/usage");   // deletion
    expect(nearestCommand(commands, "/halp")?.name).toBe("/help");    // substitution
    expect(nearestCommand(commands, "/shares")?.name).toBe("/share"); // insertion
  });

  test("something genuinely unrelated suggests nothing, rather than guessing", () => {
    // Being pointed at the wrong command is worse than being pointed at the list.
    expect(nearestCommand(commands, "/xyzzy")).toBeNull();
    expect(nearestCommand(commands, "/deploy")).toBeNull();
  });

  test("an empty or bare slash suggests nothing", () => {
    expect(nearestCommand(commands, "/")).toBeNull();
    expect(nearestCommand(commands, "")).toBeNull();
  });

  test("it matches against aliases too, so a near-miss on an alias still lands", () => {
    expect(nearestCommand(commands, "/statu")?.name).toBe("/usage");
  });
});
