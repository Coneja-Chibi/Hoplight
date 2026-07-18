// ─────────────────────────────────────────────────────────────
// pygmalion-guide.js: figure data for the Pygmalion user guide
// (docs/guide/platforms/pygmalion.md). Keyed by slug then figure
// id; prose drops a figure in with a line like `@fig journey`.
// Same DATA SHAPE as portfolio/site/data/figures.js. Renderer comes
// later; the `@fig` marker is inert until then. Grounded in the real
// room names (the Library, the Workbench, the Press) and the
// classic five-field wire in src/formats/pygmalion/.
//
// Separate file from docs/figures/pygmalion.js on purpose: that file
// already backs the developer reference page
// (docs/reference/formats/pygmalion.md, key "pygmalion" -> "detect").
// Same split as sillytavern-format.js / sillytavern-guide.js. Named
// export (not default) to match both of those and the portfolio
// data-shape source; docs/figures/pygmalion.js uses a default export
// and is the outlier, not this file.
// ─────────────────────────────────────────────────────────────

export const figures = {
  pygmalion: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "a card, from drop to export",
      caption:
        "A Pygmalion card comes in through the Library as plain JSON or a PNG carrier, gets edited " +
        "on the Workbench, and goes back out through the Press. Nothing is lost on the way in: the " +
        "whole original card, tool bookkeeping included, is kept, so an export back to Pygmalion " +
        "returns everything, picture included when the card arrived as a PNG. An export to a " +
        "different app carries the five character fields and leaves Pygmalion's own tool stamp behind.",
      steps: [
        { label: "Drop on the Library", sub: ".json or .png card", color: "teal" },
        { label: "Kept in full", sub: "original card + tool stamp held intact", color: "sage" },
        { label: "Edit on the Workbench", sub: "name, persona, scenario, greeting, examples", color: "ochre" },
        { label: "Stage for the Press", sub: "pick a target format", color: "clay" },
        { label: "Export a card", sub: "back to Pygmalion, or another app", color: "plum" },
      ],
    },
  },
};
