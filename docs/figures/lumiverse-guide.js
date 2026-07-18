// ─────────────────────────────────────────────────────────────
// lumiverse-guide.js: figure data for the Lumiverse user guide
// (docs/guide/platforms/lumiverse.md). Keyed by slug then figure
// id; prose drops a figure in with a line like `@fig journey`.
// Same DATA SHAPE as portfolio/site/data/figures.js. Renderer comes
// later; the `@fig` marker is inert until then. Grounded in the real
// room names (the Library, the Workbench, the Press) and the
// character adapter's own container handling (src/formats/lumiverse/).
// ─────────────────────────────────────────────────────────────

export const figures = {
  lumiverse: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "a Lumiverse card, from drop to export",
      caption:
        "A Lumiverse card, or its archive of expression images and alternate faces, comes in through the Library, gets edited on the Workbench, and goes back out through the Press. Nothing is lost on the way in: the whole original card and archive are kept, so an export back to Lumiverse returns everything. An export to a different app carries the shared character and leaves Lumiverse's private extras behind.",
      steps: [
        { label: "Drop on the Library", sub: ".png, .json, or .charx", color: "teal" },
        { label: "Kept in full", sub: "original card and archive held intact", color: "sage" },
        { label: "Edit on the Workbench", sub: "variants, sprites, Lumiverse's own fields", color: "ochre" },
        { label: "Stage for the Press", sub: "pick a target format", color: "clay" },
        { label: "Export a card", sub: "back to Lumiverse, or another app", color: "plum" },
      ],
    },
  },
};
