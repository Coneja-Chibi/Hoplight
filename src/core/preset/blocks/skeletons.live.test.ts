/**
 * The starter blocks, against the real engine.
 *
 * THIS TEST EARNED ITSELF IMMEDIATELY. The self-validation skeleton was written with a conditional
 * form that does not exist in SillyTavern, so it left a raw getvar in the output. Every unit test
 * passed: the block belonged to a real pattern, named the right variables, and read what the options
 * wrote. Only the engine could say the syntax was wrong.
 *
 * A skeleton that is subtly wrong teaches the mistake to everyone who copies it, which is the one
 * failure a starter library must not have. So the whole set is assembled and rendered here, and a
 * skeleton that stops resolving fails the suite rather than quietly shipping.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runRenderer } from "../render/runner";
import { unresolvedCount } from "../render/contract";
import { starterBlocks } from "./skeletons";

const ST_ROOT = process.env.HOPLIGHT_ST_ROOT ?? "C:/Users/chiev/Downloads/SillyTavern";
const HAVE_ST = existsSync(join(ST_ROOT, "public", "scripts", "macros", "macro-system.js"));

describe.skipIf(!HAVE_ST)("starter blocks, live", () => {
  test("the whole starter set renders with nothing unresolved", async () => {
    const blocks = starterBlocks();
    const preset = {
      prompts: blocks.map((block) => ({
        identifier: block.identifier,
        name: block.name,
        role: block.role,
        content: block.content,
        system_prompt: true,
        marker: block.marker ?? false,
        injection_position: null,
        injection_depth: 4,
      })),
      prompt_order: [{
        character_id: 100000,
        order: blocks.map((block) => ({ identifier: block.identifier, enabled: true })),
      }],
    };
    const path = join(tmpdir(), `hoplight-starter-${process.pid}.json`);
    await Bun.write(path, JSON.stringify(preset));

    const outcome = await runRenderer(
      { command: "node", args: ["tools/renderers/sillytavern/render.mjs", `--st-root=${ST_ROOT}`] },
      { preset: path },
      { timeoutMs: 180_000 },
    );
    if (!outcome.ok) throw new Error(`${outcome.reason}: ${outcome.detail}`);
    // Naming the survivors matters more than the count: a failure here should say which skeleton.
    expect(outcome.unresolved.map((u) => u.token)).toEqual([]);
    expect(unresolvedCount(outcome)).toBe(0);
    // The assembler and the visible rules should actually produce text, or "clean" would be vacuous.
    expect(outcome.prompt.length).toBeGreaterThan(300);
  }, 240_000);
});
