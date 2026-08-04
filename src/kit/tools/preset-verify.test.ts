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
import { resolve } from "node:path";
import { grantFolder } from "./_shared/grants";

// Every real dispatch carries a bridge; the boundary check reads studioDir from it.
// Every real dispatch carries a bridge; the boundary check reads studioDir from it. Rooted at the
// repo so the engine-absent case can use a file that genuinely exists.
const ctx = { bridge: { studioDir: resolve(".") } } as unknown as ToolContext;
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
      preset: resolve("samples/sillytavern/fixtures/minimal.preset.json"),
    });
    expect(result.output).toContain("HOPLIGHT_MARINARA_ROOT");
    // The sentence a model must not be able to misread as success.
    expect(result.output).toContain("do not treat this as a pass");
    expect(result.summary).toContain("not available");
  });

  test("a missing preset is reported as missing, not as resolving cleanly", async () => {
    const result = await run({
      engine: "sillytavern",
      preset: resolve("definitely-not-here-9f3a.json"),
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

describe("the folder boundary", () => {
  const ctx = { bridge: { studioDir: resolve("/studio") } } as unknown as ToolContext;

  test("a path outside every shared folder is refused, not read", () => {
    // "Only reads" is not the same promise as "only reads what you pointed me at".
    const out = tool.execute(tool.input.parse({
      engine: "sillytavern",
      preset: resolve("/somewhere/else/secrets.json"),
    }), ctx);
    return out.then((r) => {
      expect(r.summary).toContain("outside-grants");
      expect(r.summary).not.toContain("clean");
    });
  });

  test("the studio itself is always readable", async () => {
    // Kit's own working directory; every other tool reaches it freely, so a grant would be theatre.
    const r = await tool.execute(tool.input.parse({
      engine: "sillytavern",
      preset: resolve("/studio/a.json"),
    }), ctx);
    // Refused for a missing engine or a missing file, but NOT for the boundary.
    expect(r.summary).not.toContain("outside-grants");
  });

  test("a granted folder is readable, and only that folder", async () => {
    const granted = {
      bridge: { studioDir: resolve("/studio") },
      grants: [grantFolder("/shared", "shared")],
    } as unknown as ToolContext;
    const inside = await tool.execute(tool.input.parse({
      engine: "sillytavern", preset: resolve("/shared/p.json"),
    }), granted);
    expect(inside.summary).not.toContain("outside-grants");
    // The prefix-sibling case, which is how this check is usually written wrong.
    const sibling = await tool.execute(tool.input.parse({
      engine: "sillytavern", preset: resolve("/shared-backup/p.json"),
    }), granted);
    expect(sibling.summary).toContain("outside-grants");
  });
});
