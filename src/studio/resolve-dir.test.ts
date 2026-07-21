/** The rename-aware default studio dir: move the legacy folder once, never lose it. */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveDefaultStudioDir } from "./resolve-dir";

const freshHome = (): string => mkdtempSync(join(tmpdir(), "hoplight-home-"));

describe("resolveDefaultStudioDir", () => {
  test("no folders at all: the new path, nothing created", () => {
    const home = freshHome();
    expect(resolveDefaultStudioDir(home)).toBe(join(home, "Documents", "Hoplight Studio"));
    expect(existsSync(join(home, "Documents", "Hoplight Studio"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  test("legacy Vaude Studio is renamed to Hoplight Studio, contents intact", () => {
    const home = freshHome();
    const legacy = join(home, "Documents", "Vaude Studio");
    mkdirSync(join(legacy, "character"), { recursive: true });
    writeFileSync(join(legacy, "character", "vera.json"), "{}");
    const dir = resolveDefaultStudioDir(home);
    expect(dir).toBe(join(home, "Documents", "Hoplight Studio"));
    expect(existsSync(join(dir, "character", "vera.json"))).toBe(true);
    expect(existsSync(legacy)).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  test("both exist but the new home is EMPTY: the legacy library moves in kind by kind", () => {
    const home = freshHome();
    const fresh = join(home, "Documents", "Hoplight Studio");
    const legacy = join(home, "Documents", "Vaude Studio");
    mkdirSync(fresh, { recursive: true });
    writeFileSync(join(fresh, "settings.json"), '{"setupComplete":true}');
    mkdirSync(join(legacy, "character"), { recursive: true });
    writeFileSync(join(legacy, "character", "vera.json"), "{}");
    expect(resolveDefaultStudioDir(home)).toBe(fresh);
    expect(existsSync(join(fresh, "character", "vera.json"))).toBe(true);
    // the fresh settings (the user's newest answers) survive the adoption
    expect(existsSync(join(fresh, "settings.json"))).toBe(true);
    rmSync(home, { recursive: true, force: true });
  });

  test("both exist with content in both: the new home wins untouched", () => {
    const home = freshHome();
    const fresh = join(home, "Documents", "Hoplight Studio");
    const legacy = join(home, "Documents", "Vaude Studio");
    mkdirSync(join(fresh, "character"), { recursive: true });
    writeFileSync(join(fresh, "character", "new.json"), "{}");
    mkdirSync(join(legacy, "character"), { recursive: true });
    writeFileSync(join(legacy, "character", "old.json"), "{}");
    expect(resolveDefaultStudioDir(home)).toBe(fresh);
    expect(existsSync(join(legacy, "character", "old.json"))).toBe(true);
    expect(existsSync(join(fresh, "character", "old.json"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });
});
