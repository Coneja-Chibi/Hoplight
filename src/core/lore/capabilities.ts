/**
 * Lore Write-for profiles: presentation guidance only (visibility/emphasis), not alternate models.
 * Single-select preference; platform names live only in this layer.
 */

export type LoreWriteForProfile =
  | "full"
  | "st-family"
  | "agnai"
  | "risu"
  | "novelai";

export type FieldVisibility = "show" | "emphasize" | "demote" | "hide";

/** Canonical entry/book field keys the UI may surface. */
export type LoreFieldKey =
  | "title"
  | "content"
  | "enabled"
  | "constant"
  | "triggers"
  | "secondaryTriggers"
  | "selectiveLogic"
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
  | "categoryId"
  | "recursion"
  | "sideEffects"
  | "contextConfig"
  | "scanSources"
  | "vectorized"
  | "automationId";

const ALL_SHOW: Record<LoreFieldKey, FieldVisibility> = {
  title: "emphasize",
  content: "emphasize",
  enabled: "show",
  constant: "show",
  triggers: "emphasize",
  secondaryTriggers: "show",
  selectiveLogic: "show",
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
  categoryId: "show",
  recursion: "show",
  sideEffects: "show",
  contextConfig: "show",
  scanSources: "show",
  vectorized: "show",
  automationId: "show",
};

const PROFILE_OVERRIDES: Record<LoreWriteForProfile, Partial<Record<LoreFieldKey, FieldVisibility>>> = {
  full: {},
  "st-family": {
    sideEffects: "demote",
    contextConfig: "hide",
    sticky: "emphasize",
    groupName: "emphasize",
    recursion: "emphasize",
    scanSources: "emphasize",
    vectorized: "show",
  },
  agnai: {
    secondaryTriggers: "demote",
    sticky: "hide",
    groupName: "hide",
    recursion: "demote",
    sideEffects: "hide",
    contextConfig: "hide",
    vectorized: "hide",
    automationId: "hide",
    priority: "emphasize",
    sortOrder: "emphasize",
  },
  risu: {
    sideEffects: "hide",
    contextConfig: "hide",
    scanSources: "demote",
    categoryId: "emphasize",
    probability: "emphasize",
    role: "emphasize",
  },
  novelai: {
    sticky: "hide",
    groupName: "demote",
    sideEffects: "hide",
    scanSources: "hide",
    vectorized: "hide",
    automationId: "hide",
    contextConfig: "emphasize",
    categoryId: "emphasize",
  },
};

export const LORE_WRITE_FOR_LABELS: Record<LoreWriteForProfile, string> = {
  full: "Full (RoleCall)",
  "st-family": "SillyTavern / Chub / Lumiverse",
  agnai: "Agnai",
  risu: "Risu",
  novelai: "NovelAI",
};

export const LORE_WRITE_FOR_PROFILES: readonly LoreWriteForProfile[] = [
  "full",
  "st-family",
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

/** Visibility map for a Write-for profile. Hidden fields stay in data; UI just omits controls. */
export function loreFieldVisibility(profile: LoreWriteForProfile): Record<LoreFieldKey, FieldVisibility> {
  const base = { ...ALL_SHOW };
  const over = PROFILE_OVERRIDES[profile] ?? {};
  for (const [k, vis] of Object.entries(over) as [LoreFieldKey, FieldVisibility][]) {
    base[k] = vis;
  }
  return base;
}

export function fieldVisible(
  profile: LoreWriteForProfile,
  key: LoreFieldKey,
): boolean {
  const v = loreFieldVisibility(profile)[key];
  return v !== "hide";
}
