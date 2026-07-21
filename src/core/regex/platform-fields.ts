/**
 * Which first-class regex fields each Write-for profile OWNS on a real wire, and which pipeline
 * PHASES each profile's wire can carry. Full = union of every platform. Hide only what that
 * platform cannot serialize; never strip body data when a profile hides a control. The
 * position-picker law (positionsForProfile's twin here is phasesForProfile): per-platform truth
 * lives here, never a UI literal.
 *
 * Grounded in design/REGEX-FORMATS.md (the dialect survey), field-by-field:
 * - ST owns trimStrings / substituteFind (none|raw|escaped) / minDepth / maxDepth / runOnEdit.
 * - RC owns ST's cluster MINUS substituteFind, plus per-rule timeout budgeting (an engine behavior,
 *   not a field, so it adds nothing here). The subsystem A wire (the only live RC path) never
 *   round-trips substituteFind; subsystem B, which had it, is dead code (design/REGEX-FORMATS.md
 *   "Residuals", src/formats/rolecall/regex.ts header). The original plan-seeded claim is corrected
 *   here per that residual's explicit deferral to "whichever phase next touches this file".
 * - Lumiverse owns targets (the placement x target matrix) / substituteFind (all four modes,
 *   including "after") / trimStrings / depths / runOnEdit / note (its `description` field).
 * - Risu owns useFlags (`ableFlag`) only - the leanest wire, richest OUTPUT language instead.
 * - Marinara-Engine owns characterIds (`targetCharacterIds`) / depths, and folds its `promptOnly`
 *   boolean into targets - no trimStrings, no substituteFind, no runOnEdit (deliberate subset).
 */
import type { RegexFieldKey, RegexWriteForProfile } from "./capabilities";
import type { RegexPhase } from "../../entities/regex/schema";

/** Fields every profile always shows (portable floor). */
export const REGEX_CORE_KEYS: readonly RegexFieldKey[] = [
  "label",
  "find",
  "flags",
  "replace",
  "enabled",
  "sortOrder",
  "phases",
];

/**
 * Extra keys each profile must surface (in addition to core). Anything not listed and not core
 * may still show on full; non-full profiles hide keys that have no wire home on that platform.
 */
export const PLATFORM_OWNED_EXTRAS: Record<RegexWriteForProfile, readonly RegexFieldKey[]> = {
  full: [
    "note",
    "useFlags",
    "trimStrings",
    "targets",
    "substituteFind",
    "minDepth",
    "maxDepth",
    "runOnEdit",
    "characterIds",
  ],
  sillytavern: ["trimStrings", "substituteFind", "minDepth", "maxDepth", "runOnEdit"],
  risu: ["useFlags"],
  rolecall: ["trimStrings", "minDepth", "maxDepth", "runOnEdit"],
  lumiverse: ["note", "targets", "substituteFind", "trimStrings", "minDepth", "maxDepth", "runOnEdit"],
  marinara: ["characterIds", "targets", "minDepth", "maxDepth"],
};

/** Canonical display order for pipeline phases (the divergence-axis-2 union). */
export const REGEX_ALL_PHASES: readonly RegexPhase[] = [
  "input",
  "output",
  "request",
  "display",
  "prompt",
  "lorebook",
  "reasoning",
  "slash",
  "memory",
];

/**
 * Which phases each profile's wire can actually carry. Grounded in design/REGEX-FORMATS.md:
 * - sillytavern: input/output/slash/lorebook/reasoning (placement enum 1/2/3/5/6); its
 *   display-only/prompt-only split rides markdownOnly/promptOnly booleans, folded by the codec,
 *   not exposed as separate phase-picker stops here.
 * - risu: input/output/request/display (editinput/editoutput/editrequest/editdisplay).
 * - rolecall: input/output/display/prompt/lorebook/reasoning (its placement[] string union).
 * - lumiverse: input/output/lorebook/reasoning/memory (the only platform with a memory phase);
 *   its target[] axis is a separate field (RegexTargetChannel), not folded in here.
 * - marinara: input/output only (the deliberate 2-phase subset).
 */
export const REGEX_PHASES_BY_PROFILE: Record<RegexWriteForProfile, readonly RegexPhase[]> = {
  full: REGEX_ALL_PHASES,
  sillytavern: ["input", "output", "slash", "lorebook", "reasoning"],
  risu: ["input", "output", "request", "display"],
  rolecall: ["input", "output", "display", "prompt", "lorebook", "reasoning"],
  lumiverse: ["input", "output", "lorebook", "reasoning", "memory"],
  marinara: ["input", "output"],
};

/** The phases this profile's wire carries, in canonical display order. */
export function phasesForProfile(profile: RegexWriteForProfile): readonly RegexPhase[] {
  const owned = REGEX_PHASES_BY_PROFILE[profile] ?? REGEX_ALL_PHASES;
  return REGEX_ALL_PHASES.filter((p) => owned.includes(p));
}

// ---------------------------------------------------------------------------
// Engine-feature support (the travel-honesty axis, beside the phase matrix)
// ---------------------------------------------------------------------------

/**
 * Beyond field ownership and phases, the wires diverge on which REPLACE/flag extensions their engine
 * actually EXECUTES, and which PATTERN features risk breaking on an old install. The AST is
 * single-dialect (all five targets run JS RegExp - one grammar, by fact), so this divergence is a
 * travel LINT, never a parser fork (REGEX-JEWEL-PLAN.md R2X, QOL 27). core/regex/travel-lint.ts
 * walks a rule against this table and returns plain-language notes; the editor shows them under the
 * active Write-for lens (dashed amber) and export surfaces them in the summary. Nothing is blocked.
 *
 * Grounded in design/REGEX-FORMATS.md:
 * - {{match}}: ST `replaceString` sugar for `$0` (survey "SillyTavern (RegexScriptData)"). RC runs it
 *   too (task + REGEX-JEWEL-PLAN.md R2X mandate "{{match}}: ST+RC only"; the survey grounds ST
 *   explicitly and RC's `import-st-regex.ts` maps the same replace grammar, so RC is the plan's call,
 *   not a survey-derived one). Hoplight runs it as well (core/regex/replace-ops.ts).
 * - case transforms (\u \l \U \L \E): a vaud-engine extension (replace-ops.ts); no surveyed wire
 *   executes them, so on every other lens they print literally.
 * - conditional chaining (run B only if A fired), overlay (display-only spans), and
 *   first-match-only: vaud-engine only (REGEX-JEWEL-PLAN.md R2X). Since Part B these are
 *   FIRST-CLASS RULE FIELDS (entities/regex/schema.ts condition/overlay/firstMatchOnly), so
 *   travel-lint detects them straight off the rule (field: "rule") - the earlier "no single-rule
 *   token" note predates the schema fields.
 * - <cbs> flag tokens: Risu-only output-macro processing (survey "RisuAI", live "gu<cbs>"); every
 *   other engine (Hoplight included - apply.ts strips it before compiling) ignores it.
 */
export type RegexReplaceFeature =
  | "match-token"
  | "case-transform"
  | "conditional-chaining"
  | "overlay"
  | "first-match-only"
  | "cbs-flag-tokens";

/** Which profiles' engines EXECUTE each replace/flag extension. A profile absent = prints/ignores it. */
export const REGEX_REPLACE_FEATURE_SUPPORT: Record<
  RegexReplaceFeature,
  readonly RegexWriteForProfile[]
> = {
  "match-token": ["full", "sillytavern", "rolecall"],
  "case-transform": ["full"],
  "conditional-chaining": ["full"],
  "overlay": ["full"],
  "first-match-only": ["full"],
  "cbs-flag-tokens": ["risu"],
};

/**
 * PATTERN features every wire's JS engine supports on a CURRENT runtime but that OLDER installs may
 * reject (design/REGEX-FORMATS.md notes all five execute JS RegExp; the risk is the reader's engine
 * VERSION, not the platform). travel-lint flags these on every destination except full - Hoplight is the
 * current, controlled runtime, i.e. "home", never a travel hop.
 */
export type RegexHostAgeFeature = "v-flag" | "lookbehind";

export const REGEX_HOST_AGE_FEATURES: readonly RegexHostAgeFeature[] = ["v-flag", "lookbehind"];

/** Every engine-feature the travel lint can name (replace/flag extensions + host-age pattern risks). */
export type RegexEngineFeature = RegexReplaceFeature | RegexHostAgeFeature;

/** True if this profile's engine executes the given replace/flag extension. */
export function profileRunsReplaceFeature(
  profile: RegexWriteForProfile,
  feature: RegexReplaceFeature,
): boolean {
  return REGEX_REPLACE_FEATURE_SUPPORT[feature].includes(profile);
}

/** Every key the union editor knows (full list). */
export function allRegexFieldKeys(): RegexFieldKey[] {
  const set = new Set<RegexFieldKey>(REGEX_CORE_KEYS);
  for (const extras of Object.values(PLATFORM_OWNED_EXTRAS)) {
    for (const k of extras) set.add(k);
  }
  return [...set];
}

/** True if this profile's wire (or full union) should expose the control. */
export function platformOwnsField(profile: RegexWriteForProfile, key: RegexFieldKey): boolean {
  if (REGEX_CORE_KEYS.includes(key)) return true;
  if (profile === "full") return true;
  return (PLATFORM_OWNED_EXTRAS[profile] ?? []).includes(key);
}
