/** Verifies the slash palette is registry-driven, filterable, and deterministic. */
import { describe, expect, test } from "bun:test";
import type { KitCommand } from "../../../commands/command";
import { applyArg, argContext, matchingArgs, matchingCommands } from "./command-menu-core";

const command = (name: string, summary: string, aliases?: string[]): KitCommand => ({
  name,
  summary,
  aliases,
  run: () => {},
});

test("a bare slash lists every command alphabetically", () => {
  const commands = [
    command("/test", "check provider"),
    command("/model", "connect provider", ["/providers"]),
  ];
  expect(matchingCommands(commands, "/").map((item) => item.name)).toEqual(["/model", "/test"]);
});

test("typing filters names, aliases, and summaries; arguments close the palette", () => {
  const commands = [
    command("/model", "connect provider", ["/providers"]),
    command("/privacy", "show machine egress"),
  ];
  expect(matchingCommands(commands, "/mod").map((item) => item.name)).toEqual(["/model"]);
  expect(matchingCommands(commands, "/prov").map((item) => item.name)).toEqual(["/model"]);
  expect(matchingCommands(commands, "/machine").map((item) => item.name)).toEqual(["/privacy"]);
  expect(matchingCommands(commands, "/model local")).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// Argument completion. The popup used to complete the command word and stop, so `/rail empty-base`
// had to be typed exactly, from memory, at the point in the sentence where a person is least likely
// to remember an id and most likely to typo it.
// ---------------------------------------------------------------------------------------------

const RAIL: KitCommand = {
  name: "/rail",
  aliases: ["/blocks"],
  summary: "keep a preset's blocks open",
  complete: async () => [
    { value: "paramnesia-vi-rc", note: "Paramnesia VI" },
    { value: "empty-base", note: "Empty Base" },
    { value: "off", note: "close the rail" },
  ],
  run: () => {},
};
const PLAIN: KitCommand = { name: "/quit", summary: "leave", run: () => {} };

describe("argContext", () => {
  test("a command word with no space yet is still command completion, not argument", () => {
    expect(argContext([RAIL, PLAIN], "/rai")).toBeNull();
    expect(argContext([RAIL, PLAIN], "/rail")).toBeNull();
  });

  test("the first space switches to completing the argument", () => {
    expect(argContext([RAIL, PLAIN], "/rail ")?.command.name).toBe("/rail");
    expect(argContext([RAIL, PLAIN], "/rail emp")?.prefix).toBe("emp");
  });

  test("an alias resolves to the same command", () => {
    expect(argContext([RAIL, PLAIN], "/blocks emp")?.command.name).toBe("/rail");
  });

  test("a command with no completer offers nothing rather than an empty popup", () => {
    expect(argContext([RAIL, PLAIN], "/quit now")).toBeNull();
  });

  test("only the FIRST space splits, so a value containing spaces survives", () => {
    // Splitting on every space would truncate the prefix and stop matching halfway through a name.
    expect(argContext([RAIL, PLAIN], "/rail My Folder Name")?.prefix).toBe("My Folder Name");
  });
});

describe("matchingArgs", () => {
  const CANDIDATES = [
    { value: "paramnesia-vi-rc", note: "Paramnesia VI" },
    { value: "empty-base", note: "Empty Base" },
    { value: "off", note: "close the rail" },
  ];

  test("an empty prefix offers everything", () => {
    expect(matchingArgs(CANDIDATES, "")).toHaveLength(3);
  });

  test("a prefix match ranks above a contained one", () => {
    // Typing "e" must put empty-base first, not paramnesia (which merely contains an e).
    expect(matchingArgs(CANDIDATES, "e")[0]?.value).toBe("empty-base");
  });

  test("case does not matter, because nobody types an id in lowercase mid-thought", () => {
    expect(matchingArgs(CANDIDATES, "PARAM")[0]?.value).toBe("paramnesia-vi-rc");
  });

  test("the display name matches too, since that is the word a person remembers", () => {
    // "Paramnesia VI" is what is on the shelf; paramnesia-vi-rc is what is on disk.
    expect(matchingArgs(CANDIDATES, "Paramnesia V").map((c) => c.value)).toContain("paramnesia-vi-rc");
  });

  test("no match is an empty list, never a wrong guess", () => {
    expect(matchingArgs(CANDIDATES, "zzzz")).toEqual([]);
  });
});

describe("applyArg", () => {
  test("replaces the argument and keeps the command word", () => {
    expect(applyArg("/rail emp", "empty-base")).toBe("/rail empty-base");
  });

  test("appends when there is no argument yet", () => {
    expect(applyArg("/rail", "empty-base")).toBe("/rail empty-base");
  });
});
