// ─────────────────────────────────────────────────────────────
// backyard-guide.js: figure data for the Backyard user guide
// (docs/guide/platforms/backyard.md). Keyed by slug then figure
// id; prose drops a figure in with a line like `@fig journey`.
// Same DATA SHAPE as portfolio/site/data/figures.js. Renderer comes
// later; the `@fig` marker is inert until then. Grounded in the real
// room names (the Library, the Workbench, the Press) and the two
// Backyard shapes: the older flat JSON export and the modern .byaf
// archive.
//
// Separate file from docs/figures/backyard.js on purpose: that file
// already backs the developer reference page
// (docs/reference/formats/backyard.md, key "backyard"). Same split
// as sillytavern-format.js / sillytavern-guide.js. Named export (not
// default) to match the other platform guide figure files and the
// portfolio data-shape source.
// ─────────────────────────────────────────────────────────────

export const figures = {
  backyard: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "a card, from drop to export",
      caption:
        "A Backyard card comes in through the Library as a flat JSON export or a .byaf archive, gets " +
        "edited on the Workbench, and goes back out through the Press. Nothing is lost on the way in: " +
        "the whole original file is kept, so an export back to the same shape returns everything. " +
        "Moving a card to the other Backyard shape, or to a different app entirely, carries only the " +
        "fields both sides can hold.",
      steps: [
        { label: "Drop on the Library", sub: "flat .json export or .byaf archive", color: "teal" },
        { label: "Kept in full", sub: "original file held intact", color: "sage" },
        { label: "Edit on the Workbench", sub: "name, description, personality, scenario, greetings", color: "ochre" },
        { label: "Stage for the Press", sub: "pick Backyard or Backyard (legacy)", color: "clay" },
        { label: "Export a card", sub: "back to the matching shape, or another app", color: "plum" },
      ],
    },
  },
};
