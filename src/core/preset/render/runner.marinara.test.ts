/**
 * The Marinara renderer, driven through the real runner.
 *
 * Skipped without a checkout, for the same reason as the SillyTavern pair: this needs someone else's
 * application present, so CI cannot have it.
 *
 * The control here is different from SillyTavern's and better suited to this engine. Marinara's
 * choice-block macros resolve from supplied state, so feeding state and watching exactly those
 * tokens disappear proves the renderer is reading the request rather than behaving as a fixed pipe.
 * A renderer hardcoded to report a constant would pass "renders clean" and fail this.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runRenderer, type RendererCommand } from "./runner";
import { type RenderedPreset } from "./contract";

const ROOT = process.env.HOPLIGHT_MARINARA_ROOT ?? "";
const PRESET = "samples/marinara/presets/marinara-universal-preset-v12.marinara.json";

const ENGINE = join(ROOT, "packages", "shared", "src", "utils", "macro-engine.ts");

/**
 * The gate is the checkout, not the engine file inside it. A machine without the checkout is not this
 * machine; a checkout that no longer carries the engine where the adapter reads it has moved, and
 * folding that into a skip would quietly retire the proof rather than report the move.
 */
const HAVE = existsSync(ROOT);

const renderer: RendererCommand = {
  command: "bun",
  args: ["tools/renderers/marinara/render.ts", `--marinara-root=${ROOT}`],
};

const ok = (out: Awaited<ReturnType<typeof runRenderer>>): RenderedPreset => {
  if (!out.ok) throw new Error(`${out.reason}: ${out.detail}`);
  return out;
};

const tokens = (r: RenderedPreset): string[] => r.unresolved.map((u) => u.token).sort();

describe.skipIf(!HAVE)("Marinara renderer, live", () => {
  test("the engine and the sample this suite proves against are still where it reads them", () => {
    expect(existsSync(ENGINE), `${ENGINE} is missing`).toBe(true);
    expect(existsSync(PRESET), `${PRESET} is missing`).toBe(true);
  });

  test("assembles the preset and stamps the engine it ran", async () => {
    const out = ok(await runRenderer(renderer, { preset: PRESET }, { timeoutMs: 120_000 }));
    expect(out.prompt.length).toBeGreaterThan(500);
    expect(out.engine.name).toBe("marinara");
    expect(out.engine.version).toMatch(/^\d+\.\d+/);
  }, 180_000);

  test("CONTROL: supplied state resolves exactly the macros it names, and nothing else", async () => {
    const before = ok(await runRenderer(renderer, { preset: PRESET }, { timeoutMs: 120_000 }));
    const after = ok(await runRenderer(
      renderer,
      { preset: PRESET, state: { role: "a narrator", tense: "past tense", pov: "second person" } },
      { timeoutMs: 120_000 },
    ));

    // The three that were supplied are gone; every other unresolved token is untouched.
    const gone = tokens(before).filter((t) => !tokens(after).includes(t));
    expect(gone).toEqual(["{{pov}}", "{{role}}", "{{tense}}"]);
    expect(tokens(after).every((t) => tokens(before).includes(t))).toBe(true);
  }, 240_000);

  test("an undeclared checkout is refused with a reason a person can act on", async () => {
    const out = await runRenderer(
      { command: "bun", args: ["tools/renderers/marinara/render.ts", "--marinara-root=/nowhere"] },
      { preset: PRESET },
      { timeoutMs: 60_000 },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.detail).toMatch(/Marinara|declared/i);
  }, 90_000);
});
