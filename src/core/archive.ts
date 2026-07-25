/**
 * Bounded ZIP inflate for untrusted archives. Checks originalSize / size / count / aggregate
 * BEFORE inflation where fflate's filter allows; rechecks actual lengths after.
 * Bun-independent core helper. Format adapters must not reimplement safeUnzip locally.
 */
import { unzipSync, type UnzipFileInfo } from "fflate";

export class ArchiveLimitError extends Error {
  readonly code = "archive_limit" as const;
  constructor(message = "archive exceeds safety limits") {
    super(message);
    this.name = "ArchiveLimitError";
  }
}

export interface UnzipBounds {
  /** Max compressed archive length (input bytes). */
  maxArchiveBytes: number;
  /** Max total entries in the archive, including entries skipped by a filter. */
  maxEntries: number;
  /** Max compressed size of one entry (fflate `size`). */
  maxEntryCompressed: number;
  /** Max original (inflated) size of one entry. */
  maxEntryOriginal: number;
  /** Max sum of selected original sizes. */
  maxAggregateOriginal: number;
}

/** Full character card containers (charx, byaf, lumiverse zip). */
export const CARD_ARCHIVE_BOUNDS: UnzipBounds = {
  maxArchiveBytes: 96 * 1024 * 1024,
  maxEntries: 512,
  maxEntryCompressed: 64 * 1024 * 1024,
  maxEntryOriginal: 64 * 1024 * 1024,
  maxAggregateOriginal: 96 * 1024 * 1024,
};

/** Expression / sprite pack ZIPs (tighter). */
export const PACK_ARCHIVE_BOUNDS: UnzipBounds = {
  maxArchiveBytes: 48 * 1024 * 1024,
  maxEntries: 256,
  maxEntryCompressed: 16 * 1024 * 1024,
  maxEntryOriginal: 16 * 1024 * 1024,
  maxAggregateOriginal: 48 * 1024 * 1024,
};

export interface UnzipBoundedOptions {
  bounds?: UnzipBounds;
  /** When set, only this entry name is selected (detection path). */
  only?: string;
  /** Extra selection filter; deny inflation by returning false. */
  filter?: (file: UnzipFileInfo) => boolean;
}

const entryOriginal = (f: UnzipFileInfo): number => {
  const o = f.originalSize;
  if (typeof o === "number" && Number.isFinite(o) && o >= 0) return o;
  // Missing originalSize: treat compressed size as a lower bound and still cap compressed.
  return typeof f.size === "number" && f.size >= 0 ? f.size : 0;
};

/**
 * Unzip with pre-inflate budgets. Throws ArchiveLimitError when the archive entry count,
 * a selected entry, or the selected aggregate would exceed limits.
 */
export function unzipBounded(
  bytes: Uint8Array,
  options: UnzipBoundedOptions = {},
): Record<string, Uint8Array> {
  const bounds = options.bounds ?? CARD_ARCHIVE_BOUNDS;
  if (bytes.byteLength > bounds.maxArchiveBytes) {
    throw new ArchiveLimitError("archive exceeds safety limits");
  }

  let entries = 0;
  let aggregate = 0;

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        entries += 1;
        if (entries > bounds.maxEntries) {
          throw new ArchiveLimitError("archive has too many entries");
        }

        if (options.only !== undefined && f.name !== options.only) return false;
        if (options.filter && !options.filter(f)) return false;

        const compressed = typeof f.size === "number" ? f.size : 0;
        const original = entryOriginal(f);
        if (compressed > bounds.maxEntryCompressed || original > bounds.maxEntryOriginal) {
          throw new ArchiveLimitError("archive entry exceeds safety limits");
        }
        if (aggregate + original > bounds.maxAggregateOriginal) {
          throw new ArchiveLimitError("archive aggregate size exceeds safety limits");
        }
        aggregate += original;
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ArchiveLimitError) throw e;
    throw new ArchiveLimitError("archive could not be read safely");
  }

  let actualAgg = 0;
  let count = 0;
  for (const data of Object.values(files)) {
    count += 1;
    actualAgg += data.byteLength;
    if (data.byteLength > bounds.maxEntryOriginal) {
      throw new ArchiveLimitError("archive entry exceeds safety limits");
    }
    if (actualAgg > bounds.maxAggregateOriginal || count > bounds.maxEntries) {
      throw new ArchiveLimitError("archive aggregate size exceeds safety limits");
    }
  }
  return files;
}

export const isArchiveLimitError = (e: unknown): e is ArchiveLimitError =>
  e instanceof ArchiveLimitError ||
  (typeof e === "object" && e !== null && (e as { name?: string }).name === "ArchiveLimitError");
