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
  test("a PARTIAL command word is still command completion, not argument", () => {
    expect(argContext([RAIL, PLAIN], "/rai")).toBeNull();
    // A FINISHED name offers its arguments without waiting for a space: a one-row popup naming the
    // command somebody just typed in full tells them nothing they did not write themselves.
    expect(argContext([RAIL, PLAIN], "/rail")?.prefix).toBe("");
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

describe("the space hands the popup from the command to its argument", () => {
  /**
   * The bug behind three separate "why is it not autocompleting" reports. `matchingCommands` trimmed
   * BOTH ends, so a trailing space - the one character that says the command word is finished - was
   * deleted before the whitespace guard could see it. The command popup stayed open, and because the
   * argument popup only opens when the command popup is closed, the argument list was unreachable
   * until a letter was typed after the space.
   */
  const rail = { name: "/rail", summary: "keep a preset's blocks open", complete: async () => [] };
  const cmds = [rail] as never;

  test("a finished name hands over even without the space", () => {
    expect(argContext(cmds, "/rail")?.prefix).toBe("");
  });

  test("a trailing space closes the command popup and opens the argument", () => {
    expect(matchingCommands(cmds, "/rail ").length).toBe(0);
    expect(argContext(cmds, "/rail ")?.prefix).toBe("");
  });

  test("typing an argument keeps the argument popup", () => {
    expect(matchingCommands(cmds, "/rail par").length).toBe(0);
    expect(argContext(cmds, "/rail par")?.prefix).toBe("par");
  });

  test("a leading space still means nothing", () => {
    expect(matchingCommands(cmds, " /rail").length).toBe(1);
  });
});

describe("a finished command name offers its arguments straight away", () => {
  /**
   * Typing `/rail` used to leave a one-row popup naming the command just typed in full, which tells
   * the reader nothing they did not write themselves. The presets only appeared after a space nobody
   * had a reason to press.
   */
  const rail = { name: "/rail", summary: "rail", complete: async () => [] };
  const model = { name: "/model", summary: "model" };
  const railway = { name: "/railway", summary: "railway", complete: async () => [] };

  test("the exact name opens its arguments with an empty prefix", () => {
    const cmds = [rail, model] as never;
    expect(argContext(cmds, "/rail")?.prefix).toBe("");
  });

  test("a partial name is still choosing between commands", () => {
    const cmds = [rail, model] as never;
    expect(argContext(cmds, "/ra")).toBeNull();
    expect(matchingCommands(cmds, "/ra").length).toBe(1);
  });

  test("a name that prefixes another keeps the command popup", () => {
    // The choice between /rail and /railway is still live, so arguments must not pre-empt it.
    const cmds = [rail, railway] as never;
    expect(argContext(cmds, "/rail")).toBeNull();
    expect(matchingCommands(cmds, "/rail").length).toBe(2);
  });

  test("a command with no completer offers nothing", () => {
    const cmds = [rail, model] as never;
    expect(argContext(cmds, "/model")).toBeNull();
  });

  test("an alias opens the same arguments", () => {
    const aliased = { name: "/rail", aliases: ["/blocks"], summary: "r", complete: async () => [] };
    expect(argContext([aliased] as never, "/blocks")?.command.name).toBe("/rail");
  });
});
