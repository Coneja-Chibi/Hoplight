/**
 * The directory entry source: a .lvbak the user already unzipped. Users do this constantly, and
 * the real export inspected while drafting the spec arrived as a folder, so a directory is a
 * first-class input rather than a fallback.
 *
 * Bounds are enforced here too, because "detection, bounds, and per-row behavior are identical for
 * both inputs" (spec edge case 1) has to be true of the hostile cases as well: entry count and
 * total size are checked while walking, and decompressed bytes are counted as they are read.
 *
 * Directory order carries no meaning, unlike a ZIP where the producer wrote manifest.json first,
 * so names come back sorted and callers must find the manifest by NAME.
 */
import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { ArchiveLimitError, type UnzipBounds } from "../../core/archive";
import type { AggregateBudget } from "../../core/archive-stream";
import { LVBAK_ARCHIVE_BOUNDS } from "./bounds";
import {
  classifyEntryNames,
  missingEntryError,
  newAggregateBudget,
  type LvbakEntrySource,
  type RejectedEntry,
} from "./source";

const READ_CHUNK = 64 * 1024;

interface Listing {
  order: string[];
  rejected: RejectedEntry[];
  sizes: Map<string, number>;
}

/**
 * Walk the tree depth first, sorted, collecting POSIX-relative names. Symlinks are never followed
 * and never served: in an extracted archive a link is the traversal the path filter exists to stop.
 */
async function walk(
  root: string,
  relative: string,
  found: Map<string, number>,
  links: string[],
  bounds: UnzipBounds,
): Promise<void> {
  const here = relative === "" ? root : join(root, relative);
  const entries = await readdir(here, { withFileTypes: true });
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const name = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      links.push(name);
      continue;
    }
    if (entry.isDirectory()) {
      await walk(root, name, found, links, bounds);
      continue;
    }
    if (!entry.isFile()) continue;
    found.set(name, (await stat(join(root, name))).size);
    if (found.size > bounds.maxEntries) {
      throw new ArchiveLimitError("archive has too many entries");
    }
  }
}

/** A pre-extracted .lvbak directory. */
export function directoryEntrySource(
  rootDir: string,
  bounds: UnzipBounds = LVBAK_ARCHIVE_BOUNDS,
): LvbakEntrySource {
  let listing: Promise<Listing> | null = null;
  const aggregate = newAggregateBudget(bounds);

  const load = (): Promise<Listing> => {
    listing ??= (async () => {
      const found = new Map<string, number>();
      const links: string[] = [];
      await walk(rootDir, "", found, links, bounds);

      let total = 0;
      for (const size of found.values()) total += size;
      if (total > bounds.maxArchiveBytes) {
        throw new ArchiveLimitError("archive exceeds safety limits");
      }

      const { keep, rejected } = classifyEntryNames([...found.keys()]);
      return {
        order: keep,
        rejected: [...rejected, ...links.map((name): RejectedEntry => ({ name, reason: "unsafe" }))],
        sizes: found,
      };
    })();
    return listing;
  };

  const sizeOf = async (name: string): Promise<number> => {
    const found = (await load()).sizes.get(name);
    if (found === undefined) throw missingEntryError(name);
    return found;
  };

  return {
    async list() {
      return (await load()).order;
    },
    async rejected() {
      return (await load()).rejected;
    },
    size: sizeOf,
    async open(name) {
      const declared = await sizeOf(name);
      if (declared > bounds.maxEntryOriginal) {
        throw new ArchiveLimitError("archive entry exceeds safety limits");
      }
      if (aggregate.used + declared > aggregate.max) {
        throw new ArchiveLimitError("archive aggregate size exceeds safety limits");
      }
      return fileStream(join(rootDir, ...name.split("/")), bounds, aggregate);
    },
  };
}

/** Stream one file, counting every byte against the same budgets the ZIP path uses. */
async function fileStream(
  path: string,
  bounds: UnzipBounds,
  aggregate: AggregateBudget,
): Promise<ReadableStream<Uint8Array>> {
  const handle = await open(path, "r");
  let offset = 0;
  let produced = 0;

  const account = (bytes: number): void => {
    produced += bytes;
    if (produced > bounds.maxEntryOriginal) {
      throw new ArchiveLimitError("archive entry exceeds safety limits");
    }
    aggregate.used += bytes;
    if (aggregate.used > aggregate.max) {
      throw new ArchiveLimitError("archive aggregate size exceeds safety limits");
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const buffer = new Uint8Array(READ_CHUNK);
      const { bytesRead } = await handle.read(buffer, 0, READ_CHUNK, offset);
      if (bytesRead === 0) {
        await handle.close();
        controller.close();
        return;
      }
      offset += bytesRead;
      try {
        account(bytesRead);
      } catch (error) {
        await handle.close();
        throw error;
      }
      controller.enqueue(buffer.subarray(0, bytesRead));
    },
    async cancel() {
      await handle.close();
    },
  });
}
