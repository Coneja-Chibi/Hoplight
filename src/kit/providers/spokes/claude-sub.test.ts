/**
 * How the Claude subscription spoke starts its tool server.
 *
 * The risk is a silent downgrade. If the command is wrong the server never starts, the turn still
 * answers, and the only symptom is a model that appears to have chosen not to use its tools. That is
 * indistinguishable from normal behaviour, so it is pinned here rather than left to be noticed.
 */
import { describe, expect, test } from "bun:test";
import { basename } from "node:path";
import { serverCommand } from "./claude-sub";

describe("serverCommand", () => {
  test("runs this program again with the mcp subcommand", () => {
    // Never a path to a source file: a compiled binary has none, and pointing at one would fail
    // silently for anyone who installed Hoplight instead of cloning it.
    const { command, args } = serverCommand();
    expect(command).toBe(process.execPath);
    expect(args).toContain("mcp");
    // Read-only on this path: bypassPermissions turns the client prompt off and Kit's gate cannot
    // cross a process boundary, so nothing would ask before a write.
    expect(args).toContain("--read-only");
  });

  test("under a runtime it names the CLI entry, and that entry exists", async () => {
    const { args } = serverCommand();
    if (basename(process.execPath).toLowerCase().startsWith("hoplight")) {
      expect(args).toEqual(["mcp", "--read-only"]);
      return;
    }
    expect(args).toHaveLength(3);
    // A resolved path that is not on disk is the whole failure mode, so it is checked.
    expect(await Bun.file(args[0]!).exists()).toBe(true);
  });
});
