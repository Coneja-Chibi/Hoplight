/**
 * Lumiverse data archive (.lvbak): a per-user SQLite dump, not a bundle of platform files.
 *
 * Folders-as-schema drop-in, with no adapter of its own on purpose. Import fans one archive out
 * into many canonical entities by synthesizing each per-kind wire shape and dispatching to the
 * codecs in src/formats/lumiverse/, so mapping logic exists exactly once. The loader tolerates an
 * empty default export; this folder registers nothing in the detection table.
 *
 * node:fs-backed pieces (directoryEntrySource, zipEntrySourceFromFile) are deliberately NOT
 * re-exported here, so this barrel stays importable from any runtime. Import them by path.
 */
import type { FormatAdapter } from "../../core/adapter";

export { LVBAK_ARCHIVE_BOUNDS } from "./bounds";
export {
  detectLumiverseArchive,
  isSupportedLvbakSchema,
  LVBAK_SCHEMA_VERSION,
  type LvbakDetection,
} from "./detect";
export {
  AVATARS_PREFIX,
  DATABASE_PREFIX,
  FILES_PREFIX,
  IMAGES_PREFIX,
  MANIFEST_ENTRY,
  NDJSON_SUFFIX,
  SECRETS_PREFIX,
  STATS_ENTRY,
  THUMBNAILS_PREFIX,
  VECTORS_PREFIX,
  entryNameForTable,
  isDatabaseEntry,
  tableNameFromEntry,
} from "./layout";
export {
  LUMIVERSE_PRODUCER,
  parseManifest,
  parseStats,
  readManifest,
  readStats,
  type LvbakManifest,
  type LvbakStats,
} from "./manifest";
export {
  classifyEntryNames,
  isMacCruft,
  isUnsafeEntryName,
  readEntryText,
  type EntryRejection,
  type LvbakEntrySource,
  type RejectedEntry,
} from "./source";
export { zipEntrySource } from "./zip-source";

/** No adapter: this format is read through importLumiverseArchive, not the detection table. */
const adapters: FormatAdapter[] = [];
export default adapters;
