/**
 * StudioFs - the ONE seam between the studio store and a real filesystem. The store's logic
 * (containment, stamping, keep-both, atomicity EXPECTATIONS) is backend-blind; each backend folds
 * its platform's error codes into these semantics. Backends: nodeStudioFs (desktop/CLI, wraps
 * atomic-file), memoryStudioFs (tests), and the OPFS twin for the pocket build (src/studio/opfs/).
 */
import { mkdir, readdir, access, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { writeAtomicReplace, writeExclusive, StudioConflictError, StudioWriteError } from "./atomic-file";
import { StudioReadError } from "./errors";

export interface StudioFs {
  mkdirp(dir: string): Promise<void>;
  /** File names in the directory; null when the directory does not exist. */
  listDir(dir: string): Promise<string[] | null>;
  /** File text; null when the file does not exist; StudioReadError on anything else. */
  readText(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
  /** True when a file was removed, false when it was not there; StudioWriteError otherwise. */
  remove(path: string): Promise<boolean>;
  /** Create-only write: StudioConflictError when the path already exists. */
  writeExclusive(path: string, body: string): Promise<void>;
  /** Atomic replace (temp + rename or platform equivalent). */
  writeAtomicReplace(path: string, body: string): Promise<void>;
}

export const nodeStudioFs: StudioFs = {
  mkdirp: async (dir) => {
    await mkdir(dir, { recursive: true });
  },
  listDir: async (dir) => {
    try {
      return await readdir(dir);
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return null;
      throw new StudioReadError();
    }
  },
  readText: async (path) => {
    try {
      return await Bun.file(path).text();
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return null;
      throw new StudioReadError();
    }
  },
  exists: async (path) => {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  },
  remove: async (path) => {
    try {
      await unlink(path);
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return false;
      throw new StudioWriteError("could not delete entity");
    }
  },
  writeExclusive,
  writeAtomicReplace,
};

/**
 * In-memory backend for conformance tests: same semantics, zero disk. Not atomic in any real
 * sense (single-threaded map), which is exactly what a test wants.
 */
export function memoryStudioFs(): StudioFs {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const norm = (p: string): string => p.replaceAll("\\", "/");
  const parent = (p: string): string => norm(p).split("/").slice(0, -1).join("/");
  return {
    mkdirp: async (dir) => {
      dirs.add(norm(dir));
    },
    listDir: async (dir) => {
      const d = norm(dir);
      if (!dirs.has(d) && ![...files.keys()].some((f) => parent(f) === d)) return null;
      return [...files.keys()].filter((f) => parent(f) === d).map((f) => f.split("/").at(-1)!);
    },
    readText: async (path) => files.get(norm(path)) ?? null,
    exists: async (path) => files.has(norm(path)),
    remove: async (path) => files.delete(norm(path)),
    writeExclusive: async (path, body) => {
      const p = norm(path);
      if (files.has(p)) throw new StudioConflictError();
      files.set(p, body);
    },
    writeAtomicReplace: async (path, body) => {
      files.set(norm(path), body);
    },
  };
}
