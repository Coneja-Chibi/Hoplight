/**
 * StudioStore path containment + validation (temp roots only).
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { StudioValidationError } from "./errors";
import { StudioStore } from "./store";

const ent = (id: string, kind = "character") => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind,
  id,
  body: { identity: { name: id } },
});

describe("StudioStore containment", () => {
  let root: string;
  let store: StudioStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vaude-store-"));
    store = new StudioStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("save + read + list happy path", async () => {
    const s = await store.save(ent("vera"));
    expect(s.id).toBe("vera");
    const got = await store.read("character", "vera");
    expect(got?.id).toBe("vera");
    const list = await store.list("character");
    expect(list.some((e) => e.id === "vera")).toBe(true);
  });

  test("rejects path traversal kind/id without writing outside", async () => {
    const sentinel = join(root, "..", "vaude-sentinel-outside.txt");
    // place sentinel outside store root sibling
    const outside = join(tmpdir(), `vaude-outside-${Date.now()}.txt`);
    await writeFile(outside, "safe");
    await expect(store.save({ ...ent("x"), kind: "../etc" })).rejects.toBeInstanceOf(
      StudioValidationError,
    );
    await expect(store.read("character", "../escape")).rejects.toBeInstanceOf(StudioValidationError);
    await expect(store.list("../../../tmp")).rejects.toBeInstanceOf(StudioValidationError);
    const still = await Bun.file(outside).text();
    expect(still).toBe("safe");
    await rm(outside, { force: true });
    void sentinel;
  });

  test("keep-both mints sibling id", async () => {
    await store.save(ent("twin"));
    const s2 = await store.save(ent("twin"));
    expect(s2.id).toBe("twin-2");
  });

  test("path/kind mismatch throws read error", async () => {
    await mkdir(join(root, "character"), { recursive: true });
    await writeFile(
      join(root, "character", "bad.json"),
      JSON.stringify({
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "lorebook",
        id: "bad",
        body: {},
      }),
    );
    await expect(store.read("character", "bad")).rejects.toThrow();
  });

  test("overwrite preserves importedAt", async () => {
    const s1 = await store.save(ent("keep"));
    const first = s1.importedAt;
    expect(first).toBeTruthy();
    await new Promise((r) => setTimeout(r, 5));
    const s2 = await store.save(ent("keep"), { overwrite: true });
    expect(s2.importedAt).toBe(first);
    const disk = await store.read("character", "keep");
    const um = disk?.original?.["vaud-studio"]?.unmapped;
    expect(um?.["importedAt"]).toBe(first);
  });
});
