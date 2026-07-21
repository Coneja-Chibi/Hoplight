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

  test("both exist: the new path wins, the legacy folder is left alone", () => {
    const home = freshHome();
    mkdirSync(join(home, "Documents", "Hoplight Studio"), { recursive: true });
    mkdirSync(join(home, "Documents", "Vaude Studio"), { recursive: true });
    expect(resolveDefaultStudioDir(home)).toBe(join(home, "Documents", "Hoplight Studio"));
    expect(existsSync(join(home, "Documents", "Vaude Studio"))).toBe(true);
    rmSync(home, { recursive: true, force: true });
  });
});
