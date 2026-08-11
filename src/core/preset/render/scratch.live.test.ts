/**
 * Scratch resolution, against whichever real engines this machine has.
 *
 * Skipped per engine without its checkout, for the same reason as the other live suites: this needs
 * somebody else's application present, so CI cannot have it.
 *
 * WHAT THIS PROVES THAT THE UNIT TEST CANNOT. scratch.test.ts checks the wire shapes against what the
 * adapters are written to read. That is a claim about two files agreeing, not a claim about an
 * engine. Only these tests establish that a one-block preset comes back as the resolved text at all -
 * and the identity assertions are the reason the contract grew a field, so they belong where a real
 * engine answers them rather than where a fixture does.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { RENDER_ENGINES, type RenderEngineId } from "./engines";
import { resolveScratch } from "./scratch";
import type { RenderedPreset } from "./contract";

const ok = (out: Awaited<ReturnType<typeof resolveScratch>>): RenderedPreset => {
  if (!out.ok) throw new Error(`${out.reason}: ${out.detail}`);
  return out;
};

for (const engine of ["sillytavern", "marinara"] as RenderEngineId[]) {
  const root = process.env[RENDER_ENGINES[engine].rootVar] ?? "";
  const have = root !== "" && existsSync(root);

  describe.skipIf(!have)(`scratch resolution, live: ${engine}`, () => {
    const run = (
      text: string,
      extra: Partial<Parameters<typeof resolveScratch>[0]> = {},
    ): ReturnType<typeof resolveScratch> => resolveScratch({ engine, root, text, ...extra });

    test("plain text comes back as itself, stamped with the engine that answered", async () => {
      const out = ok(await run("just words, no macros"));
      expect(out.prompt).toBe("just words, no macros");
      expect(out.engine.name).toBe(engine);
      expect(out.engine.version).toMatch(/^\d+\.\d+/);
      expect(out.unresolved).toEqual([]);
    }, 90_000);

    test("a macro the engine does not have survives, and is reported unresolved", async () => {
      const out = ok(await run("before {{hoplight_no_such_macro}} after"));
      expect(out.prompt).toContain("{{hoplight_no_such_macro}}");
      expect(out.unresolved.map((u) => u.token)).toContain("{{hoplight_no_such_macro}}");
    }, 90_000);

    /**
     * THE CONTROL. A renderer hardcoded to echo its input would pass both tests above. Naming the
     * speakers and watching the answer change is what distinguishes an engine from a pipe - and it
     * is the assertion that would have caught the first attempt at this, where identity was set on
     * SillyTavern's context object and the engine went on reading a stubbed import instead.
     */
    test("CONTROL: {{char}} and {{user}} answer to the identity the caller named", async () => {
      const named = ok(await run("{{char}} and {{user}}", {
        identity: { char: "Seraphina", user: "Chi" },
      }));
      expect(named.prompt).toBe("Seraphina and Chi");

      const unnamed = ok(await run("{{char}} and {{user}}"));
      expect(unnamed.prompt).not.toBe(named.prompt);
    }, 120_000);

    test("supplied state reaches the variable macros", async () => {
      const out = ok(await run("mood is {{getvar::mood}}", { state: { mood: "curious" } }));
      expect(out.prompt).toBe("mood is curious");
    }, 90_000);

    test("an engine root that is not a checkout is refused, never rendered as clean", async () => {
      const out = await resolveScratch({ engine, root: "/nowhere-at-all", text: "x" });
      expect(out.ok).toBe(false);
    }, 90_000);
  });
}
