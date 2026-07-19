/**
 * Lore Write-for profiles: which first-class fields the editor shows.
 * Full = union of every platform wire. Other profiles hide only fields that
 * platform cannot serialize. Hiding never deletes body data.
 *
 * Ownership matrix: platform-fields.ts (codec-grounded).
 */
import {
  platformOwnsField,
} from "./platform-fields";

export type LoreWriteForProfile =
  | "full"
  | "sillytavern"
  | "chub"
  | "marinara"
  | "lumiverse"
  | "agnai"
  | "risu"
  | "novelai";

export type FieldVisibility = "show" | "emphasize" | "demote" | "hide";

/**
 * Editor-facing keys. Every key maps to a first-class LorebookEntry / body slot
 * (or a cluster of slots). Codec-grounded: if a real format serializes it, it lives here.
 */
export type LoreFieldKey =
  | "title"
  | "content"
  | "comment"
  | "enabled"
  | "constant"
  | "triggers"
  | "secondaryTriggers"
  | "selectiveLogic"
  | "triggerRiders"
  /** RC [type:value] insert chips. Full card only - RC is not a Write-for tab. */
  | "specialTriggers"
  | "position"
  | "depth"
  | "role"
  | "sortOrder"
  | "priority"
  | "probability"
  | "scanDepth"
  | "sticky"
  | "cooldown"
  | "delay"
  | "groupName"
  | "groupTuning"
  | "categoryId"
  | "recursion"
  | "delayUntilRecursion"
  | "useMemo"
  | "characterFilter"
  | "sideEffects"
  | "contextConfig"
  | "naiActivation"
  | "phraseBias"
  | "scanSources"
  | "vectorized"
  | "automationId"
  | "displayIndex"
  | "matchOverrides";

const ALL_SHOW: Record<LoreFieldKey, FieldVisibility> = {
  title: "emphasize",
  content: "emphasize",
  comment: "show",
  enabled: "show",
  constant: "show",
  triggers: "emphasize",
  secondaryTriggers: "show",
  selectiveLogic: "show",
  triggerRiders: "show",
  specialTriggers: "show",
  position: "show",
  depth: "show",
  role: "show",
  sortOrder: "show",
  priority: "show",
  probability: "show",
  scanDepth: "show",
  sticky: "show",
  cooldown: "show",
  delay: "show",
  groupName: "show",
  groupTuning: "show",
  categoryId: "show",
  recursion: "show",
  delayUntilRecursion: "show",
  useMemo: "show",
  characterFilter: "show",
  sideEffects: "show",
  contextConfig: "show",
  naiActivation: "show",
  phraseBias: "show",
  scanSources: "show",
  vectorized: "show",
  automationId: "show",
  displayIndex: "show",
  matchOverrides: "show",
};

/** Emphasis only (never hide). Hide is owned exclusively by platformOwnsField. */
const PROFILE_EMPHASIS: Record<LoreWriteForProfile, Partial<Record<LoreFieldKey, FieldVisibility>>> = {
  full: {},
  sillytavern: {
    sticky: "emphasize",
    groupName: "emphasize",
    groupTuning: "emphasize",
    recursion: "emphasize",
    scanSources: "emphasize",
    displayIndex: "emphasize",
    vectorized: "show",
    comment: "demote",
    sideEffects: "demote",
  },
  chub: {
    priority: "emphasize",
    secondaryTriggers: "emphasize",
  },
  marinara: {
    sticky: "emphasize",
    cooldown: "emphasize",
    scanSources: "emphasize",
    categoryId: "emphasize",
    characterFilter: "emphasize",
  },
  lumiverse: {
    priority: "emphasize",
    secondaryTriggers: "emphasize",
  },
  agnai: {
    comment: "emphasize",
    priority: "emphasize",
    sortOrder: "emphasize",
    probability: "emphasize",
    secondaryTriggers: "demote",
    selectiveLogic: "demote",
    recursion: "demote",
  },
  risu: {
    categoryId: "emphasize",
    probability: "emphasize",
    role: "emphasize",
    comment: "demote",
    groupTuning: "demote",
    scanSources: "demote",
  },
  novelai: {
    contextConfig: "emphasize",
    naiActivation: "emphasize",
    phraseBias: "emphasize",
    categoryId: "emphasize",
    scanDepth: "emphasize",
    comment: "demote",
  },
};

/** Platform tab labels (character lens precedent: ONE platform per lens, never smushed).
 * Full is the Vaude tab, not a platform name. */
export const LORE_WRITE_FOR_LABELS: Record<LoreWriteForProfile, string> = {
  full: "Vaude",
  sillytavern: "SillyTavern",
  chub: "Chub",
  marinara: "Marinara",
  lumiverse: "Lumiverse",
  agnai: "Agnai",
  risu: "Risu",
  novelai: "NovelAI",
};

export const LORE_WRITE_FOR_PROFILES: readonly LoreWriteForProfile[] = [
  "full",
  "sillytavern",
  "chub",
  "marinara",
  "lumiverse",
  "agnai",
  "risu",
  "novelai",
];

export function isLoreWriteForProfile(v: unknown): v is LoreWriteForProfile {
  return typeof v === "string" && (LORE_WRITE_FOR_PROFILES as readonly string[]).includes(v);
}

export function parseWriteFor(v: unknown): LoreWriteForProfile {
  return isLoreWriteForProfile(v) ? v : "full";
}

/**
 * Visibility for a Write-for profile.
 * 1) Start with all show.
 * 2) Hide only fields the platform does not own (full owns everything).
 * 3) Apply emphasis/demote on remaining visible keys.
 */
export function loreFieldVisibility(profile: LoreWriteForProfile): Record<LoreFieldKey, FieldVisibility> {
  const base = { ...ALL_SHOW };
  for (const key of Object.keys(base) as LoreFieldKey[]) {
    if (!platformOwnsField(profile, key)) base[key] = "hide";
  }
  const over = PROFILE_EMPHASIS[profile] ?? {};
  for (const [k, vis] of Object.entries(over) as [LoreFieldKey, FieldVisibility][]) {
    if (base[k] === "hide") continue;
    if (vis === "hide") continue; // emphasis map must not hide
    base[k] = vis;
  }
  return base;
}

export function fieldVisible(profile: LoreWriteForProfile, key: LoreFieldKey): boolean {
  return loreFieldVisibility(profile)[key] !== "hide";
}
