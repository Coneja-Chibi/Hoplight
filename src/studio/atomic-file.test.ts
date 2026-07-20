/** Regression coverage for the atomic-file.test behavior owned beside this file. */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeAtomicReplace, writeExclusive, StudioConflictError } from "./atomic-file";

describe("atomic-file", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vaude-atomic-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("writeExclusive creates once and conflicts on second", async () => {
    const p = join(root, "a.json");
    await writeExclusive(p, '{"ok":1}');
    expect(JSON.parse(await readFile(p, "utf8"))).toEqual({ ok: 1 });
    await expect(writeExclusive(p, '{"ok":2}')).rejects.toBeInstanceOf(StudioConflictError);
    expect(JSON.parse(await readFile(p, "utf8"))).toEqual({ ok: 1 });
  });

  test("writeAtomicReplace overwrites complete JSON", async () => {
    const p = join(root, "b.json");
    await writeExclusive(p, '{"v":1}');
    await writeAtomicReplace(p, '{"v":2}');
    expect(JSON.parse(await readFile(p, "utf8"))).toEqual({ v: 2 });
  });

  test("concurrent replaces of ONE target all land (the Windows rename share-violation race)", async () => {
    // Live repro before the rename retry: rapid settings saves hitting the same settings.json
    // intermittently threw EPERM on Windows and surfaced as 500 "could not write file".
    const p = join(root, "settings.json");
    await writeExclusive(p, '{"v":0}');
    const writers = Array.from({ length: 24 }, (_, i) => writeAtomicReplace(p, `{"v":${i + 1}}`));
    await Promise.all(writers); // no writer may reject
    const final = JSON.parse(await readFile(p, "utf8")) as { v: number };
    expect(final.v).toBeGreaterThanOrEqual(1); // one complete body won; never torn, never lost
    expect(final.v).toBeLessThanOrEqual(24);
  });
});
