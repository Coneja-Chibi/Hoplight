/**
 * Which first-class lore fields each Write-for profile OWNS on a real wire.
 * Full = union of every platform. Hide only what that platform cannot serialize;
 * never strip body data when a profile hides a control.
 *
 * Grounded in codecs:
 * - full / RC: formats/rolecall/lorebook.ts
 * - sillytavern: sillytavern/lorebook.ts (the full worldinfo wire)
 * - chub / lumiverse: the CCv3 character_book floor via _shared/character-book.ts - SEPARATE
 *   lenses (a platform is never smushed into another's tab); their owned lists duplicate on
 *   purpose, that is the auditable-alignment doctrine
 * - agnai: agnai/lorebook.ts
 * - risu: risu/lorebook.ts
 * - novelai: novelai/lorebook.ts
 */
import type { InjectionPosition } from "../../entities/lorebook/schema";
import type { LoreFieldKey, LoreWriteForProfile } from "./capabilities";

/** Fields every profile always shows (portable floor). */
export const LORE_CORE_KEYS: readonly LoreFieldKey[] = [
  "title",
  "content",
  "enabled",
  "constant",
  "triggers",
  "sortOrder",
  "scanDepth",
];

/**
 * Extra keys each profile must surface (in addition to core).
 * Anything not listed and not core may still show on full; non-full profiles hide keys
 * that have no wire home on that platform.
 */
export const PLATFORM_OWNED_EXTRAS: Record<LoreWriteForProfile, readonly LoreFieldKey[]> = {
  full: [
    "comment",
    "secondaryTriggers",
    "selectiveLogic",
    "triggerRiders",
    "specialTriggers", // RC [type:value] specials live on the full card only (no RC tab)
    "position",
    "depth",
    "role",
    "priority",
    "probability",
    "sticky",
    "cooldown",
    "delay",
    "groupName",
    "groupTuning",
    "categoryId",
    "recursion",
    "delayUntilRecursion",
    "useMemo",
    "characterFilter",
    "sideEffects",
    "contextConfig",
    "naiActivation",
    "scanSources",
    "vectorized",
    "automationId",
    "displayIndex",
    "matchOverrides",
  ],
  sillytavern: [
    "secondaryTriggers",
    "selectiveLogic",
    "position",
    "depth",
    "role",
    "probability",
    "sticky",
    "cooldown",
    "delay",
    "groupName",
    "groupTuning",
    "recursion",
    "delayUntilRecursion",
    "useMemo",
    "characterFilter",
    "scanSources",
    "vectorized",
    "automationId",
    "displayIndex",
    "matchOverrides",
    "priority", // defaulted on ST file; still editable for CCv3 character_book priority axis
  ],
  chub: [
    "secondaryTriggers",
    "selectiveLogic",
    "position",
    "priority",
    "probability",
    "matchOverrides",
  ],
  lumiverse: [
    "secondaryTriggers",
    "selectiveLogic",
    "position",
    "priority",
    "probability",
    "matchOverrides",
  ],
  agnai: [
    "comment",
    "secondaryTriggers",
    "selectiveLogic",
    "position",
    "priority",
    "probability",
    "recursion",
    "matchOverrides",
  ],
  risu: [
    "comment",
    "secondaryTriggers", // secondkey
    // no triggerRiders / specialTriggers: activationPercent is entry-level; useRegex is entry-wide
    "role",
    "probability",
    "categoryId",
    "matchOverrides",
  ],
  novelai: [
    "position",
    "categoryId",
    "contextConfig",
    "naiActivation",
    "matchOverrides", // searchRange maps to scanDepth; match overrides still useful as scanDepth UI
  ],
};

/** Canonical display order for injection slots (RC's flat superset carries all of them). */
export const LORE_ALL_POSITIONS: readonly InjectionPosition[] = [
  "world",
  "character",
  "scene",
  "depth",
  "append",
  "prepend_top",
  "append_bottom",
  "before_example",
  "after_example",
];

/**
 * Which injection slots each profile's wire can actually carry. Grounded in codecs:
 * - full / RC: rolecall/lorebook.ts round-trips the whole canonical set
 * - sillytavern: sillytavern/lorebook.ts parsePosition (numeric 0-4: before/after char,
 *   before/after example, @depth); the rest collapse lossily on export
 * - chub / lumiverse / agnai: before_char/after_char floor (character-book wire)
 * - risu: risu/lorebook.ts - native lore has no position slot (character floor)
 * - novelai: novelai/lorebook.ts - placement rides contextConfig, not a slot (character floor)
 */
export const LORE_POSITIONS_BY_PROFILE: Record<LoreWriteForProfile, readonly InjectionPosition[]> = {
  full: LORE_ALL_POSITIONS,
  sillytavern: ["world", "character", "depth", "before_example", "after_example"],
  chub: ["world", "character"],
  lumiverse: ["world", "character"],
  agnai: ["world", "character"],
  risu: ["character"],
  novelai: ["character"],
};

/** The slots this profile's wire carries, in canonical display order. */
export function positionsForProfile(profile: LoreWriteForProfile): readonly InjectionPosition[] {
  const owned = LORE_POSITIONS_BY_PROFILE[profile] ?? LORE_ALL_POSITIONS;
  return LORE_ALL_POSITIONS.filter((p) => owned.includes(p));
}

/**
 * Depth-like slots: need an @ depth number and sit LAST on the placement rail.
 * `append` is ST's "at depth in chat" sibling of `depth`.
 */
export function isDepthLikePosition(position: InjectionPosition): boolean {
  return position === "depth" || position === "append";
}

/**
 * Stops for the placement rail: profile slots with non-depth first, depth-like last.
 * If `current` is foreign to the profile it is still included (never hide real data).
 */
export function placementRailStops(
  profile: LoreWriteForProfile,
  current?: InjectionPosition | null,
): readonly InjectionPosition[] {
  const allowed = positionsForProfile(profile);
  const nonDepth = allowed.filter((p) => !isDepthLikePosition(p));
  const depthLike = allowed.filter((p) => isDepthLikePosition(p));
  if (current == null || allowed.includes(current)) {
    return [...nonDepth, ...depthLike];
  }
  if (isDepthLikePosition(current)) {
    return [...nonDepth, ...depthLike, current];
  }
  return [...nonDepth, current, ...depthLike];
}

/** True when this profile has a real multi-stop placement axis (not a silent character floor). */
export function placementRailVisible(profile: LoreWriteForProfile): boolean {
  return positionsForProfile(profile).length > 1;
}

/** Every key the union editor knows (full list). */
export function allPlatformFieldKeys(): LoreFieldKey[] {
  const set = new Set<LoreFieldKey>(LORE_CORE_KEYS);
  for (const extras of Object.values(PLATFORM_OWNED_EXTRAS)) {
    for (const k of extras) set.add(k);
  }
  return [...set];
}

/** True if this profile's wire (or full union) should expose the control. */
export function platformOwnsField(profile: LoreWriteForProfile, key: LoreFieldKey): boolean {
  if (LORE_CORE_KEYS.includes(key)) return true;
  if (profile === "full") return true;
  return (PLATFORM_OWNED_EXTRAS[profile] ?? []).includes(key);
}
