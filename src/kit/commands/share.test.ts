/**
 * /share and /unshare.
 *
 * These are the only way a folder outside the studio ever becomes readable, so what is pinned here
 * is mostly what they say NO to, and that they say it in a sentence a person can act on. A refusal
 * nobody can act on is the same as the feature not working.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createGrantBook } from "../tools/_shared/grant-book";
import { matchCommand, type CommandContext, type KitCommand } from "./command";
import { discoverCommands } from "./discover";
import share from "./share";
import unshare from "./unshare";

const scratch = () => mkdtemp(join(tmpdir(), "hoplight-share-cmd-"));

/** A context that records what was said, so a test can assert the words a person actually reads. */
const context = (arg: string, folders?: ReturnType<typeof createGrantBook>) => {
  const said: string[] = [];
  const ctx = {
    arg,
    commands: [],
    decks: [],
    openSettings: () => {},
    openHelp: () => {},
    quit: () => {},
    probe: () => true,
    doctor: async () => {},
    say: (text: string) => void said.push(text),
    egressSummary: () => "",
    contextPreview: () => "",
    folders,
  } as unknown as CommandContext;
  return { ctx, said };
};

const run = async (command: KitCommand, arg: string, folders?: ReturnType<typeof createGrantBook>) => {
  const { ctx, said } = context(arg, folders);
  await command.run(ctx);
  return said.join("\n");
};

describe("/share", () => {
  test("bare, with nothing shared, says so and says how", async () => {
    const output = await run(share, "", createGrantBook());
    expect(output).toContain("No folders are shared");
    expect(output).toContain("/share <folder>");
  });

  test("sharing a real folder confirms it and states the limit in the same breath", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    const output = await run(share, dir, book);
    expect(output).toContain(resolve(dir));
    // The one fact a person needs at the moment they decide.
    expect(output).toContain("cannot write");
    expect(book.list()).toHaveLength(1);
  });

  test("a path that does not exist is refused and NOT recorded", async () => {
    const book = createGrantBook();
    const output = await run(share, join(await scratch(), "nope"), book);
    expect(output).toContain("There is nothing at");
    expect(book.list()).toHaveLength(0);
  });

  test("a file is refused with the fix named", async () => {
    const dir = await scratch();
    const file = join(dir, "preset.json");
    await writeFile(file, "{}");
    const output = await run(share, file, createGrantBook());
    expect(output).toContain("Share the folder it sits in");
  });

  test("quotes are stripped, because a pasted Windows path arrives wearing them", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    await run(share, `"${dir}"`, book);
    expect(book.list()[0]?.root).toBe(resolve(dir));
  });

  test("sharing twice says already, rather than listing it twice", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    await run(share, dir, book);
    expect(await run(share, dir, book)).toContain("Already shared");
    expect(book.list()).toHaveLength(1);
  });

  test("bare, after sharing, lists what Kit can read", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    await run(share, dir, book);
    expect(await run(share, "", book)).toContain(resolve(dir));
  });

  test("with no book wired it says the feature is unavailable, not nothing", async () => {
    expect(await run(share, "/anywhere", undefined)).toContain("unavailable");
  });
});

describe("/unshare", () => {
  test("removes access", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    await run(share, dir, book);
    expect(await run(unshare, dir, book)).toContain("Stopped sharing");
    expect(book.list()).toHaveLength(0);
  });

  test("a folder that was never shared says so and points at the list", async () => {
    expect(await run(unshare, "C:/nowhere", createGrantBook())).toContain("not shared");
  });

  test("with no argument it asks for one instead of clearing everything", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    await run(share, dir, book);
    expect(await run(unshare, "", book)).toContain("Name the folder");
    // The failure this prevents: a bare /unshare silently revoking every grant.
    expect(book.list()).toHaveLength(1);
  });
});

describe("wiring", () => {
  test("both are discovered, and /folders reaches share", async () => {
    const commands = await discoverCommands();
    const names = commands.map((c) => c.name);
    expect(names).toContain("/share");
    expect(names).toContain("/unshare");
    expect(matchCommand(commands, "/folders")?.command.name).toBe("/share");
  });

  test("the argument survives a path with spaces", async () => {
    const commands = await discoverCommands();
    const matched = matchCommand(commands, "/share C:/Users/me/My Presets/Folder");
    expect(matched?.command.name).toBe("/share");
    expect(matched?.arg).toBe("C:/Users/me/My Presets/Folder");
  });
});
