// ─────────────────────────────────────────────────────────────
// exporting.js - figure data for docs/guide/exporting.md, keyed
// by slug then figure id. Prose lives in the .md and drops a figure
// in with a line like `@fig honesty`; this is the data behind that
// id. Copies the portfolio `flow` shape (site/data/figures.js);
// imports nothing. Renderer comes later; the marker is inert for now.
// Grounded in src/ui/components/export-dialog/honesty.ts
// (buildExportHonesty: coverage carries + body flags, never wire bytes).
// ─────────────────────────────────────────────────────────────

export const figures = {
  exporting: {
    honesty: {
      type: "flow", fig: "fig·01", title: "what one export decides before it hands you a file",
      caption:
        "Every export runs the same pass: what the target format claims to carry, what your card actually has on it, and how the two line up. Nothing here inspects wire bytes; it reasons from the format's declared coverage and the card's own fields, so the same honest check works even for a format nobody has hand-written caveats for yet.",
      steps: [
        { label: "Pick a platform", sub: "formats for this piece's kind only", color: "clay" },
        { label: "Check behavior coverage", sub: "does the target carry scripts and rules", color: "ochre" },
        { label: "Run format caveats", sub: "Agnai, Backyard, BYAF, Lumiverse, linked lore", color: "sage" },
        { label: "Check media on the card", sub: "portrait, expression pack, named assets", color: "teal" },
        { label: "Render the lines", sub: "plain, Note:, or Dropped:, before you download", color: "plum" },
      ],
    },
  },
};
