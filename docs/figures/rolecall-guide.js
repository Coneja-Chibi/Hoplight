// ─────────────────────────────────────────────────────────────
// rolecall-guide.js: figure data for the RoleCall user guide
// (docs/guide/platforms/rolecall.md). Keyed by slug then figure
// id; prose drops a figure in with a line like `@fig journey`.
// Same DATA SHAPE as portfolio/site/data/figures.js. Renderer comes
// later; the `@fig` marker is inert until then. Grounded in the real
// room names (the Library, the Workbench, the Press) and RoleCall's
// own field map (src/formats/rolecall/).
// ─────────────────────────────────────────────────────────────

export const figures = {
  rolecall: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "a card, from drop to export",
      caption:
        "A RoleCall card comes in through the Library, gets edited on the Workbench, and goes back out through the Press. Nothing is lost on the way in: the whole original card is kept, so an export back to RoleCall returns everything, including the casting card and presentation layer. An export to a different app carries the shared character and leaves RoleCall's own casting and presentation layer behind.",
      steps: [
        { label: "Drop on the Library", sub: ".png/.json card, or a lorebook export", color: "teal" },
        { label: "Kept in full", sub: "original card held intact", color: "sage" },
        { label: "Edit on the Workbench", sub: "casting card, prompts, presentation", color: "ochre" },
        { label: "Stage for the Press", sub: "pick a target format", color: "clay" },
        { label: "Export a card", sub: "back to RoleCall, or another app", color: "plum" },
      ],
    },
  },
};
