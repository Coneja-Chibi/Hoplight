/**
 * OPFS StudioFs backend - the pocket build's disk. Satisfies the same seven primitives as
 * nodeStudioFs; the store never knows the difference. Paths arrive as resolved strings from
 * path-policy (posix-shaped in a browser bundle); they map to handle walks from the given root.
 *
 * Write strategy: createWritable (atomic on close, Chromium) when present, else the sync access
 * handle path (Safari, workers only). Both land inside a worker in the pocket build, which is the
 * one place Safari allows sync handles - see docs/POCKET-HOPLIGHT-PLAN.md P2.
 *
 * Typed against a minimal structural OPFS surface (not lib.dom's) so the file compiles under bun
 * and any TS lib set; the pocket shell casts `navigator.storage.getDirectory()` to OpfsDirectory.
 */
import { StudioConflictError, StudioWriteError } from "../atomic-file";
import { StudioReadError } from "../errors";
import type { StudioFs } from "../fs-backend";

export interface OpfsSyncAccessHandle {
  write(buffer: Uint8Array, options?: { at?: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}

export interface OpfsFileHandle {
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable?(options?: { keepExistingData?: boolean }): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
  createSyncAccessHandle?(): Promise<OpfsSyncAccessHandle>;
}

export interface OpfsDirectory {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<OpfsDirectory>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  keys(): AsyncIterableIterator<string>;
}

const isNotFound = (e: unknown): boolean =>
  e instanceof Error && (e.name === "NotFoundError" || e.name === "TypeMismatchError");

/** "C:\\a\\b.json" or "/a/b.json" -> ["a", "b.json"] (drive letters and blanks dropped). */
export function opfsSegments(path: string): string[] {
  return path
    .replaceAll("\\", "/")
    .split("/")
    .filter((s) => s.length > 0 && !/^[A-Za-z]:$/.test(s));
}

async function writeThrough(file: OpfsFileHandle, body: string): Promise<void> {
  if (file.createWritable) {
    const w = await file.createWritable({ keepExistingData: false });
    await w.write(body);
    await w.close(); // atomic publish on close
    return;
  }
  if (file.createSyncAccessHandle) {
    const h = await file.createSyncAccessHandle();
    try {
      const bytes = new TextEncoder().encode(body);
      h.truncate(0);
      h.write(bytes, { at: 0 });
      h.flush();
    } finally {
      h.close();
    }
    return;
  }
  throw new StudioWriteError("opfs: no write API available here");
}

export function opfsStudioFs(root: OpfsDirectory): StudioFs {
  const dirOf = async (segments: string[], create: boolean): Promise<OpfsDirectory | null> => {
    let dir = root;
    for (const s of segments) {
      try {
        dir = await dir.getDirectoryHandle(s, { create });
      } catch (e) {
        if (isNotFound(e)) return null;
        throw new StudioReadError();
      }
    }
    return dir;
  };
  const parentOf = async (path: string, create: boolean): Promise<{ dir: OpfsDirectory; name: string } | null> => {
    const segs = opfsSegments(path);
    const name = segs.at(-1);
    if (!name) return null;
    const dir = await dirOf(segs.slice(0, -1), create);
    return dir ? { dir, name } : null;
  };

  return {
    mkdirp: async (dir) => {
      await dirOf(opfsSegments(dir), true);
    },
    listDir: async (dir) => {
      const d = await dirOf(opfsSegments(dir), false);
      if (!d) return null;
      const names: string[] = [];
      for await (const name of d.keys()) names.push(name);
      return names;
    },
    readText: async (path) => {
      const at = await parentOf(path, false);
      if (!at) return null;
      try {
        const file = await at.dir.getFileHandle(at.name);
        return await (await file.getFile()).text();
      } catch (e) {
        if (isNotFound(e)) return null;
        throw new StudioReadError();
      }
    },
    exists: async (path) => {
      const at = await parentOf(path, false);
      if (!at) return false;
      try {
        await at.dir.getFileHandle(at.name);
        return true;
      } catch {
        return false;
      }
    },
    remove: async (path) => {
      const at = await parentOf(path, false);
      if (!at) return false;
      try {
        await at.dir.removeEntry(at.name);
        return true;
      } catch (e) {
        if (isNotFound(e)) return false;
        throw new StudioWriteError("could not delete entity");
      }
    },
    writeExclusive: async (path, body) => {
      const at = await parentOf(path, true);
      if (!at) throw new StudioWriteError();
      // single-writer worker makes check-then-create race-free in practice (plan P2 pins the
      // store to ONE dedicated worker); OPFS has no native exclusive-create to lean on
      try {
        await at.dir.getFileHandle(at.name);
        throw new StudioConflictError();
      } catch (e) {
        if (e instanceof StudioConflictError) throw e;
        /* not there: create below */
      }
      const file = await at.dir.getFileHandle(at.name, { create: true });
      await writeThrough(file, body);
    },
    writeAtomicReplace: async (path, body) => {
      const at = await parentOf(path, true);
      if (!at) throw new StudioWriteError();
      const file = await at.dir.getFileHandle(at.name, { create: true });
      await writeThrough(file, body);
    },
  };
}
