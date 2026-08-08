/**
 * Where things live inside a .lvbak. One file owns the well-known entry names and the
 * database/{table}.ndjson naming rule, so detection, the manifests, the table walk, and the files/
 * resolver all agree on what an entry name means.
 *
 * A directory source lists in sorted order and a ZIP source lists in producer order, so nothing
 * here may depend on position. Every lookup is by name.
 */
export const MANIFEST_ENTRY = "manifest.json";
export const STATS_ENTRY = "manifest-stats.json";

export const DATABASE_PREFIX = "database/";
export const NDJSON_SUFFIX = ".ndjson";

export const FILES_PREFIX = "files/";
export const AVATARS_PREFIX = "files/avatars/";
export const IMAGES_PREFIX = "files/images/";
export const THUMBNAILS_PREFIX = "files/thumbnails/";

/** Never read: the AES key lives only in the user's separate ticket, which we never ask for. */
export const SECRETS_PREFIX = "secrets/";
/** Never read: vector rows are raw Float32 bytes and nothing in Hoplight consumes them. */
export const VECTORS_PREFIX = "lancedb/";

/** The table an entry name carries, or null when the entry is not a table dump. */
export const tableNameFromEntry = (name: string): string | null => {
  if (!name.startsWith(DATABASE_PREFIX) || !name.endsWith(NDJSON_SUFFIX)) return null;
  const table = name.slice(DATABASE_PREFIX.length, -NDJSON_SUFFIX.length);
  // Only flat database/{table}.ndjson counts; a nested path is not a table.
  return table === "" || table.includes("/") ? null : table;
};

export const entryNameForTable = (table: string): string =>
  `${DATABASE_PREFIX}${table}${NDJSON_SUFFIX}`;

export const isDatabaseEntry = (name: string): boolean => tableNameFromEntry(name) !== null;
