// ─────────────────────────────────────────────────────────────
// regex.js - figure data for docs/reference/entities/regex.md and
// docs/guide/regex.md, keyed by figure id (shared file, flat map:
// both pages drop a figure in with a line like `@fig composition` or
// `@fig chain`; this is the data behind that id). Edit the
// shape/labels here; edit the words in the .md files.
// Grounded in src/entities/regex/schema.ts (RegexSetBody, RegexRule)
// and src/core/regex/apply.ts (applyRules, the chain itself).
// ─────────────────────────────────────────────────────────────

export default {
  chain: {
    type: "flow",
    fig: "fig 01",
    title: "one rule feeds the next",
    caption:
      "Rules run top to bottom, in the order they're listed, and each one works on the text as the " +
      "rule before it left it, not the original. That's why two rules can compete for the same text: " +
      "whichever runs first wins, and the full check is what catches the one that never gets a turn.",
    steps: [
      { label: "Your text", sub: "input, output, or wherever it's aimed", color: "clay" },
      { label: "Rule 1", sub: "sees the text as it started", color: "ochre" },
      { label: "Rule 2", sub: "sees what rule 1 left behind", color: "sage" },
      { label: "Rule 3", sub: "same, one step later", color: "teal" },
      { label: "What comes out", sub: "the final text, after every rule's turn", color: "plum" },
    ],
  },
  composition: {
    type: "tree",
    fig: "fig 01",
    title: "RegexSetBody, grouped",
    caption:
      "RegexSetBody is a name, an optional description, a set-level enabled switch, and the " +
      "ordered rules list. Almost all of the entity's surface lives inside RegexRule, whose 20 " +
      "flat fields read as three concerns: identity and content, placement, and vaud-engine-only " +
      "controls with no wire home on any platform. Kinds: body, field group, nested shape, leaf field.",
    root: {
      label: "RegexSetBody",
      kind: "root",
      sum: "The canonical regex-set entity. Scalars: name, description, enabled (set-level on/off).",
      children: [
        {
          label: "rules: RegexRule[]",
          kind: "group",
          sum: "One rule maps 1:1 to a script row on any producing platform, applied in sortOrder.",
          children: [
            {
              label: "Identity and content",
              kind: "group",
              sum: "id, label, note, find, flags, useFlags, replace, trimStrings, enabled, sortOrder.",
            },
            {
              label: "Placement",
              kind: "group",
              sum: "phases, targets, substituteFind, minDepth, maxDepth, runOnEdit, characterIds.",
            },
            {
              label: "Vaud-engine-only controls",
              kind: "group",
              sum: "firstMatchOnly, overlay: no wire home on any platform, canonical-only.",
              children: [
                {
                  label: "condition: RegexRuleCondition",
                  kind: "shape",
                  sum: "{ ruleId, matched }: chains this rule on an earlier rule's outcome, same pass.",
                },
              ],
            },
            {
              label: "extras?",
              kind: "field",
              sum: "Per-platform leftovers with no first-class home, sealed and re-emitted untouched.",
            },
          ],
        },
      ],
    },
  },
};
