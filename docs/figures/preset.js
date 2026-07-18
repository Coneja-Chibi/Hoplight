// ─────────────────────────────────────────────────────────────
// preset.js - figure data for docs/reference/entities/preset.md,
// keyed by figure id. Prose lives in the .md and drops a figure in
// with a line like `@fig composition`; this is the data behind that
// id. Edit the shape/labels here; edit the words in the .md.
// Grounded in src/entities/preset/schema.ts (PresetBody).
// ─────────────────────────────────────────────────────────────

export default {
  composition: {
    type: "tree",
    fig: "fig 01",
    title: "PresetBody, grouped",
    caption:
      "PresetBody has two required fields: name and the ordered prompt-block manuscript. " +
      "Eleven further fields are optional: two more collections plus seven settings " +
      "sub-objects. Nested named shapes are shown under the field that holds them; plain " +
      "scalar fields are summarized in each group's note. Kinds: body, required field, " +
      "optional field, nested shape.",
    root: {
      label: "PresetBody",
      kind: "root",
      sum: "The canonical preset superset. Two required fields plus eleven optional fields.",
      children: [
        {
          label: "name",
          kind: "field",
          sum: "The preset's name.",
        },
        {
          label: "description?",
          kind: "field",
          sum: "Free-text description.",
        },
        {
          label: "enabled?",
          kind: "field",
          sum: "Set-level on/off (the Library shelf switch); absent = on.",
        },
        {
          label: "prompts",
          kind: "group",
          sum: "The ordered real prompt blocks (PresetPrompt[]): the manuscript. Scalars: id, name, content, role, enabled, systemPrompt, marker, markerSlot, placement, injectionDepth, injectionOrder, forbidOverrides, injectionTrigger, isDefault, groupId, wrapInXml, xmlTagName, extras.",
        },
        {
          label: "groups?",
          kind: "optional",
          sum: "Categories/folders for prompts (PresetGroup[]). Scalars: id, name, content, parentGroupId, order, enabled, extras.",
        },
        {
          label: "samplers?",
          kind: "optional",
          sum: "Sampler and context-window settings, all scalar: temperature, topP, topK, topA, minP, frequencyPenalty, presencePenalty, repetitionPenalty, maxContext, maxTokens, promptPostProcessing, contextMode, maxMessages.",
        },
        {
          label: "systemPrompts?",
          kind: "optional",
          sum: "The always-on utility prompts: impersonation, newChat, newGroupChat, newExampleChat, continueNudge, groupNudge, assistantPrefill, assistantImpersonation.",
        },
        {
          label: "templates?",
          kind: "optional",
          sum: "Handlebars-ish format strings for card fields: worldInfoFormat, scenarioFormat, personalityFormat.",
        },
        {
          label: "behavior?",
          kind: "optional",
          sum: "Message-assembly behavior flags: wrapInQuotes, namesBehavior, sendIfEmpty, continuePrefill, continuePostfix.",
        },
        {
          label: "apiOptions?",
          kind: "optional",
          sum: "Provider/API request options: streamResponses, claudeUseSystemPrompt, useMakerSuiteSystemPrompt, squashSystemMessages, functionCalling, showThoughts, reasoningEffort, enableWebSearch, requestImages.",
        },
        {
          label: "media?",
          kind: "optional",
          sum: "Image/video inlining: imageInlining, inlineImageQuality, videoInlining.",
        },
        {
          label: "generation?",
          kind: "optional",
          sum: "Generation-shape settings: seed, completions, maxContextUnlocked, biasPreset.",
        },
        {
          label: "choices?",
          kind: "optional",
          sum: "The CHOICES walkthrough (PresetChoice[]): authored now, run later. Scalars: id, key, label, readme, type, default, min, placeholder, suggestions, separator, randomPick, sortOrder, extras.",
          children: [
            {
              label: "options: PresetChoiceOption[]",
              kind: "shape",
              sum: "One answerable option: id, label, description, value, enablesPrompts, set.",
            },
          ],
        },
      ],
    },
  },
};
