// ─────────────────────────────────────────────────────────────
// canonical-model.js: figure data for docs/reference/concepts/
// canonical-model.md, keyed by page slug then figure id. Prose lives
// in the .md and drops a figure in with `@fig <id>`; this file is the
// data behind that id. Shape (funnel) mirrors the portfolio figure
// spec (site/data/figures.js); imports nothing. Renderer comes later,
// so the marker is inert for now. Grounded in src/core/canonical.ts
// and src/entities/{character,lorebook}/schema.ts.
// ─────────────────────────────────────────────────────────────

export const figures = {
  "canonical-model": {
    gate: {
      type: "funnel", fig: "fig·01", title: "the superset gate: what earns a canonical slot",
      caption:
        "Illustrative, not measured. Start from every field every real format can hold: in-memory state, platform baggage, and wire content. One rule narrows it, a real wire format must serialize the field, so DB/platform baggage and in-memory-only residue drop out. The survivors are the canonical body. A field only one format serializes still passes, and everything that drops out is not lost, it rides escrow (original) so round-trips stay lossless.",
      steps: [
        { label: "every field, every format", value: 12, color: "ochre" },
        { label: "portable, not platform baggage", value: 8, color: "sage" },
        { label: "a real wire format serializes it", value: 6, color: "teal" },
      ],
    },
  },
};
