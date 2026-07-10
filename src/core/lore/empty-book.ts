/**
 * Deterministic empty lorebook body factory for "New lorebook".
 */
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";

export function emptyLoreEntry(id: string): LorebookEntry {
  return {
    id,
    title: "",
    content: "",
    enabled: true,
    constant: false,
    triggerMode: "simple",
    triggers: [],
    secondaryTriggers: [],
    selectiveLogic: "and_any",
    caseSensitive: null,
    matchWholeWords: null,
    scanDepth: null,
    position: "world",
    depth: 4,
    role: "system",
    sortOrder: 100,
    priority: 100,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    groupName: null,
    categoryId: null,
    groupWeight: 100,
    probability: 100,
    useMemo: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: 0,
    characterFilter: null,
    scanCharacterDescription: false,
    scanCharacterPersonality: false,
    scanUserPersona: false,
    scanScenario: false,
    ignoreBudget: false,
    sideEffects: null,
  };
}

export function emptyLorebookBody(name = "Untitled lorebook"): LorebookBody {
  return {
    name,
    tags: [],
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    globalScanDepth: 4,
    globalRecursion: false,
    tokenBudget: 0,
    budgetMode: "token",
    entryBudget: 0,
    entries: [emptyLoreEntry("entry-1")],
  };
}
