/**
 * Pure lore capabilities, summaries, health, empty factory, sample match,
 * plus the jewel activation/inspect/diff engine (LOREBOOK-JEWEL-PLAN Phase 0).
 */
export {
  type LoreWriteForProfile,
  type FieldVisibility,
  type LoreFieldKey,
  LORE_WRITE_FOR_LABELS,
  LORE_WRITE_FOR_PROFILES,
  isLoreWriteForProfile,
  parseWriteFor,
  loreFieldVisibility,
  fieldVisible,
} from "./capabilities";
export {
  LORE_ALL_POSITIONS,
  LORE_CORE_KEYS,
  LORE_POSITIONS_BY_PROFILE,
  PLATFORM_OWNED_EXTRAS,
  allPlatformFieldKeys,
  platformOwnsField,
  positionsForProfile,
} from "./platform-fields";
export { type LoreSummary, estimateBookTokens, estimateEntryTokens, loreSummary } from "./summary";
export { type LoreHealthLevel, type LoreHealthNote, loreHealth } from "./health";
export { emptyLoreEntry, emptyLorebookBody } from "./empty-book";
export { type SampleMatchHit, sampleMatchEntries } from "./sample-match";
export {
  type ScanLine,
  type ActivationOptions,
  type TimedState,
  type FireReason,
  type SkipReason,
  type EntryVerdict,
  type ActivationResult,
  type MatchOpts,
  type WakeEdge,
  keywordMatches,
  resolveMatchOpts,
  secondaryLogicOk,
  scanBook,
  bookWakeGraph,
} from "./activation";
export {
  type LoreFinding,
  type LoreFindingRule,
  inspectBook,
  applyAllFixes,
} from "./inspect";
export {
  type FieldChange,
  type BookDiff,
  diffBooks,
  wordDiffRanges,
  revertField,
  restoreEntry,
} from "./diff";
