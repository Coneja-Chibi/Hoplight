/**
 * Backend conformance: the SAME StudioStore/SettingsStore logic must behave identically over a
 * foreign StudioFs (here: memory). This is the load-bearing claim of the pocket build - the OPFS
 * twin only has to satisfy StudioFs, never reimplement store semantics.
 */
import { describe, expect, test } from "bun:test";
import { memoryStudioFs } from "./fs-backend";
import { StudioStore } from "./store";
import { SettingsStore } from "./settings";
import { resolveStudioPath } from "./path-policy";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";

const entity = (id: string, name: string): Record<string, unknown> => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "lorebook",
  id,
  body: {
    name,
    entries: [],
    tags: [],
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    globalScanDepth: 4,
    globalRecursion: false,
    tokenBudget: 2048,
    budgetMode: "token",
    entryBudget: 10,
  },
});

describe("StudioStore over memoryStudioFs", () => {
  test("save, list, read, keep-both, overwrite, delete: full life cycle without a disk", async () => {
    const store = new StudioStore("studio", memoryStudioFs());
    const first = await store.save(entity("nyx", "Nyx"));
    expect(first.id).toBe("nyx");
    // keep-both: same id suffixes instead of clobbering
    const second = await store.save(entity("nyx", "Nyx Again"));
    expect(second.id).toBe("nyx-2");
    const listed = await store.list("lorebook");
    expect(listed.map((e) => e.id).sort()).toEqual(["nyx", "nyx-2"]);
    // overwrite path preserves the original importedAt stamp
    const stampedBefore = (await store.read("lorebook", "nyx"))!;
    const importedAt = stampedBefore.original?.["vaud-studio"]?.unmapped?.["importedAt"];
    await store.save({ ...entity("nyx", "Nyx Edited") }, { overwrite: true });
    const after = (await store.read("lorebook", "nyx"))!;
    expect((after.body as { name: string }).name).toBe("Nyx Edited");
    expect(after.original?.["vaud-studio"]?.unmapped?.["importedAt"]).toBe(importedAt);
    expect(await store.delete("lorebook", "nyx-2")).toBe(true);
    expect(await store.delete("lorebook", "nyx-2")).toBe(false);
    expect((await store.list("lorebook")).map((e) => e.id)).toEqual(["nyx"]);
  });

  test("read of a missing entity is null, corrupt json throws, both backend-blind", async () => {
    const io = memoryStudioFs();
    const store = new StudioStore("studio", io);
    expect(await store.read("lorebook", "ghost")).toBeNull();
    await io.writeAtomicReplace(resolveStudioPath("studio", "lorebook", "bad"), "{not json");
    await expect(store.read("lorebook", "bad")).rejects.toThrow("corrupt entity file");
  });
});

describe("SettingsStore over memoryStudioFs", () => {
  test("defaults when missing; save then patch round-trips", async () => {
    const store = new SettingsStore("studio", memoryStudioFs());
    const defaults = await store.read();
    expect(typeof defaults).toBe("object");
    await store.save({ ...defaults, setupComplete: true });
    const patched = await store.update({ houseAccent: "#8b5cf6" });
    expect(patched.setupComplete).toBe(true);
    expect(patched.houseAccent).toBe("#8b5cf6");
    expect((await store.read()).houseAccent).toBe("#8b5cf6");
  });
});
