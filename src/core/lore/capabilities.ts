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

/** Canonical entry/book field keys the UI may surface. FULL COVERAGE of the RC wire (the codec in
 * formats/rolecall/lorebook.ts is the ground truth): every authored field a real format serializes
 * has a key here so the editor can gate it - the schema-is-editor doctrine. */
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
  | "scanSources"
  | "vectorized"
  | "automationId";

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
  scanSources: "show",
  vectorized: "show",
  automationId: "show",
};

const PROFILE_OVERRIDES: Record<LoreWriteForProfile, Partial<Record<LoreFieldKey, FieldVisibility>>> = {
  full: {},
  "st-family": {
    comment: "demote",
    triggerRiders: "hide",
    sideEffects: "demote",
    contextConfig: "hide",
    naiActivation: "hide",
    useMemo: "hide",
    sticky: "emphasize",
    groupName: "emphasize",
    groupTuning: "emphasize",
    recursion: "emphasize",
    delayUntilRecursion: "show",
    characterFilter: "show",
    scanSources: "emphasize",
    vectorized: "show",
  },
  agnai: {
    comment: "hide",
    secondaryTriggers: "demote",
    triggerRiders: "hide",
    sticky: "hide",
    groupName: "hide",
    groupTuning: "hide",
    recursion: "demote",
    delayUntilRecursion: "hide",
    useMemo: "hide",
    characterFilter: "hide",
    sideEffects: "hide",
    contextConfig: "hide",
    naiActivation: "hide",
    vectorized: "hide",
    automationId: "hide",
    priority: "emphasize",
    sortOrder: "emphasize",
  },
  risu: {
    comment: "demote",
    triggerRiders: "show",
    groupTuning: "demote",
    delayUntilRecursion: "demote",
    useMemo: "hide",
    characterFilter: "demote",
    sideEffects: "hide",
    contextConfig: "hide",
    naiActivation: "hide",
    scanSources: "demote",
    categoryId: "emphasize",
    probability: "emphasize",
    role: "emphasize",
  },
  novelai: {
    comment: "demote",
    sticky: "hide",
    groupName: "demote",
    groupTuning: "hide",
    delayUntilRecursion: "hide",
    useMemo: "hide",
    characterFilter: "hide",
    sideEffects: "hide",
    scanSources: "hide",
    vectorized: "hide",
    automationId: "hide",
    contextConfig: "emphasize",
    naiActivation: "emphasize",
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
