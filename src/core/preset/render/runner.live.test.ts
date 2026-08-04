/**
 * The renderer against a real SillyTavern, driven through the real runner.
 *
 * SKIPPED WITHOUT AN INSTALL, and that is the honest behaviour rather than a convenience: this needs
 * someone else's application on the machine, so CI cannot have it. The pure half of the contract is
 * covered exhaustively in contract.test.ts; this is the half that can only be proven live.
 *
 * The negative control is the point. A renderer that always answers "clean" would pass a test that
 * only ever renders a good preset, and it is exactly the failure this whole feature exists to avoid,
 * so a file KNOWN to be broken on the target has to come back dirty.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runRenderer, type RendererCommand } from "./runner";
import { unresolvedCount, type RenderedPreset } from "./contract";

const ST_ROOT = process.env.HOPLIGHT_ST_ROOT ?? "";
const PRESETS = process.env.HOPLIGHT_PRESET_CORPUS ?? "";

/**
 * Found by scanning rather than named outright. The published preset carries decorative characters in
 * its filename that this repository's prose guards refuse in source, and spelling it as escapes would
 * leave a literal nobody can read or check against the folder.
 */
const found = (needle: string): string => {
  if (!existsSync(PRESETS)) return "";
  // The regex pack sits beside the preset under a name sharing that prefix, and it sorts first.
  // Picking it would render an empty prompt with nothing unresolved, which reads as a clean pass.
  const hit = readdirSync(PRESETS)
    .find((f) => f.includes(needle) && f.endsWith(".json") && !f.includes("regex"));
  return hit ? join(PRESETS, hit) : "";
};

const CONVERTED = found("RC-converted");
const ROLECALL = join(PRESETS, "paramnesia-vi-rc.json");

/**
 * Two different states, deliberately not folded together.
 *
 * A machine without the install or without the folder is simply not this machine, and skipping is
 * honest. A folder that IS present but no longer holds what this suite reads is a rename or a move,
 * and skipping there would retire the only live proof of the renderer while the suite stayed green.
 * The first is a gate; the second is a failing test below.
 */
const HAVE_ST = existsSync(join(ST_ROOT, "public", "scripts", "macros", "macro-system.js"));
const HAVE_FOLDER = existsSync(PRESETS);

const renderer: RendererCommand = {
  command: "node",
  args: ["tools/renderers/sillytavern/render.mjs", `--st-root=${ST_ROOT}`],
};

const ok = (out: Awaited<ReturnType<typeof runRenderer>>): RenderedPreset => {
  if (!out.ok) throw new Error(`${out.reason}: ${out.detail}`);
  return out;
};

describe.skipIf(!HAVE_ST || !HAVE_FOLDER)("SillyTavern renderer, live", () => {
  test("the presets this suite proves against are still where it reads them", () => {
    expect(CONVERTED, `no converted preset found in ${PRESETS}`).not.toBe("");
    expect(existsSync(ROLECALL), `${ROLECALL} is missing`).toBe(true);
  });

  test("a converted preset renders with nothing left unresolved", async () => {
    const out = ok(await runRenderer(renderer, { preset: CONVERTED }, { timeoutMs: 120_000 }));
    expect(unresolvedCount(out)).toBe(0);
    expect(out.prompt.length).toBeGreaterThan(1000);
  }, 180_000);

  test("the reply names the engine it actually ran, so a stale answer is visible", async () => {
    // The whole reason for reading the user's install rather than shipping a copy. A version of
    // "unknown" would mean the renderer cannot say what it modelled, which the contract refuses.
    const out = ok(await runRenderer(renderer, { preset: CONVERTED }, { timeoutMs: 120_000 }));
    expect(out.engine.name).toBe("sillytavern");
    expect(out.engine.version).toMatch(/^\d+\.\d+/);
    expect(out.engine.source).toContain("SillyTavern");
  }, 180_000);

  test("NEGATIVE CONTROL: a RoleCall preset comes back dirty", async () => {
    // Without this the suite would pass on a renderer hardcoded to report zero.
    const out = ok(await runRenderer(renderer, { preset: ROLECALL }, { timeoutMs: 120_000 }));
    expect(unresolvedCount(out)).toBeGreaterThan(0);
    expect(out.unresolved.some((u) => u.token.includes("message_history"))).toBe(true);
  }, 180_000);

  test("a missing preset is a refusal, not a throw", async () => {
    const out = await runRenderer(renderer, { preset: join(PRESETS, "nope.json") }, { timeoutMs: 60_000 });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("engine-error");
  }, 90_000);

  test("an undeclared install is refused with a reason a person can act on", async () => {
    const out = await runRenderer(
      { command: "node", args: ["tools/renderers/sillytavern/render.mjs", "--st-root=/nowhere"] },
      { preset: CONVERTED },
      { timeoutMs: 60_000 },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.detail).toMatch(/SillyTavern|declared/i);
  }, 90_000);
});
