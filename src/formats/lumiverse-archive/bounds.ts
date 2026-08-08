/**
 * Container ceilings for .lvbak archives (specs/formats/lumiverse-archive.md Behavior step 1).
 *
 * These adopt Lumiverse's own import caps verbatim rather than picking something tighter: any
 * archive Lumiverse itself would restore, Hoplight can read. Diverging lower would reject real
 * backups for no safety gain, since a breach aborts the whole archive either way.
 */
import type { UnzipBounds } from "../../core/archive";

const GIB = 1024 * 1024 * 1024;

/**
 * Compressed archive, aggregate decompressed, and entry count come straight from the spec. The two
 * per-entry ceilings are derived, not specced: an entry is allowed to be as large as the budget it
 * has to fit inside anyway, so they carry the archive and aggregate numbers rather than inventing a
 * third limit that would reject an archive Lumiverse accepts.
 */
export const LVBAK_ARCHIVE_BOUNDS: UnzipBounds = {
  maxArchiveBytes: 5 * GIB,
  maxEntries: 500_000,
  maxEntryCompressed: 5 * GIB,
  maxEntryOriginal: 20 * GIB,
  maxAggregateOriginal: 20 * GIB,
};
