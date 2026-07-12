/**
 * Pure regex capabilities (REGEX-JEWEL-PLAN.md Phase R0). Engine/inspect/templates land in later
 * phases (R2/R4/R5) and export from here the same way core/lore/index.ts grew.
 */
export {
  type RegexWriteForProfile,
  type FieldVisibility,
  type RegexFieldKey,
  REGEX_WRITE_FOR_LABELS,
  REGEX_WRITE_FOR_PROFILES,
  isRegexWriteForProfile,
  parseWriteFor,
  regexFieldVisibility,
  fieldVisible,
} from "./capabilities";
export {
  REGEX_ALL_PHASES,
  REGEX_CORE_KEYS,
  REGEX_PHASES_BY_PROFILE,
  PLATFORM_OWNED_EXTRAS,
  allRegexFieldKeys,
  phasesForProfile,
  platformOwnsField,
} from "./platform-fields";
export {
  DEFAULT_MAX_MATCHES,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  applyRules,
  validateRule,
} from "./apply";
export type {
  RegexRunOptions,
  RegexRunResult,
  RuleOverlay,
  RuleTrace,
  TraceMatch,
} from "./apply";
export type { RuleValidation } from "./validate";
export { buildFromPhrases, explainPattern } from "./builder";
export type { BuildOptions, BuiltRegex, ExplainResult } from "./builder";
export {
  WB_LOOKAHEAD,
  WB_LOOKBEHIND,
  mergeUnicodeFlag,
  unwrapWordBoundary,
  wrapWordBoundary,
} from "./word-boundary";
export type { BoundaryWrap } from "./word-boundary";
export { analyzeWordFamily } from "./word-family";
export type { WordFamilyAnalysis } from "./word-family";
export { EMPTY_WORDS_STATE, buildWordsPattern, decompileWordsState } from "./word-builder";
export type { WordsBuilderState, WordsBuilt } from "./word-builder";
export { analyzePhrasePattern, buildFromExamples } from "./example-builder";
export type {
  ExampleBuilt,
  ExampleOptions,
  PhrasePatternAnalysis,
  PhraseSlot,
} from "./example-builder";
export { buildAnyNumber, buildBetween, buildLineAnchor, recognizeAtom } from "./structure-atoms";
export type { AtomBuilt, StructureAtom } from "./structure-atoms";
export { readoutFor } from "./readout";
export type { PatternSpan, Readout, ReadoutOptions, SpanKind } from "./readout";
export { guidedMiss } from "./guided-feedback";
export { expandReplacement, substituteAfterMacros, substituteFindMacros } from "./replace-ops";
export { travelLint } from "./travel-lint";
export type { TravelNote, TravelSeverity } from "./travel-lint";
export * from "./ast";
