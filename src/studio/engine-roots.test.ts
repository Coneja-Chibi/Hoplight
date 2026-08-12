/**
 * The saved engine folders: what a person's paste turns into, and what survives a bad file.
 *
 * This value decides which folder a subprocess is spawned against, so the parser is fail-closed per
 * key and the normalizer is written for the clipboard people actually have - Explorer's "Copy as
 * path" hands over the quotation marks, and a paste that failed over them would blame the user.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  applyEngineRoots,
  appliedEngineRoots,
  installRoot,
  RENDER_ENGINES,
} from "../core/preset/render/engines";
import {
  ENGINE_ROOTS_FILE,
  loadEngineRoots,
  normalizeRootInput,
  parseEngineRoots,
  readEngineRoots,
  saveEngineRoot,
} from "./engine-roots";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "hoplight-roots-"));
});

afterEach(async () => {
  applyEngineRoots({});
  await rm(dir, { recursive: true, force: true });
});

/** Recognisable as a checkout, nowhere near runnable - recognition is what is under test. */
async function fakeCheckout(name: string): Promise<string> {
  const root = join(dir, name);
  const marker = join(root, RENDER_ENGINES.sillytavern.marker);
  await mkdir(dirname(marker), { recursive: true });
  await writeFile(marker, "// marker\n");
  return root;
}

describe("normalizeRootInput", () => {
  test("strips the quotes Windows puts on the clipboard", () => {
    expect(normalizeRootInput('"C:\\Users\\me\\SillyTavern"')).toBe("C:\\Users\\me\\SillyTavern");
    expect(normalizeRootInput("'/home/me/SillyTavern'")).toBe("/home/me/SillyTavern");
    expect(normalizeRootInput('   "C:\\ST"   ')).toBe("C:\\ST");
  });

  test("drops a trailing separator, so one folder has one spelling", () => {
    expect(normalizeRootInput("C:\\ST\\")).toBe("C:\\ST");
    expect(normalizeRootInput("/home/me/ST/")).toBe("/home/me/ST");
  });

  test("leaves a bare root alone, since its separator is part of what it means", () => {
    expect(normalizeRootInput("C:\\")).toBe("C:\\");
    expect(normalizeRootInput("/")).toBe("/");
  });

  test("an empty or whitespace paste is nothing, not a folder called nothing", () => {
    expect(normalizeRootInput("   ")).toBe("");
    expect(normalizeRootInput('""')).toBe("");
  });
});

describe("parseEngineRoots", () => {
  test("keeps known engines with real paths and drops everything else", () => {
    expect(
      parseEngineRoots({
        sillytavern: "C:\\ST",
        marinara: 7,
        rolecall: "C:\\nope",
        lumiverse: "",
      }),
    ).toEqual({ sillytavern: "C:\\ST" });
  });

  test("anything that is not an object is no roots at all", () => {
    for (const raw of [null, "x", 7, ["C:\\ST"], undefined]) {
      expect(parseEngineRoots(raw)).toEqual({});
    }
  });
});

describe("the file in the studio folder", () => {
  test("a missing file is no roots, and neither is a corrupt one", async () => {
    expect(await readEngineRoots(dir)).toEqual({});
    await writeFile(join(dir, ENGINE_ROOTS_FILE), "{ not json");
    /**
     * Softer than SettingsStore, which throws on corruption, and deliberately: settings hold work
     * somebody did, this holds two folder names re-typed in a minute. Refusing to open the Macro
     * Lab over a truncated file would be the worse trade.
     */
    expect(await readEngineRoots(dir)).toEqual({});
  });

  test("a saved folder round-trips, normalized on the way in", async () => {
    await saveEngineRoot(dir, "sillytavern", '  "C:\\ST\\"  ');
    expect(await readEngineRoots(dir)).toEqual({ sillytavern: "C:\\ST" });
  });

  test("saving one engine leaves the other alone", async () => {
    await saveEngineRoot(dir, "sillytavern", "C:\\ST");
    await saveEngineRoot(dir, "marinara", "C:\\Marinara");
    await saveEngineRoot(dir, "sillytavern", null);
    expect(await readEngineRoots(dir)).toEqual({ marinara: "C:\\Marinara" });
  });

  test("two saves at once keep both engines, rather than the second dropping the first", async () => {
    /**
     * The read-modify-write race, which is the whole reason writes are serialized. Both calls start
     * before either has written: unserialized, each reads an empty file and the second replace
     * carries only its own engine, so pointing at SillyTavern and then at Marinara in the same
     * moment leaves one of them quietly gone.
     */
    await Promise.all([
      saveEngineRoot(dir, "sillytavern", "C:\\ST"),
      saveEngineRoot(dir, "marinara", "C:\\Marinara"),
    ]);
    expect(await readEngineRoots(dir)).toEqual({
      sillytavern: "C:\\ST",
      marinara: "C:\\Marinara",
    });
  });

  test("loading hands the folders to core, which is what makes Kit see them", async () => {
    const root = await fakeCheckout("SillyTavern");
    await saveEngineRoot(dir, "sillytavern", root);
    applyEngineRoots({});
    expect(appliedEngineRoots()).toEqual({});

    const before = process.env[RENDER_ENGINES.sillytavern.rootVar];
    delete process.env[RENDER_ENGINES.sillytavern.rootVar];
    try {
      // Nothing applied: the machine has no engine, which is the state Kit was stuck in.
      expect(await installRoot("sillytavern")).toBeNull();
      await loadEngineRoots(dir);
      expect(await installRoot("sillytavern")).toBe(root);
    } finally {
      if (before === undefined) delete process.env[RENDER_ENGINES.sillytavern.rootVar];
      else process.env[RENDER_ENGINES.sillytavern.rootVar] = before;
    }
  });

  test("a saved folder never outranks the variable this process was launched with", async () => {
    const savedRoot = await fakeCheckout("saved");
    const envRoot = await fakeCheckout("env");
    await loadEngineRoots(dir);
    await saveEngineRoot(dir, "sillytavern", savedRoot);

    const before = process.env[RENDER_ENGINES.sillytavern.rootVar];
    process.env[RENDER_ENGINES.sillytavern.rootVar] = envRoot;
    try {
      // The live render suites all set these variables. A setting that won would redirect a harness
      // that believes it named its own engine.
      expect(await installRoot("sillytavern")).toBe(envRoot);
    } finally {
      if (before === undefined) delete process.env[RENDER_ENGINES.sillytavern.rootVar];
      else process.env[RENDER_ENGINES.sillytavern.rootVar] = before;
    }
  });

  test("a variable naming no engine resolves to nothing rather than falling through", async () => {
    const savedRoot = await fakeCheckout("saved-only");
    await saveEngineRoot(dir, "sillytavern", savedRoot);

    const before = process.env[RENDER_ENGINES.sillytavern.rootVar];
    process.env[RENDER_ENGINES.sillytavern.rootVar] = join(dir, "typo");
    try {
      /**
       * Falling back to the saved folder here would paper over a typo in the variable and hand
       * somebody output from an engine they did not choose - the one thing worse than no answer.
       */
      expect(await installRoot("sillytavern")).toBeNull();
    } finally {
      if (before === undefined) delete process.env[RENDER_ENGINES.sillytavern.rootVar];
      else process.env[RENDER_ENGINES.sillytavern.rootVar] = before;
    }
  });
});
