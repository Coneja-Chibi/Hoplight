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

export { createBinaries, indexImages, type Binaries } from "./binaries";
export { LVBAK_ARCHIVE_BOUNDS } from "./bounds";
export {
  characterRowToCard,
  importCharacters,
  type CharacterCardFields,
  type ImportCharactersOptions,
} from "./characters";
export {
  detectLumiverseArchive,
  isSupportedLvbakSchema,
  LVBAK_SCHEMA_VERSION,
  type LvbakDetection,
} from "./detect";
export { addArchiveEscrow } from "./escrow";
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
export { createLinkMap, type LinkMap, type RecordedLink } from "./links";
export {
  importLorebooks,
  joinWorldBooks,
  worldBookToStWire,
  type ImportLorebooksOptions,
  type WorldBookJoin,
} from "./lorebooks";
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
  LEGACY_MAX_NDJSON_LINE_BYTES,
  MAX_NDJSON_LINE_BYTES,
  ndjsonLineCeiling,
  readNdjson,
  type NdjsonLineFailure,
  type NdjsonReadOptions,
  type NdjsonRow,
} from "./ndjson";
export { importPersonas, personaRowToWire, type ImportPersonasOptions } from "./personas";
export {
  ENCRYPTED_SECRETS_WARNING,
  VECTORS_WARNING,
  addWarning,
  applyManifestWarnings,
  createLvbakReport,
  recordFailure,
  recordImported,
  recordMissingBinary,
  recordUnresolvedLink,
  reportTotals,
  setSkippedTables,
  type ImportedEntity,
  type LvbakImportReport,
  type LvbakRowFailure,
  type SkippedTable,
  type UnresolvedLink,
} from "./report";
export {
  classifyEntryNames,
  isMacCruft,
  isUnsafeEntryName,
  readEntryBytes,
  readEntryText,
  type EntryRejection,
  type LvbakEntrySource,
  type RejectedEntry,
} from "./source";
export {
  JSON_STRING_COLUMNS,
  KNOWN_SKIPPED_TABLES,
  MAPPED_TABLES,
  TABLE_KINDS,
  isMappedTable,
  parseInnerJsonColumns,
  rowId,
  rowName,
  type InnerJsonFailure,
  type InnerJsonResult,
  type LvbakKind,
  type MappedTable,
} from "./tables";
export {
  innerJsonRowFailure,
  planTableWalk,
  readTable,
  type ReadTableOptions,
  type TableRow,
  type TableWalkPlan,
} from "./table-walk";
export { zipEntrySource } from "./zip-source";

/** No adapter: this format is read through importLumiverseArchive, not the detection table. */
const adapters: FormatAdapter[] = [];
export default adapters;
