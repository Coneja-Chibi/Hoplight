/**
 * The preset_verify tool.
 *
 * One risk dominates: an answer that reads as "clean" when nothing was actually checked. An absent
 * engine, an unreadable preset and a renderer that died must each be unmistakably not-a-pass, because
 * a model reading the output will otherwise report the preset as verified. That is the whole point of
 * the tool inverted.
 */
import { describe, expect, test } from "bun:test";
import { applyEngineRoots } from "../../core/preset/render/engines";
import tool from "./preset-verify";
import type { ToolContext } from "./tool";
import { resolve } from "node:path";

/**
 * The tool takes a studio ID now, so the bridge has to answer reads. `reads` records what it was
 * asked for, which is how the tests below prove no filesystem path ever leaves this tool.
 */
const reads: { kind: string; id: string }[] = [];
const bridgeWith = (found: unknown) => ({
  studioDir: resolve("."),
  read: async (kind: string, id: string) => { reads.push({ kind, id }); return found; },
});
const ctx = { bridge: bridgeWith({ kind: "preset", body: { prompts: [] } }) } as unknown as ToolContext;
const run = (args: Record<string, unknown>, context: ToolContext = ctx) =>
  tool.execute(tool.input.parse(args), context);

describe("preset_verify", () => {
  test("is read-only and directly visible, since it gates nothing and answers a common question", () => {
    expect(tool.effect).toBe("read");
    expect(tool.exposure).toBe("direct");
  });

  test("an absent engine says nothing was checked, in those words", async () => {
    // "Absent" now means no variable AND no saved folder; a root applied by another file in this
    // run would answer, and the failure would read as this tool's bug rather than as leakage.
    const before = process.env["HOPLIGHT_MARINARA_ROOT"];
    delete process.env["HOPLIGHT_MARINARA_ROOT"];
    applyEngineRoots({});
    const result = await run({
      engine: "marinara",
      preset: "minimal-preset",
    }).finally(() => {
      if (before !== undefined) process.env["HOPLIGHT_MARINARA_ROOT"] = before;
    });
    expect(result.output).toContain("HOPLIGHT_MARINARA_ROOT");
    // The sentence a model must not be able to misread as success.
    expect(result.output).toContain("do not treat this as a pass");
    expect(result.summary).toContain("not available");
  });

  test("a preset that is not in the studio is reported as missing, not as resolving cleanly", async () => {
    const absent = { bridge: bridgeWith(null) } as unknown as ToolContext;
    const result = await run({ engine: "sillytavern", preset: "not-a-real-id" }, absent);
    expect(result.summary).toContain("no such preset");
    expect(result.summary).not.toContain("clean");
  });

  test("the schema refuses an engine with no adapter", () => {
    expect(() => tool.input.parse({ engine: "lumiverse", preset: "a.json" })).toThrow();
  });

  test("state is optional and passes through as the engine's own naming", () => {
    const parsed = tool.input.parse({
      engine: "marinara",
      preset: "a.json",
      state: { pov: "third" },
    });
    expect(parsed.state).toEqual({ pov: "third" });
    expect(tool.input.parse({ engine: "marinara", preset: "a.json" }).state).toBeUndefined();
  });

  test("renders of the same engine are serialised, since each one starts a process", () => {
    const key = tool.concurrencyKey?.({ engine: "sillytavern", preset: "a.json" });
    expect(key).toBe("render/sillytavern");
    expect(tool.concurrencyKey?.({ engine: "marinara", preset: "a.json" })).not.toBe(key);
  });
});

/**
 * NO PATH REACHES THE FILESYSTEM ANY MORE.
 *
 * This tool used to take a path from the model, so it carried a containment check against the
 * folders you had shared - and those checks were the tests that lived here. The argument is a
 * studio id now, resolved through the bridge, so containment is not enforced by a check that could
 * be forgotten: there is no longer a string from the model that names a file at all.
 *
 * These tests hold that line. A path-shaped argument must be treated as a (nonexistent) id and
 * must never be opened.
 */
describe("a path is not a way in", () => {
  const seen = () => reads.map((r) => r.id);

  test("a path-shaped argument is looked up as an id and finds nothing", async () => {
    reads.length = 0;
    const absent = { bridge: bridgeWith(null) } as unknown as ToolContext;
    const result = await run({ engine: "sillytavern", preset: "/etc/passwd" }, absent);
    expect(result.summary).toContain("no such preset");
    // Asked the studio for an id, never asked the disk for a file.
    expect(seen()).toEqual(["/etc/passwd"]);
  });

  test("a traversal-shaped argument is treated the same way", async () => {
    reads.length = 0;
    const absent = { bridge: bridgeWith(null) } as unknown as ToolContext;
    const result = await run({ engine: "sillytavern", preset: "../../secrets" }, absent);
    expect(result.summary).toContain("no such preset");
    expect(reads[0]?.kind).toBe("preset");
  });

  test("it only ever reads the preset kind", async () => {
    reads.length = 0;
    const absent = { bridge: bridgeWith(null) } as unknown as ToolContext;
    await run({ engine: "sillytavern", preset: "anything" }, absent);
    expect(reads.every((r) => r.kind === "preset")).toBe(true);
  });
});
