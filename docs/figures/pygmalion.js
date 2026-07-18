// ─────────────────────────────────────────────────────────────
// pygmalion.js: figure data for docs/reference/formats/pygmalion.md,
// keyed by page slug then figure id. Prose lives in the .md and
// drops a figure in with `@fig <id>`; this file is the data behind
// that id. Shapes (flow / matrix) mirror the portfolio figure spec.
// Every figure is grounded in src/formats/pygmalion/.
// ─────────────────────────────────────────────────────────────

export default {
  pygmalion: {
    detect: {
      type: "flow",
      fig: "fig·01",
      title: "detect(): reject known shapes, then look for the classic signal",
      caption:
        "isPygmalionCard rejects CCv2/v3, vaud-json, Agnai, and Backyard shapes before it ever looks " +
        "for a positive signal (index.ts:26-29), then requires either two of the three classic fields " +
        "or char_name plus char_persona (index.ts:31-38). A hit scores 1, no headroom reserved for a " +
        "more-specific sibling the way SillyTavern's 0.9 does.",
      steps: [
        { label: "Read JSON", sub: "PNG chara/ccv3 chunk, or raw text", color: "sage" },
        { label: "Reject known shapes", sub: "CCv2/v3 · vaud-json · Agnai · Backyard", color: "clay" },
        { label: "Classic signal", sub: "2 of 3: persona, greeting, scenario", color: "teal" },
        { label: "Minimal signal", sub: "char_name + char_persona", color: "ochre" },
        { label: "Score 1", sub: "registry breaks SillyTavern's 0.9 tie", color: "plum" },
      ],
    },
  },
};
