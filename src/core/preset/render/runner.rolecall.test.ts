/**
 * The RoleCall renderer, driven through the real runner.
 *
 * Skipped without a checkout, for the same reason as the other two: this needs an application that
 * cannot live in CI.
 *
 * SCOPE, STATED SO A PASS IS NOT READ AS MORE THAN IT IS. These tests prove RoleCall's MACRO LAYER
 * resolves a preset. They do not prove RoleCall's prompt assembly, which is bound to a database and
 * is reproduced by the adapter rather than run. A clean result here means the macros resolved, not
 * that the application built this prompt.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRenderer, type RendererCommand } from "./runner";
import { unresolvedCount, type RenderedPreset } from "./contract";

const ROOT = process.env.HOPLIGHT_ROLECALL_ROOT ?? "";
const PRESETS = process.env.HOPLIGHT_PRESET_CORPUS ?? "";
const MASTER = join(PRESETS, "paramnesia-vi-rc.json");
const BUILDER = join(ROOT, "src", "lib", "macros", "prompt-builder.ts");

/** The checkout gates; a checkout missing the engine is a move, and fails below rather than skipping. */
const HAVE = existsSync(ROOT) && existsSync(MASTER);

const renderer: RendererCommand = {
  command: "bun",
  args: ["tools/renderers/rolecall/render.ts", `--rolecall-root=${ROOT}`],
};

const ok = (out: Awaited<ReturnType<typeof runRenderer>>): RenderedPreset => {
  if (!out.ok) throw new Error(`${out.reason}: ${out.detail}`);
  return out;
};

/**
 * A preset built to fail, written fresh so it cannot drift out from under the assertion. Two macros
 * RoleCall genuinely does not register, beside two it does, so a renderer that simply lists every
 * `{{...}}` it sees fails this as loudly as one that reports nothing.
 */
function dirtyPreset(): string {
  const dir = mkdtempSync(join(tmpdir(), "hoplight-rc-"));
  const path = join(dir, "dirty.json");
  writeFileSync(path, JSON.stringify({
    name: "dirty",
    prompts: [{
      identifier: "a",
      name: "a",
      content: "Known: {{char}} and {{user}}. Unknown: {{definitely_not_a_rolecall_macro}} and {{another_invented_one::x}}.",
    }],
  }));
  return path;
}

describe.skipIf(!HAVE)("RoleCall renderer, live", () => {
  test("the engine and the preset this suite proves against are still where it reads them", () => {
    expect(existsSync(BUILDER), `${BUILDER} is missing`).toBe(true);
    expect(existsSync(MASTER), `${MASTER} is missing`).toBe(true);
  });

  test("the RoleCall master resolves through RoleCall's own macro layer", async () => {
    const out = ok(await runRenderer(renderer, { preset: MASTER }, { timeoutMs: 180_000 }));
    expect(unresolvedCount(out)).toBe(0);
    expect(out.prompt.length).toBeGreaterThan(1000);
    expect(out.engine.name).toBe("rolecall");
    expect(out.engine.version).toMatch(/^\d+\.\d+/);
  }, 240_000);

  test("NEGATIVE CONTROL: macros RoleCall does not register come back, and only those", async () => {
    const out = ok(await runRenderer(renderer, { preset: dirtyPreset() }, { timeoutMs: 120_000 }));
    const tokens = out.unresolved.map((u) => u.token).sort();
    expect(tokens).toEqual(["{{another_invented_one::x}}", "{{definitely_not_a_rolecall_macro}}"]);
    // The registered pair resolved rather than being swept in with them.
    expect(out.prompt).toContain("Known: Character and User.");
  }, 180_000);

  test("CONTROL: a choice selection changes the prompt that gets assembled", async () => {
    // Stronger than a token-count delta: this proves the adapter is running RoleCall's own gating,
    // so a different selection produces different TEXT, not merely different resolution.
    const base = ok(await runRenderer(renderer, { preset: MASTER }, { timeoutMs: 180_000 }));
    const other = ok(await runRenderer(
      renderer,
      { preset: MASTER, state: { operator: "theo" } },
      { timeoutMs: 180_000 },
    ));
    expect(other.prompt).not.toBe(base.prompt);
    expect(unresolvedCount(other)).toBe(0);
  }, 300_000);

  test("a token the application's assembly fills is named, not counted as unresolved", async () => {
    // {{message_history}} is not a registered macro and is substituted during assembly, which this
    // renderer does not run. Counting it would report a defect in a preset that works.
    const out = ok(await runRenderer(renderer, { preset: MASTER }, { timeoutMs: 180_000 }));
    expect(out.unresolved.some((u) => u.token.includes("message_history"))).toBe(false);
    expect(out.warnings.some((w) => w.includes("message_history"))).toBe(true);
  }, 240_000);

  test("an undeclared checkout is refused with a reason a person can act on", async () => {
    const out = await runRenderer(
      { command: "bun", args: ["tools/renderers/rolecall/render.ts", "--rolecall-root=/nowhere"] },
      { preset: MASTER },
      { timeoutMs: 60_000 },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.detail).toMatch(/RoleCall|declared/i);
  }, 90_000);
});
