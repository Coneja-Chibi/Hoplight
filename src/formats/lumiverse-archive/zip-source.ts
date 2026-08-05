/**
 * The ZIP entry source: a .lvbak file, read through core's streaming bounded reader so a 5 GiB
 * archive never has to be materialized. Two constructors share one implementation, one over bytes
 * already in memory and one over a file on disk.
 *
 * The whole archive shares a single aggregate decompressed budget, which is the point: per-entry
 * ceilings alone would let an archive smuggle a bomb past by splitting it across entries.
 *
 * node:fs is reached through a dynamic import so this module stays free of a static node import
 * and the folder's barrel can be pulled into any runtime.
 */
import type { UnzipBounds } from "../../core/archive";
import {
  bytesSource,
  listZipEntriesBounded,
  openZipEntryStream,
  type RandomAccessSource,
  type ZipEntry,
} from "../../core/archive-stream";
import { LVBAK_ARCHIVE_BOUNDS } from "./bounds";
import {
  classifyEntryNames,
  missingEntryError,
  newAggregateBudget,
  type LvbakEntrySource,
  type RejectedEntry,
} from "./source";

type FileHandle = Awaited<ReturnType<typeof import("node:fs/promises").open>>;

interface Listing {
  order: string[];
  rejected: RejectedEntry[];
  byName: Map<string, ZipEntry>;
}

/** Lazily list once, then serve every question from that listing. */
function zipSourceOver(random: RandomAccessSource, bounds: UnzipBounds): LvbakEntrySource {
  let listing: Promise<Listing> | null = null;

  const load = (): Promise<Listing> => {
    listing ??= (async () => {
      const entries = await listZipEntriesBounded(random, bounds);
      const { keep, rejected } = classifyEntryNames(entries.map((e) => e.name));
      const keepSet = new Set(keep);
      const byName = new Map<string, ZipEntry>();
      // First occurrence wins. A duplicate name is a shadowing trick, and the entry a reader saw
      // first is the one it should keep answering with. Entries list() refused are excluded here
      // too: open()/size() must refuse exactly what list() refused, matching directoryEntrySource's
      // own contract (a rejected path never becomes a servable entry through any door).
      for (const entry of entries) {
        if (!keepSet.has(entry.name)) continue;
        if (!byName.has(entry.name)) byName.set(entry.name, entry);
      }
      return { order: keep, rejected, byName };
    })();
    return listing;
  };

  const aggregate = newAggregateBudget(bounds);

  const entryFor = async (name: string): Promise<ZipEntry> => {
    const found = (await load()).byName.get(name);
    if (!found) throw missingEntryError(name);
    return found;
  };

  return {
    async list() {
      return (await load()).order;
    },
    async rejected() {
      return (await load()).rejected;
    },
    async size(name) {
      return (await entryFor(name)).compressedSize;
    },
    async open(name) {
      return openZipEntryStream(random, await entryFor(name), { bounds, aggregate });
    },
  };
}

/** A .lvbak already in memory. */
export function zipEntrySource(
  bytes: Uint8Array,
  bounds: UnzipBounds = LVBAK_ARCHIVE_BOUNDS,
): LvbakEntrySource {
  return zipSourceOver(bytesSource(bytes), bounds);
}

/**
 * A .lvbak on disk. The file handle opens on the first read and stays open for reuse, so the
 * caller closes the source when done. Nothing is read at construction time: building one of these
 * for a 5 GiB archive costs nothing until a question is asked.
 */
export function zipEntrySourceFromFile(
  path: string,
  bounds: UnzipBounds = LVBAK_ARCHIVE_BOUNDS,
): LvbakEntrySource & { close(): Promise<void> } {
  let handle: Promise<FileHandle> | null = null;
  const openHandle = (): Promise<FileHandle> => {
    handle ??= import("node:fs/promises").then((fs) => fs.open(path, "r"));
    return handle;
  };

  const random: RandomAccessSource = {
    async size() {
      return (await (await openHandle()).stat()).size;
    },
    async read(offset, length) {
      if (length <= 0) return new Uint8Array(0);
      const buffer = new Uint8Array(length);
      const { bytesRead } = await (await openHandle()).read(buffer, 0, length, offset);
      return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
    },
  };

  return {
    ...zipSourceOver(random, bounds),
    async close() {
      const open = handle;
      handle = null;
      if (open) await (await open).close();
    },
  };
}
