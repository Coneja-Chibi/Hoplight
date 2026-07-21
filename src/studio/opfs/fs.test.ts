/**
 * OPFS backend conformance over an in-memory fake of the OPFS handle surface: proves the walk,
 * not-found folding, exclusive-create, and that the SAME StudioStore lifecycle runs through it.
 * Real-browser quirks (Safari sync handles, eviction) are the pocket shell's live proof, not this.
 */
import { describe, expect, test } from "bun:test";
import { opfsSegments, opfsStudioFs, type OpfsDirectory, type OpfsFileHandle } from "./fs";
import { StudioStore } from "../store";
import { StudioConflictError } from "../atomic-file";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";

const notFound = (): Error => Object.assign(new Error("nope"), { name: "NotFoundError" });

interface Node {
  dirs: Map<string, Node>;
  files: Map<string, string>;
}
const node = (): Node => ({ dirs: new Map(), files: new Map() });

function fakeDir(n: Node): OpfsDirectory {
  return {
    async getDirectoryHandle(name, options) {
      let child = n.dirs.get(name);
      if (!child) {
        if (!options?.create) throw notFound();
        child = node();
        n.dirs.set(name, child);
      }
      return fakeDir(child);
    },
    async getFileHandle(name, options): Promise<OpfsFileHandle> {
      if (!n.files.has(name)) {
        if (!options?.create) throw notFound();
        n.files.set(name, "");
      }
      return {
        getFile: async () => ({ text: async () => n.files.get(name) ?? "" }),
        createWritable: async () => {
          let buffer = "";
          return {
            write: async (data: string) => {
              buffer += data;
            },
            close: async () => {
              n.files.set(name, buffer);
            },
          };
        },
      };
    },
    async removeEntry(name) {
      if (!n.files.delete(name) && !n.dirs.delete(name)) throw notFound();
    },
    async *keys() {
      yield* [...n.files.keys(), ...n.dirs.keys()];
    },
  };
}

const entity = (id: string, name: string): Record<string, unknown> => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "regex",
  id,
  body: { name, rules: [] },
});

describe("opfsSegments", () => {
  test("drops drive letters and blanks from both path shapes", () => {
    expect(opfsSegments("C:\\Users\\x\\studio\\lorebook\\a.json")).toEqual(["Users", "x", "studio", "lorebook", "a.json"]);
    expect(opfsSegments("/studio/lorebook/a.json")).toEqual(["studio", "lorebook", "a.json"]);
  });
});

describe("StudioStore over opfsStudioFs (fake handle tree)", () => {
  test("save, keep-both, list, read, delete run the same lifecycle", async () => {
    const io = opfsStudioFs(fakeDir(node()));
    const store = new StudioStore("studio", io);
    expect((await store.save(entity("r", "R"))).id).toBe("r");
    expect((await store.save(entity("r", "R2"))).id).toBe("r-2");
    expect((await store.list("regex")).map((e) => e.id).sort()).toEqual(["r", "r-2"]);
    expect(((await store.read("regex", "r-2"))!.body as { name: string }).name).toBe("R2");
    expect(await store.delete("regex", "r")).toBe(true);
    expect(await store.delete("regex", "r")).toBe(false);
  });

  test("writeExclusive refuses an existing file with the conflict error", async () => {
    const io = opfsStudioFs(fakeDir(node()));
    await io.writeExclusive("/studio/regex/a.json", "one");
    await expect(io.writeExclusive("/studio/regex/a.json", "two")).rejects.toBeInstanceOf(StudioConflictError);
    expect(await io.readText("/studio/regex/a.json")).toBe("one");
    expect(await io.readText("/studio/regex/missing.json")).toBeNull();
    expect(await io.listDir("/studio/ghost")).toBeNull();
  });
});
