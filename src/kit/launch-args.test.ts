/**
 * Kit's command line, which is small enough to get wrong by eye.
 *
 * The cases that matter are the ones where a flag meets another flag: an optional value that
 * swallows the next token turns `kit -r --help` into a hunt for a session named "--help".
 */
import { describe, expect, test } from "bun:test";
import { parseLaunchArgs } from "./launch-args";

describe("parseLaunchArgs", () => {
  test("no arguments starts blank", () => {
    // The default stays blank on purpose: opening into somebody's last conversation unasked is how
    // you reply to the wrong thread.
    expect(parseLaunchArgs([])).toEqual({ resume: null, help: false, unknown: [] });
  });

  test("-r resumes the most recent", () => {
    expect(parseLaunchArgs(["-r"]).resume).toBe(true);
    expect(parseLaunchArgs(["--resume"]).resume).toBe(true);
  });

  test("a value names a session", () => {
    expect(parseLaunchArgs(["-r", "abc123"]).resume).toBe("abc123");
    expect(parseLaunchArgs(["--resume=abc123"]).resume).toBe("abc123");
  });

  test("a following flag is not eaten as a value", () => {
    // `kit -r --help` asks for help, not for a session called "--help".
    const parsed = parseLaunchArgs(["-r", "--help"]);
    expect(parsed.resume).toBe(true);
    expect(parsed.help).toBe(true);
  });

  test("an empty --resume= still means the most recent", () => {
    expect(parseLaunchArgs(["--resume="]).resume).toBe(true);
  });

  test("anything unrecognised is reported, not ignored", () => {
    // Silently dropping an argument means somebody thinks they asked for something and did not.
    expect(parseLaunchArgs(["--frobnicate", "x"]).unknown).toEqual(["--frobnicate", "x"]);
  });

  test("help wins wherever it appears", () => {
    expect(parseLaunchArgs(["-r", "abc", "--help"]).help).toBe(true);
    expect(parseLaunchArgs(["-h"]).help).toBe(true);
  });
});
