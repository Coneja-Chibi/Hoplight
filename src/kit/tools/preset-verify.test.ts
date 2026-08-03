/**
 * The preset_verify tool.
 *
 * One risk dominates: an answer that reads as "clean" when nothing was actually checked. An absent
 * engine, an unreadable preset and a renderer that died must each be unmistakably not-a-pass, because
 * a model reading the output will otherwise report the preset as verified. That is the whole point of
 * the tool inverted.
 */
import { describe, expect, test } from "bun:test";
import tool from "./preset-verify";
import type { ToolContext } from "./tool";

const ctx = {} as ToolContext;
const run = (args: Record<string, unknown>) =>
  tool.execute(tool.input.parse(args), ctx);

describe("preset_verify", () => {
  test("is read-only and directly visible, since it gates nothing and answers a common question", () => {
    expect(tool.effect).toBe("read");
    expect(tool.exposure).toBe("direct");
  });

  test("an absent engine says nothing was checked, in those words", async () => {
    const result = await run({
      engine: "marinara",
      preset: "whatever.json",
    });
    expect(result.output).toContain("HOPLIGHT_MARINARA_ROOT");
    // The sentence a model must not be able to misread as success.
    expect(result.output).toContain("do not treat this as a pass");
    expect(result.summary).toContain("not available");
  });

  test("a missing preset is reported as missing, not as resolving cleanly", async () => {
    const result = await run({
      engine: "sillytavern",
      preset: "definitely-not-here-9f3a.json",
    });
    expect(result.summary).not.toContain("clean");
  });

  test("the schema refuses an engine with no adapter", () => {
    expect(() => tool.input.parse({ engine: "lumiverse", preset: "a.json" })).toThrow();
  });

  test("state is optional and passes through as the engine's own naming", () => {
    const parsed = tool.input.parse({
      engine: "rolecall",
      preset: "a.json",
      state: { pov: "third" },
    });
    expect(parsed.state).toEqual({ pov: "third" });
    expect(tool.input.parse({ engine: "rolecall", preset: "a.json" }).state).toBeUndefined();
  });

  test("renders of the same engine are serialised, since each one starts a process", () => {
    const key = tool.concurrencyKey?.({ engine: "sillytavern", preset: "a.json" });
    expect(key).toBe("render/sillytavern");
    expect(tool.concurrencyKey?.({ engine: "marinara", preset: "a.json" })).not.toBe(key);
  });
});
