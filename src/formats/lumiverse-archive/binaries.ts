/**
 * Resolving files/ (spec Behavior step 4). Rows reference binaries by name; nothing is embedded, so
 * every avatar and image has to be looked up in the entry listing and turned into a data URI a
 * canonical entity can carry. A referenced binary that is absent is the common case, not the
 * exceptional one (the real export inspected had no files/avatars/ directory at all), so absence is
 * a normal outcome here, recorded on the report, and never a thrown error.
 *
 * The entry listing is captured once, by the caller, rather than asked of the source per lookup: a
 * character whose avatar and cropped image both miss would otherwise cost two redundant list()
 * calls, and a lorebook import walking thousands of rows would make that cost real.
 *
 * `bytes()` memoizes by entry name, for the same reason: the character slice's own module-sprite
 * collection can ask for the same expression file's bytes more than once across a run, and every
 * read charges the archive's SHARED aggregate decompressed budget (newAggregateBudget), not a
 * per-entry one. Charging that budget twice for one file a caller happened to ask for twice could
 * trip the ceiling on an otherwise legitimate archive; one read, one charge, one cached result.
 *
 * Thumbnails (files/thumbnails/) are deliberately never resolved here: the spec names their path
 * convention but no canonical field consumes a thumbnail today, so nothing in this module reads
 * THUMBNAILS_PREFIX at all. Revisit if/when a canonical slot for a thumbnail is designed.
 */
import { mimeFromPath } from "../lumiverse/modules";
import { AVATARS_PREFIX, IMAGES_PREFIX } from "./layout";
import { recordMissingBinary, type LvbakImportReport } from "./report";
import { readEntryBytes, type LvbakEntrySource } from "./source";
import { readTable, type ReadTableOptions, type TableRow } from "./table-walk";
import { rowId } from "./tables";

/** Nothing under files/ is a script or a huge media dump; 64 MiB covers any real avatar or image. */
const MAX_BINARY_BYTES = 64 * 1024 * 1024;

export interface Binaries {
  /** Whether `name` (a full entry path) is in the listing createBinaries was given. */
  has(name: string): boolean;
  /** Raw bytes for a present entry. Absence lands on the report and returns null, never throws. */
  bytes(name: string): Promise<Uint8Array | null>;
  /** `name` as a data: URI, or null when the entry is absent. */
  dataUri(name: string): Promise<string | null>;
  /** `files/avatars/{avatarPath}` as a data: URI, or null when the file is absent. */
  avatarDataUri(avatarPath: string): Promise<string | null>;
  /** `files/images/{imageRow.filename}` as a data: URI, or null when the row has no file. */
  imageDataUri(imageRow: Record<string, unknown>): Promise<string | null>;
}

/**
 * Build the files/ resolver for one archive. `entryNames` is the listing the caller already has
 * (from source.list()), so this never re-lists per lookup; `report` is where every miss lands,
 * deduped by report.ts, so forty rows referencing one absent avatar produce one warning, not forty.
 */
export function createBinaries(
  source: LvbakEntrySource,
  entryNames: readonly string[],
  report: LvbakImportReport,
): Binaries {
  const present = new Set(entryNames);
  const has = (name: string): boolean => present.has(name);

  const cache = new Map<string, Promise<Uint8Array | null>>();
  const bytes = (name: string): Promise<Uint8Array | null> => {
    let cached = cache.get(name);
    if (!cached) {
      cached = (async () => {
        if (!has(name)) {
          recordMissingBinary(report, name);
          return null;
        }
        return readEntryBytes(source, name, MAX_BINARY_BYTES);
      })();
      cache.set(name, cached);
    }
    return cached;
  };

  const dataUri = async (name: string): Promise<string | null> => {
    const raw = await bytes(name);
    if (!raw) return null;
    return `data:${mimeFromPath(name)};base64,${Buffer.from(raw).toString("base64")}`;
  };

  return {
    has,
    bytes,
    dataUri,
    avatarDataUri: (avatarPath) => dataUri(`${AVATARS_PREFIX}${avatarPath}`),
    imageDataUri: async (imageRow) => {
      const filename = imageRow.filename;
      if (typeof filename !== "string" || filename === "") return null;
      return dataUri(`${IMAGES_PREFIX}${filename}`);
    },
  };
}

/**
 * Index the images table by row id, so a character's `image_id` / `avatar_crop_image_id` can join
 * its row without a per-character table scan (spec Behavior step 4: those two columns join images
 * rather than naming a files/ path directly).
 */
export async function indexImages(
  source: LvbakEntrySource,
  opts: ReadTableOptions,
): Promise<Map<string, TableRow>> {
  const byId = new Map<string, TableRow>();
  for await (const read of readTable(source, "images", opts)) {
    const id = rowId(read.row);
    if (id) byId.set(id, read);
  }
  return byId;
}
