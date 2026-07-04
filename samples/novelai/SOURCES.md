# NovelAI samples

## nai-v6-crystal-dragon.lorebook.json
- Source: the `lorebook` object extracted from the official first-party scenario
  `Scripting Demo_Crystal Dragon Encounter.scenario` in the NovelAI/novelai-script-examples repo.
  Raw URL: https://raw.githubusercontent.com/NovelAI/novelai-script-examples/refs/heads/main/scenarios/Scripting%20Demo_Crystal%20Dragon%20Encounter.scenario
- Downloaded: 2026-07-04
- Why: a REAL `lorebookVersion: 6` book (the in-repo fixture `nai-v3-mal.slice.lorebook.json` is v3 and
  lacks the v6-authored surface). 3 entries + 1 category. Exercises the escrowed authored fields the
  de-escrow slice must first-class: per-entry `contextConfig` (prefix/suffix/tokenBudget/reservedTokens/
  trimDirection/insertionType/maximumTrimType/insertionPosition), `keyRelative`, `nonStoryActivatable`,
  `category` + book `categories[]`, and `loreBiasGroups` (real rich phrase-bias shape:
  `{phrases:[{sequence,type}], bias, enabled, whenInactive, ensureSequenceFinish, generateOnce}`).
- Caveat: `advancedConditions` is present but `[]` (empty) on every entry, so its element structure is
  ungrounded - it correctly stays in escrow until a populated real sample appears (do not schema-model blind).
- Note: extracted from a `.scenario` (scenarioVersion 3) that embeds the v6 lorebook under its `lorebook`
  key; the scenario's own phraseBiasGroups/bannedSequenceGroups/userScripts are story-scoped, NOT lorebook
  fields, and are intentionally excluded.
