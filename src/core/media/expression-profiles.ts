/**
 * Soft expression slot catalogs per host world. Data only; UI ghosts empty slots.
 */
export type ExpressionProfile = {
  id: string;
  label: string;
  /** suggested labels (soft checklist) */
  slots: readonly string[];
  /** alias -> preferred slot label */
  aliases: Readonly<Record<string, string>>;
};

/** ST GoEmotions-style 28 (community classifier baseline). */
export const ST_GOEMOTIONS: ExpressionProfile = {
  id: "st-goemotions",
  label: "SillyTavern 28",
  slots: [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy",
    "love", "nervousness", "optimism", "pride", "realization", "relief",
    "remorse", "sadness", "surprise", "neutral",
  ],
  aliases: {
    happy: "joy",
    sad: "sadness",
    angry: "anger",
    scared: "fear",
    surprised: "surprise",
  },
};

/** Short core set for default UI. */
export const CORE_STARTER: ExpressionProfile = {
  id: "core-starter",
  label: "Core starter",
  slots: ["neutral", "happy", "sad", "angry", "surprised", "joy"],
  aliases: {
    sadness: "sad",
    anger: "angry",
    surprise: "surprised",
  },
};

export const OPEN_STARTER: ExpressionProfile = {
  id: "open-starter",
  label: "Open pack",
  slots: ["neutral", "happy", "sad", "angry", "surprised"],
  aliases: {},
};

const PROFILES: Record<string, ExpressionProfile> = {
  [ST_GOEMOTIONS.id]: ST_GOEMOTIONS,
  [CORE_STARTER.id]: CORE_STARTER,
  [OPEN_STARTER.id]: OPEN_STARTER,
};

export function profileById(id: string): ExpressionProfile {
  return PROFILES[id] ?? CORE_STARTER;
}

/**
 * Pick profile from lens targets. Multi ST+others -> ST 28; lumi/risu/chub alone -> open; default core.
 */
export function profileForTargets(targets: readonly string[]): ExpressionProfile {
  if (targets.length === 0) return CORE_STARTER;
  if (targets.includes("sillytavern")) return ST_GOEMOTIONS;
  if (targets.every((t) => t === "agnai")) return OPEN_STARTER;
  if (
    targets.some((t) =>
      ["lumiverse", "risu", "chub", "rolecall", "marinara"].includes(t),
    )
  ) {
    return OPEN_STARTER;
  }
  return CORE_STARTER;
}

/** Core 6 for compact UI; full list available via profile.slots */
export const CORE_SLOT_LABELS = ["neutral", "happy", "sad", "angry", "surprised", "joy"] as const;
