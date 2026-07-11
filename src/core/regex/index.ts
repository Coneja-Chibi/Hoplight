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
export { expandReplacement, substituteAfterMacros, substituteFindMacros } from "./replace-ops";
export { travelLint } from "./travel-lint";
export type { TravelNote, TravelSeverity } from "./travel-lint";
export * from "./ast";
