/**
 * Which first-class regex fields each Write-for profile OWNS on a real wire, and which pipeline
 * PHASES each profile's wire can carry. Full = union of every platform. Hide only what that
 * platform cannot serialize; never strip body data when a profile hides a control. The
 * position-picker law (positionsForProfile's twin here is phasesForProfile): per-platform truth
 * lives here, never a UI literal.
 *
 * Grounded in design/REGEX-FORMATS.md (the dialect survey), field-by-field:
 * - ST owns trimStrings / substituteFind (none|raw|escaped) / minDepth / maxDepth / runOnEdit.
 * - RC owns the same cluster as ST plus per-rule timeout budgeting (an engine behavior, not a
 *   field, so it adds nothing here).
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
  rolecall: ["trimStrings", "substituteFind", "minDepth", "maxDepth", "runOnEdit"],
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
