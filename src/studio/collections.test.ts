/**
 * The collections file on disk: what it survives, and what it must never lose.
 *
 * The rules themselves are tested in collections-shape.test.ts without a filesystem. What is tested
 * here is only what the store adds - ordering, tolerance, and where the file lands.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { CollectionsStore } from "./collections";
import { addToCollection, createCollection, EMPTY_COLLECTIONS } from "./collections-shape";
import type { StudioFs } from "./fs-backend";

/** An in-memory studio. Only the four methods this store touches do anything. */
function fakeFs(seed: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(seed));
  const io: StudioFs = {
    mkdirp: async () => undefined,
    listDir: async () => null,
    readText: async (path) => files.get(path) ?? null,
    exists: async (path) => files.has(path),
    remove: async (path) => files.delete(path),
    writeExclusive: async (path, body) => { files.set(path, body); },
    writeAtomicReplace: async (path, body) => { files.set(path, body); },
    updateAtomic: async () => false,
  };
  return { io, files };
}

/** Built with the platform's own join: the store uses node:path, and Windows separates on "\". */
const FILE = join("/studio", "collections.json");

describe("CollectionsStore", () => {
  test("a studio with no collections file has no collections", () => {
    const { io } = fakeFs();
    return expect(new CollectionsStore("/studio", io).read()).resolves.toEqual(EMPTY_COLLECTIONS);
  });

  test("an edit lands in collections.json beside the decks", async () => {
    const { io, files } = fakeFs();
    const store = new CollectionsStore("/studio", io);
    await store.edit((current) => createCollection(current, "The Cast").file);
    expect(files.has(FILE)).toBe(true);
    expect(JSON.parse(files.get(FILE)!).collections[0].name).toBe("The Cast");
  });

  test("A CORRUPT FILE COSTS THE GROUPINGS, NEVER THE STUDIO", async () => {
    /**
     * The one place this differs from SettingsStore, which throws. Nothing in the studio depends on
     * collections, so refusing to open the library over a bad grouping file would take somebody's
     * whole folder down for a feature they could rebuild in a minute.
     */
    const { io } = fakeFs({ [FILE]: "{not json at all" });
    await expect(new CollectionsStore("/studio", io).read()).resolves.toEqual(EMPTY_COLLECTIONS);
  });

  test("CONCURRENT ADDS DO NOT LOSE EACH OTHER", async () => {
    /**
     * The real race and the reason edits are queued: two clicks in quick succession, or a click and
     * an agent, both read the same file and the second write drops the first piece. Without the
     * queue this test fails with one member.
     */
    const { io } = fakeFs();
    const store = new CollectionsStore("/studio", io);
    const { created } = await store.edit((c) => createCollection(c, "Cast").file)
      .then(async (file) => ({ created: file.collections[0]! }));

    await Promise.all([
      store.edit((c) => addToCollection(c, created.id, { kind: "character", id: "a" })),
      store.edit((c) => addToCollection(c, created.id, { kind: "character", id: "b" })),
      store.edit((c) => addToCollection(c, created.id, { kind: "preset", id: "c" })),
    ]);

    const got = await store.read();
    expect(got.collections[0]?.members.map((m) => m.id).sort()).toEqual(["a", "b", "c"]);
  });

  test("a failed edit does not stall every edit after it", async () => {
    // The queue chains on settle, not on success: one thrown edit must not wedge the feature until
    // the app restarts.
    const { io } = fakeFs();
    const store = new CollectionsStore("/studio", io);
    await expect(store.edit(() => { throw new Error("bad edit"); })).rejects.toThrow("bad edit");
    await store.edit((c) => createCollection(c, "Still Works").file);
    expect((await store.read()).collections[0]?.name).toBe("Still Works");
  });

  test("save normalises whatever it is handed", async () => {
    const { io } = fakeFs();
    const store = new CollectionsStore("/studio", io);
    const got = await store.save({ collections: [{ id: "x", name: "X" }, { name: "no id" }] });
    expect(got.collections).toHaveLength(1);
    expect(got.collections[0]?.members).toEqual([]);
  });
});
