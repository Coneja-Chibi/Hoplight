/**
 * What preset_verify asks for, and when it is offered at all.
 *
 * Three defects stacked into one dead turn: the description ordered the model to verify before
 * finishing ANY preset edit, the tool wanted a filesystem path in a studio addressed by id, and it
 * sat in the belt on a machine with no engine to run. Twelve steps, a comment block never written.
 *
 * These are contract tests, not behaviour tests: the engine is not installed here, and the point is
 * that a machine without one never gets this far.
 */
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { applyEngineRoots, RENDER_ENGINES } from "../../core/preset/render/engines";
import { saveEngineRoot } from "../../studio/engine-roots";
import { createBridge } from "../bridge";
import { createSession } from "../session";
import presetVerify from "./preset-verify";

const shape = presetVerify.input as unknown as {
  safeParse: (value: unknown) => { success: boolean };
  shape: Record<string, { description?: string }>;
};

describe("what it asks for", () => {
  test("a studio id is accepted", () => {
    // The same id every other tool takes, which is the whole fix.
    expect(shape.safeParse({ engine: "sillytavern", preset: "paramnesia-vi-rc" }).success).toBe(true);
  });

  test("the argument is described as an id, not a path", () => {
    /**
     * The model reads this and nothing else. "path to the preset file, in that platform's own wire
     * format" asked it for the studio location AND the on-disk filename - which for a foreign piece
     * can be a bare hash - so it guessed, and each guess cost a step.
     */
    const described = shape.shape["preset"]?.description ?? "";
    expect(described).toContain("studio id");
    expect(described).not.toContain("path to the preset file");
  });

  test("a long filesystem path no longer fits", () => {
    // Not a guarantee, a signal: the field is now sized for an id.
    const long = `C:/Users/chiev/Documents/Hoplight Studio/preset/${"x".repeat(200)}.json`;
    expect(shape.safeParse({ engine: "sillytavern", preset: long }).success).toBe(false);
  });
});

describe("when it is offered", () => {
  test("it declares that it needs an engine on this machine", () => {
    /**
     * OFFERED IS A PROMISE. Without this the belt handed the model a tool that could not work here,
     * and the only way to find out was to spend a step on it.
     */
    expect(presetVerify.available).toBeDefined();
  });

  test("with no engine configured, it takes itself out of the belt", async () => {
    const before = { st: process.env["HOPLIGHT_ST_ROOT"], mar: process.env["HOPLIGHT_MARINARA_ROOT"] };
    delete process.env["HOPLIGHT_ST_ROOT"];
    delete process.env["HOPLIGHT_MARINARA_ROOT"];
    // Clearing the variables is no longer the whole of "no engine": a saved folder applied by
    // another file in this run would answer too, and the failure would read as this tool's bug.
    applyEngineRoots({});
    try {
      expect(await presetVerify.available!()).toBe(false);
    } finally {
      if (before.st !== undefined) process.env["HOPLIGHT_ST_ROOT"] = before.st;
      if (before.mar !== undefined) process.env["HOPLIGHT_MARINARA_ROOT"] = before.mar;
    }
  });

  /**
   * ONE SETTING, TWO PROGRAMS - through Kit's own front door rather than by reading the source.
   *
   * The window's Settings screen writes engines.json into the studio folder; createSession hands it
   * to core before it asks any tool whether it can run here. Without that call this tool stays out
   * of the terminal's belt no matter what the person set in the window, which is exactly the split
   * this change exists to close - and "shared with Kit" would be a sentence written from intent.
   */
  test("a folder set in the window puts the tool in the terminal's belt", async () => {
    const before = { st: process.env["HOPLIGHT_ST_ROOT"], mar: process.env["HOPLIGHT_MARINARA_ROOT"] };
    delete process.env["HOPLIGHT_ST_ROOT"];
    delete process.env["HOPLIGHT_MARINARA_ROOT"];
    const studio = await mkdtemp(join(tmpdir(), "hoplight-kit-engines-"));
    try {
      const session = await createSession(createBridge(studio));
      expect(session.contextSnapshot?.().tools.map((t) => t.name)).not.toContain("preset_verify");

      const marker = join(studio, "SillyTavern", RENDER_ENGINES.sillytavern.marker);
      await mkdir(dirname(marker), { recursive: true });
      await writeFile(marker, "// recognisable, not runnable\n");
      // Written the way the settings route writes it, so this cannot pass against a shape the
      // window does not produce.
      await saveEngineRoot(studio, "sillytavern", join(studio, "SillyTavern"));
      applyEngineRoots({});

      const after = await createSession(createBridge(studio));
      expect(after.contextSnapshot?.().tools.map((t) => t.name)).toContain("preset_verify");
    } finally {
      applyEngineRoots({});
      await rm(studio, { recursive: true, force: true });
      if (before.st !== undefined) process.env["HOPLIGHT_ST_ROOT"] = before.st;
      if (before.mar !== undefined) process.env["HOPLIGHT_MARINARA_ROOT"] = before.mar;
    }
  }, 30_000);

  test("a root pointing at nothing is not an engine", async () => {
    // The marker check: a wrong folder must fail as loudly as a missing one.
    const before = process.env["HOPLIGHT_ST_ROOT"];
    process.env["HOPLIGHT_ST_ROOT"] = "/definitely/not/a/sillytavern/checkout";
    try {
      expect(await presetVerify.available!()).toBe(false);
    } finally {
      if (before === undefined) delete process.env["HOPLIGHT_ST_ROOT"];
      else process.env["HOPLIGHT_ST_ROOT"] = before;
    }
  });
});

describe("when it says to be used", () => {
  test("it names the cases it helps with, and the ones it does not", () => {
    /**
     * The old text was an unconditional order - "use this before claiming a preset or a conversion is
     * finished" - so a request to add an inert comment block was read as a request to verify macros.
     * A comment block has no macros to expand; it is the one edit this provably cannot speak to.
     */
    const d = presetVerify.description;
    expect(d).toContain("AFTER changing macros");
    expect(d).toContain("comment block");
    expect(d).not.toContain("before claiming a preset");
  });

  test("it says out loud that it needs an install", () => {
    expect(presetVerify.description).toContain("engine checkout");
  });
});
