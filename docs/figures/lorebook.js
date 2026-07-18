// ─────────────────────────────────────────────────────────────
// lorebook.js - figure data for docs/reference/entities/lorebook.md,
// keyed by figure id. Prose lives in the .md and drops a figure in
// with a line like `@fig composition`; this is the data behind that
// id. Edit the shape/labels here; edit the words in the .md.
// Grounded in src/entities/lorebook/schema.ts (LorebookBody, LorebookEntry).
// ─────────────────────────────────────────────────────────────

export default {
  composition: {
    type: "tree",
    fig: "fig 01",
    title: "LorebookBody, grouped",
    caption:
      "LorebookBody is book-level settings plus a list of LorebookEntry (the triggerable content) " +
      "and an optional list of LorebookCategory (folders). LorebookEntry is one flat interface in " +
      "the schema, not sub-grouped there; the clusters shown under entries are this page's own " +
      "concern-grouping for readability, not separate TypeScript shapes. Named types nested under a " +
      "cluster (Trigger, CharacterFilter, EntrySideEffects, EntryContextConfig, LoreBiasGroup) are " +
      "real TypeScript shapes with their own generated table. Kinds: root, group (a cluster of " +
      "related fields), optional field, shape (a separately named type), leaf field.",
    root: {
      label: "LorebookBody",
      kind: "root",
      sum: "The canonical lorebook superset. Book-level settings plus entries and optional categories.",
      children: [
        {
          label: "identity and categorization",
          kind: "group",
          sum: "name, description, lorebookType, genre, fandom, tags.",
        },
        {
          label: "matching defaults",
          kind: "group",
          sum: "globalCaseSensitive, globalMatchWholeWords, globalScanDepth, globalRecursion: entries with a null override inherit these.",
        },
        {
          label: "budget",
          kind: "group",
          sum: "tokenBudget, budgetMode, entryBudget: how much of the book injects per turn.",
        },
        {
          label: "enabled?",
          kind: "optional",
          sum: "Book-level on/off for the shelf and Press export filter (RoleCall).",
        },
        {
          label: "entries: LorebookEntry[]",
          kind: "shape",
          sum: "The triggerable content. One flat interface in the schema; grouped here by concern.",
          children: [
            { label: "identity and content", kind: "group", sum: "id, title, content, comment, enabled, constant." },
            {
              label: "triggers and matching",
              kind: "group",
              sum: "triggerMode, triggers, secondaryTriggers, selectiveLogic, caseSensitive, matchWholeWords, scanDepth.",
              children: [
                { label: "Trigger", kind: "shape", sum: "keyword, isRegex, flags, frequency, probability." },
              ],
            },
            { label: "injection and placement", kind: "group", sum: "position, depth, role." },
            {
              label: "ordering, timing, grouping",
              kind: "group",
              sum: "sortOrder, priority, sticky, cooldown, delay, groupName, categoryId, groupWeight, probability.",
            },
            {
              label: "recursion and budget",
              kind: "group",
              sum: "useMemo, excludeRecursion, preventRecursion, delayUntilRecursion, ignoreBudget.",
            },
            {
              label: "scan sources",
              kind: "group",
              sum: "scanCharacterDescription, scanCharacterPersonality, scanUserPersona, scanScenario, scanCharacterDepthPrompt, scanCreatorNotes.",
            },
            {
              label: "filters and side effects",
              kind: "group",
              sum: "characterFilter, sideEffects.",
              children: [
                { label: "CharacterFilter", kind: "shape", sum: "names, tags, isExclude." },
                { label: "EntrySideEffects", kind: "shape", sum: "effects: EntrySideEffect[], onlyOnFirstTrigger, clearOnDeactivate." },
              ],
            },
            {
              label: "ST-lineage toggles",
              kind: "group",
              sum: "vectorized, groupOverride, useGroupScoring, automationId, displayIndex.",
            },
            {
              label: "NovelAI extensions",
              kind: "group",
              sum: "keyRelative, nonStoryActivatable, contextConfig, loreBiasGroups.",
              children: [
                {
                  label: "EntryContextConfig",
                  kind: "shape",
                  sum: "prefix, suffix, tokenBudget, reservedTokens, trimDirection, insertionType, maximumTrimType, insertionPosition.",
                },
                {
                  label: "LoreBiasGroup",
                  kind: "shape",
                  sum: "enabled, bias, phrases: LoreBiasPhrase[], whenInactive, generateOnce, ensureSequenceFinish.",
                },
              ],
            },
            { label: "metadata?", kind: "field", sum: "Open bag for format-specific data with no first-class home." },
          ],
        },
        {
          label: "categories?: LorebookCategory[]",
          kind: "optional",
          sum: "Optional named folders grouping entries.",
          children: [{ label: "LorebookCategory", kind: "shape", sum: "id, name, sortOrder, enabled?." }],
        },
      ],
    },
  },
};
