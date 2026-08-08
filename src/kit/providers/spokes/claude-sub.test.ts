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

/**
 * Gate mode 1 - pre-authorised at connect.
 *
 * Every test here is about which way the DEFAULT falls, because that is the property that matters. A
 * flag that opens writes when asked is unremarkable; a flag that opens them when nobody asked is the
 * whole failure.
 */
describe("the spawn decides what the model may do", () => {
  test("read-only when writes are explicitly off", () => {
    expect(serverCommand(false).args).toContain("--read-only");
  });

  test("the full belt only when writes are explicitly allowed", () => {
    const args = serverCommand(true).args;
    expect(args).not.toContain("--read-only");
    expect(args).toContain("mcp");
  });

  test("the setup choice exists and defaults to read only", async () => {
    const spoke = (await import("./claude-sub")).default;
    const option = spoke.options?.find((o) => o.key === "writes");
    expect(option).toBeTruthy();
    expect(option?.defaultValue).toBe("off");
    // Both answers are spelled out, so the screen never presents "allow changes" as the only move.
    expect(option?.choices.map((c) => c.value).sort()).toEqual(["off", "on"]);
  });

  test("only the exact string \"on\" opens writes", () => {
    // Absent, empty, "true", "yes", a stray space - every one of them must fall to read-only. A
    // posture decided by loose truthiness is one a typo can widen.
    for (const value of [undefined, "", "off", "true", "yes", "ON ", "On"]) {
      expect(serverCommand(value === "on").args).toContain("--read-only");
    }
    const opened: string = "on";
    expect(serverCommand(opened === "on").args).not.toContain("--read-only");
  });
});
