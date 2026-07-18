// ─────────────────────────────────────────────────────────────
// novelai.js: figure data for docs/reference/formats/novelai.md,
// keyed by page slug then figure id. Prose lives in the .md and
// drops a figure in with `@fig <id>`; this file is the data behind
// that id. Shapes (flow / matrix / funnel / pyramid / tree) mirror
// the portfolio figure spec. Grounded in src/formats/novelai/lorebook.ts.
// ─────────────────────────────────────────────────────────────

export default {
  novelai: {
    "cross-format": {
      type: "flow", fig: "fig·01", title: "a canonical entry becomes a fresh NAI entry (no twin)",
      caption:
        "Cross-format import (SillyTavern, Risu, CCv3) carries no NovelAI twin to overlay, so each entry is rebuilt onto a valid v3 shell (lorebook.ts:319-333). The contextConfig defaults are lifted verbatim from a real NAI blank-entry export, not invented.",
      steps: [
        { label: "Canonical entry", sub: "from ST / Risu / CCv3, no NAI twin", color: "teal" },
        { label: "Rename fields", sub: "content -> text, title -> displayName, triggers -> keys", color: "sage" },
        { label: "Fill contextConfig", sub: "verbatim NAI blank-entry defaults; budgetPriority = sortOrder", color: "ochre" },
        { label: "Emit v3 shell", sub: "lorebookVersion 3, no entry id", color: "plum" },
      ],
    },
  },
};
