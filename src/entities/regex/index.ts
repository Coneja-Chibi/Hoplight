/**
 * Regex entity barrel - the canonical regex-set shapes (REGEX-JEWEL-PLAN.md Phase R0).
 * No other entity folder (character/lorebook/pack/persona) has an index.ts today; this one exists
 * because the plan asked for it explicitly. If a second entity grows one, promote this to the house
 * convention instead of a one-off.
 */
export type {
  RegexPhase,
  RegexTargetChannel,
  RegexSubstitution,
  RegexRule,
  RegexSetBody,
  CanonicalRegexSet,
  CharacterRegexScript,
} from "./schema";
