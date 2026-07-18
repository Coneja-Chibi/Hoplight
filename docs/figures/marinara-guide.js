// ─────────────────────────────────────────────────────────────
// marinara-guide.js: figure data for the Marinara user guide
// (docs/guide/platforms/marinara.md). Keyed by slug then figure id;
// prose drops a figure in with a line like `@fig journey`. Same DATA
// SHAPE as portfolio/site/data/figures.js and its sibling
// sillytavern-guide.js. Renderer comes later; the `@fig` marker is
// inert until then. Grounded in the real room names (the Library,
// the Workbench, the Press) and src/formats/marinara/.
//
// Named marinara-guide.js, not marinara.js: docs/figures/marinara.js
// already exists and backs the DEV reference page
// (docs/reference/formats/marinara.md). Splitting guide vs reference
// figure files under a -guide suffix matches the sillytavern-format.js
// / sillytavern-guide.js precedent already in this folder.
// ─────────────────────────────────────────────────────────────

export const figures = {
  marinara: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "a regex script or persona, from drop to export",
      caption:
        "A Marinara-Engine dump, a regex script array or a persona object, comes in through the Library, gets edited on the Workbench, and goes back out through the Press. The whole original file is kept, so an export back to Marinara-Engine returns everything; an export to a different app carries only the shared fields and leaves Marinara's own theming, stat bars, and timestamps behind.",
      steps: [
        { label: "Drop on the Library", sub: "regex dump or persona .json", color: "teal" },
        { label: "Kept in full", sub: "original file held intact", color: "sage" },
        { label: "Edit on the Workbench", sub: "rules, or sections and voice", color: "ochre" },
        { label: "Stage for the Press", sub: "pick a target format", color: "clay" },
        { label: "Export", sub: "back to Marinara, or another app", color: "plum" },
      ],
    },
  },
};
