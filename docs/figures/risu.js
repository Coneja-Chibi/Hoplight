// ─────────────────────────────────────────────────────────────
// risu-guide.js: figure data for the RisuAI user guide
// (docs/guide/platforms/risu.md). Keyed by slug then figure id;
// prose drops a figure in with a line like `@fig journey`. Same
// DATA SHAPE as portfolio/site/data/figures.js. Renderer comes
// later; the `@fig` marker is inert until then. Grounded in the
// real room names (the Library, the Workbench, the Press) and the
// engine's hub-and-spoke round-trip.
// ─────────────────────────────────────────────────────────────

export const figures = {
  risu: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "a card, from drop to export",
      caption:
        "A RisuAI .charx comes in through the Library, gets edited on the Workbench, and goes back out through the Press. Nothing is lost on the way in: the whole original archive is kept, so an export back to RisuAI returns everything. An export to a different app carries the shared character and leaves RisuAI's package scripts behind.",
      steps: [
        { label: "Drop on the Library", sub: ".charx, lorebook, or regex json", color: "teal" },
        { label: "Kept in full", sub: "original archive held intact", color: "sage" },
        { label: "Edit on the Workbench", sub: "Fields, and Workshop for scripts", color: "ochre" },
        { label: "Stage for the Press", sub: "pick a target format", color: "clay" },
        { label: "Export a card", sub: "back to RisuAI, or another app", color: "plum" },
      ],
    },
  },
};
