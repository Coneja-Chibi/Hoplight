/**
 * Media hub: pack, named assets, capabilities, resolve-ref, portrait helpers.
 */
export {
  type SpritePackItem,
  type SpritePackValue,
  emptyPack,
  newPackItemId,
  normalizeLabel,
  labelFromFilename,
  normalizePack,
  packFromMedia,
  emotionAssetsFromPack,
  applyPackToMedia,
  resolvePackFace,
  reorderPackItems,
} from "./pack";

export {
  type NamedAssetKind,
  type NamedAsset,
  type NamedAssetsValue,
  emptyNamed,
  newNamedId,
  extFromNameOrRef,
  kindFromExt,
  kindFromMime,
  normalizeNamed,
} from "./named";

export {
  type AssetFileMap,
  resolveAssetRef,
  PREVIEW_MAX_BYTES,
} from "./resolve-ref";

export {
  type MediaCapabilities,
  mediaCapabilities,
} from "./capabilities";

export {
  mimeFromDataUri,
  mimeFromUrl,
  portraitFromRef,
  isPreviewablePortraitRef,
} from "./portrait";

export { packFromZipBytes } from "./zip-import";

export {
  type ExpressionProfile,
  ST_GOEMOTIONS,
  CORE_STARTER,
  OPEN_STARTER,
  CORE_SLOT_LABELS,
  profileById,
  profileForTargets,
} from "./expression-profiles";

export { matchExpression } from "./expression-match";

export { type PackHealthKind, type PackHealthNote, packHealth } from "./pack-health";

export { type MediaExportSummary, mediaExportSummary } from "./summary";

export { type FaceOnlyResult, faceOnlyFromPack } from "./face-only";

export {
  type SheetCell,
  type SheetGridSpec,
  sheetCells,
  sheetCellCount,
  SHEET_MAX_CELLS,
} from "./sheet-slice";

export {
  type ExpressionMapValue,
  packFromExpressionMap,
  expressionMapFromPack,
} from "./expression-map-bridge";
