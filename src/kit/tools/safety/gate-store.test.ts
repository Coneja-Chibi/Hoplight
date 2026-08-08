/**
 * Remembering how often you want to be asked.
 *
 * ONE PROPERTY DOMINATES: this must never fail open. A missing, truncated, or hand-mangled file has
 * to resolve to `guarded` - the setting that asks about everything - because the alternative is a
 * damaged file quietly granting standing permission to write, delete and send.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { modeFromStored, readGateMode, SAFE_MODE, writeGateMode } from "./gate-store";

const tmp = async (): Promise<string> =>
  join(await mkdtemp(join(tmpdir(), "hoplight-gates-")), "gates.json");

describe("modeFromStored", () => {
  test("a remembered mode comes back", () => {
    for (const mode of ["guarded", "autopilot", "full"] as const) {
      expect(modeFromStored({ mode })).toBe(mode);
    }
  });

  test("EVERY malformed shape resolves to guarded", () => {
    // The list is long on purpose: this is the function that must not be clever.
    for (const junk of [null, undefined, 42, "full", [], {}, { mode: 7 }, { mode: null }, { Mode: "full" }]) {
      expect(modeFromStored(junk)).toBe(SAFE_MODE);
    }
  });

  test("a mode nothing defines is guarded, not honoured", () => {
    expect(modeFromStored({ mode: "yolo" })).toBe(SAFE_MODE);
    expect(modeFromStored({ mode: "GUARDED" })).toBe(SAFE_MODE);
  });

  test("locked is not restored", () => {
    /**
     * A panic stop is about the session somebody hit it in. Carrying it into the next launch would
     * leave Kit inert with no obvious cause and no memory of why.
     */
    expect(modeFromStored({ mode: "locked" })).toBe(SAFE_MODE);
  });
});

describe("readGateMode", () => {
  test("no file at all is guarded, and is not an error", () => {
    // The common case on a fresh install.
    return expect(readGateMode(join(tmpdir(), "definitely-absent-9f3a", "gates.json")))
      .resolves.toBe(SAFE_MODE);
  });

  test("a truncated file is guarded", async () => {
    const path = await tmp();
    await writeFile(path, '{ "mode": "fu', "utf8");
    expect(await readGateMode(path)).toBe(SAFE_MODE);
  });

  test("a file claiming full is honoured, because that is the point", async () => {
    const path = await tmp();
    await writeFile(path, JSON.stringify({ mode: "full" }), "utf8");
    expect(await readGateMode(path)).toBe("full");
  });
});

describe("writeGateMode", () => {
  test("a mode round-trips", async () => {
    const path = await tmp();
    expect(await writeGateMode("autopilot", path)).toBe(true);
    expect(await readGateMode(path)).toBe("autopilot");
  });

  test("it creates the folder it needs", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "hoplight-gates-")), "nested", "gates.json");
    expect(await writeGateMode("full", path)).toBe(true);
    expect(await readGateMode(path)).toBe("full");
  });

  test("locked is refused rather than stored", async () => {
    const path = await tmp();
    expect(await writeGateMode("locked", path)).toBe(false);
  });

  test("it reports failure instead of pretending", async () => {
    /**
     * A setting that silently fails to save is worse than one that cannot save at all: you would
     * believe the asking was turned down and learn otherwise one restart later.
     */
    const unwritable = join(tmpdir(), "hoplight-gates-file-as-dir");
    await writeFile(unwritable, "not a directory", "utf8");
    expect(await writeGateMode("full", join(unwritable, "gates.json"))).toBe(false);
  });

  test("what it writes is readable JSON, not a blob", async () => {
    // Somebody will open this file. It should explain itself.
    const path = await tmp();
    await writeGateMode("autopilot", path);
    expect(await readFile(path, "utf8")).toContain('"mode": "autopilot"');
  });
});
