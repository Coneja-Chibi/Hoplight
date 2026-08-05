/**
 * The entry-source seam: a .lvbak ZIP, the same archive on disk, and the same archive unzipped
 * into a folder must be indistinguishable to everything downstream. Where they legitimately differ
 * (listing order, what "stored size" means) the difference is pinned here, because those are
 * exactly the two places a caller could accidentally couple to one input shape.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArchiveLimitError } from "../../core/archive";
import {
  buildMinimalLvbak,
  standardFiles,
} from "../_fixtures/lumiverse-archive/build-lvbak";
import {
  materializeLvbak,
  removeMaterialized,
} from "../_fixtures/lumiverse-archive/materialize";
import { PNG_1X1 } from "../_fixtures/lumiverse-archive/build-lvbak";
import { CHARACTER_AVATAR } from "../_fixtures/lumiverse-archive/rows";
import { ZIP_STORED, writeZip64 } from "../_fixtures/lumiverse-archive/zip64-writer";
import { LVBAK_ARCHIVE_BOUNDS } from "./bounds";
import { detectLumiverseArchive } from "./detect";
import { directoryEntrySource } from "./dir-source";
import { missingEntryError, readEntryBytes, readEntryText, type LvbakEntrySource } from "./source";
import { zipEntrySource, zipEntrySourceFromFile } from "./zip-source";

const MAX = 8 * 1024 * 1024;

const readBytes = async (source: LvbakEntrySource, name: string): Promise<Uint8Array> => {
  const reader = (await source.open(name)).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    total += step.value.byteLength;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
};

describe("zip and directory sources agree", () => {
  test("same entries and same bytes for every one of them", async () => {
    const bytes = buildMinimalLvbak();
    const root = await materializeLvbak(bytes);
    try {
      const zip = zipEntrySource(bytes);
      const dir = directoryEntrySource(root);

      const fromZip = await zip.list();
      const fromDir = await dir.list();
      expect([...fromDir].sort()).toEqual([...fromZip].sort());
      expect(fromZip.length).toBeGreaterThan(5);

      for (const name of fromZip) {
        expect([name, await readBytes(dir, name)]).toEqual([name, await readBytes(zip, name)]);
      }
    } finally {
      await removeMaterialized(root);
    }
  });

  test("detection reaches the same verdict through either source", async () => {
    const bytes = buildMinimalLvbak();
    const root = await materializeLvbak(bytes);
    try {
      const viaZip = await detectLumiverseArchive(zipEntrySource(bytes));
      const viaDir = await detectLumiverseArchive(directoryEntrySource(root));
      expect(viaDir).toEqual(viaZip);
    } finally {
      await removeMaterialized(root);
    }
  });

  test("listing ORDER differs, which is why lookups are by name", async () => {
    const bytes = buildMinimalLvbak();
    const root = await materializeLvbak(bytes);
    try {
      // the ZIP keeps producer order, so the manifest really is first
      expect((await zipEntrySource(bytes).list())[0]).toBe("manifest.json");
      // a directory has no producer order at all, so it comes back sorted
      const fromDir = await directoryEntrySource(root).list();
      expect(fromDir).toEqual([...fromDir].sort());
      expect(fromDir[0]).not.toBe("manifest.json");
    } finally {
      await removeMaterialized(root);
    }
  });

  test("stored size means compressed in a ZIP and on-disk in a directory", async () => {
    const bytes = buildMinimalLvbak();
    const root = await materializeLvbak(bytes);
    try {
      const name = "database/characters.ndjson";
      const zipSize = await zipEntrySource(bytes).size(name);
      const dirSize = await directoryEntrySource(root).size(name);
      // the NDJSON is deflated in the archive and plain on disk
      expect(zipSize).toBeLessThan(dirSize);
      expect(dirSize).toBe((await readBytes(directoryEntrySource(root), name)).byteLength);
    } finally {
      await removeMaterialized(root);
    }
  });
});

describe("path safety", () => {
  const hostile = writeZip64([
    { name: "manifest.json", data: new Uint8Array([0x7b, 0x7d]), method: ZIP_STORED },
    { name: "../escape.txt", data: new Uint8Array([1]), method: ZIP_STORED },
    { name: "database/../../escape2.txt", data: new Uint8Array([1]), method: ZIP_STORED },
    { name: "/absolute.txt", data: new Uint8Array([1]), method: ZIP_STORED },
    { name: "C:/windows.txt", data: new Uint8Array([1]), method: ZIP_STORED },
    { name: "back\\slash.txt", data: new Uint8Array([1]), method: ZIP_STORED },
    { name: "__MACOSX/database/x.ndjson", data: new Uint8Array([1]), method: ZIP_STORED },
    { name: "files/.DS_Store", data: new Uint8Array([1]), method: ZIP_STORED },
    { name: "files/._resource", data: new Uint8Array([1]), method: ZIP_STORED },
    { name: "database/characters.ndjson", data: new Uint8Array([1]), method: ZIP_STORED },
  ]);

  test("unsafe and cruft names never reach list()", async () => {
    const listed = await zipEntrySource(hostile).list();
    expect(listed).toEqual(["manifest.json", "database/characters.ndjson"]);
  });

  test("what was refused is recorded, and traversal is told apart from litter", async () => {
    const rejected = await zipEntrySource(hostile).rejected();
    const byName = new Map(rejected.map((r) => [r.name, r.reason]));
    expect(byName.get("../escape.txt")).toBe("unsafe");
    expect(byName.get("database/../../escape2.txt")).toBe("unsafe");
    expect(byName.get("/absolute.txt")).toBe("unsafe");
    expect(byName.get("C:/windows.txt")).toBe("unsafe");
    expect(byName.get("back\\slash.txt")).toBe("unsafe");
    expect(byName.get("__MACOSX/database/x.ndjson")).toBe("cruft");
    expect(byName.get("files/.DS_Store")).toBe("cruft");
    expect(byName.get("files/._resource")).toBe("cruft");
    expect(rejected).toHaveLength(8);
  });

  test("open() refuses exactly what list() refused: a rejected name is never servable through any door", async () => {
    // Before the fix, byName was built from every raw central-directory entry, not just the ones
    // classifyEntryNames kept, so open()/size() would happily hand back a traversal path list()
    // itself refuses to name. missingEntryError is the exact error dir-source's own contract raises
    // for the same case, so the two sources agree here too.
    const source = zipEntrySource(hostile);
    await expect(source.open("../escape.txt")).rejects.toEqual(missingEntryError("../escape.txt"));
    await expect(source.size("../escape.txt")).rejects.toEqual(missingEntryError("../escape.txt"));
  });

  test("a directory source never serves a symlink", async () => {
    const root = await mkdtemp(join(tmpdir(), "hoplight-lvbak-link-"));
    try {
      await writeFile(join(root, "manifest.json"), "{}");
      await symlink("/etc/passwd", join(root, "sneaky.txt"));
      const source = directoryEntrySource(root);
      expect(await source.list()).toEqual(["manifest.json"]);
      expect(await source.rejected()).toEqual([{ name: "sneaky.txt", reason: "unsafe" }]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("bounds apply to both sources", () => {
  test("a ZIP source refuses too many entries", async () => {
    const source = zipEntrySource(buildMinimalLvbak(), { ...LVBAK_ARCHIVE_BOUNDS, maxEntries: 3 });
    await expect(source.list()).rejects.toBeInstanceOf(ArchiveLimitError);
  });

  test("a directory source refuses an oversized tree and too many entries", async () => {
    const root = await materializeLvbak(buildMinimalLvbak());
    try {
      await expect(
        directoryEntrySource(root, { ...LVBAK_ARCHIVE_BOUNDS, maxArchiveBytes: 16 }).list(),
      ).rejects.toBeInstanceOf(ArchiveLimitError);
      await expect(
        directoryEntrySource(root, { ...LVBAK_ARCHIVE_BOUNDS, maxEntries: 2 }).list(),
      ).rejects.toBeInstanceOf(ArchiveLimitError);
    } finally {
      await removeMaterialized(root);
    }
  });

  test("a directory source counts bytes as they are read, not just at listing", async () => {
    const root = await materializeLvbak(buildMinimalLvbak());
    try {
      const source = directoryEntrySource(root, {
        ...LVBAK_ARCHIVE_BOUNDS,
        maxAggregateOriginal: 8,
      });
      await expect(readBytes(source, "manifest.json")).rejects.toBeInstanceOf(ArchiveLimitError);
    } finally {
      await removeMaterialized(root);
    }
  });
});

describe("readEntryBytes", () => {
  test("returns the exact bytes of a binary entry, and readEntryText decodes the same drain", async () => {
    const bytes = buildMinimalLvbak();
    const source = zipEntrySource(bytes);
    const avatar = `files/avatars/${CHARACTER_AVATAR}`;

    const drained = await readEntryBytes(source, avatar, MAX);
    expect(drained).toEqual(standardFiles()[avatar]!);
    expect(drained).toEqual(PNG_1X1);

    // readEntryText is a thin decode over the same drain, so a text entry round-trips through both
    const manifestBytes = await readEntryBytes(source, "manifest.json", MAX);
    const manifestText = await readEntryText(source, "manifest.json", MAX);
    expect(manifestText).toBe(new TextDecoder().decode(manifestBytes));
  });

  test("a ceiling breach reports as ArchiveLimitError, same as readEntryText", async () => {
    const source = zipEntrySource(buildMinimalLvbak());
    await expect(readEntryBytes(source, "manifest.json", 4)).rejects.toBeInstanceOf(
      ArchiveLimitError,
    );
  });
});

describe("zipEntrySourceFromFile", () => {
  test("reads an archive off disk and closes its handle", async () => {
    const root = await mkdtemp(join(tmpdir(), "hoplight-lvbak-file-"));
    const path = join(root, "export.lvbak");
    try {
      await writeFile(path, buildMinimalLvbak());
      const source = zipEntrySourceFromFile(path);
      try {
        expect((await source.list())[0]).toBe("manifest.json");
        const manifest = JSON.parse(await readEntryText(source, "manifest.json", MAX)) as {
          producer: string;
        };
        expect(manifest.producer).toBe("lumiverse");
        const avatar = await readBytes(source, `files/avatars/${CHARACTER_AVATAR}`);
        expect(avatar).toEqual(standardFiles()[`files/avatars/${CHARACTER_AVATAR}`]!);
        expect(avatar).toEqual(PNG_1X1);
      } finally {
        await source.close();
        await source.close(); // closing twice is not an error
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
