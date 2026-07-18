// ─────────────────────────────────────────────────────────────
// sillytavern-guide.js: figure data for the SillyTavern user
// guide (docs/guide/platforms/sillytavern.md). Keyed by slug then
// figure id; prose drops a figure in with a line like `@fig journey`.
// Same DATA SHAPE as portfolio/site/data/figures.js. Renderer comes
// later; the `@fig` marker is inert until then. Grounded in the real
// room names (the Library, the Workbench, the Press) and the engine's
// hub-and-spoke round-trip.
// ─────────────────────────────────────────────────────────────

export const figures = {
  sillytavern: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "a card, from drop to export",
      caption:
        "A SillyTavern card comes in through the Library, gets edited on the Workbench, and goes back out through the Press. Nothing is lost on the way in: the whole original card is kept, so an export back to SillyTavern returns everything. An export to a different app carries the shared character and leaves SillyTavern's private extras behind.",
      steps: [
        { label: "Drop on the Library", sub: ".png or .json card", color: "teal" },
        { label: "Kept in full", sub: "original card held intact", color: "sage" },
        { label: "Edit on the Workbench", sub: "name, description, greetings", color: "ochre" },
        { label: "Stage for the Press", sub: "pick a target format", color: "clay" },
        { label: "Export a card", sub: "back to ST, or another app", color: "plum" },
      ],
    },
  },
};
