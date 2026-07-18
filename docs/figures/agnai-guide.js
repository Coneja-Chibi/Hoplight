// ─────────────────────────────────────────────────────────────
// agnai-guide.js: figure data for the Agnai user guide
// (docs/guide/platforms/agnai.md). Keyed by slug then figure id;
// prose drops a figure in with a line like `@fig journey`. Same
// DATA SHAPE as portfolio/site/data/figures.js. Renderer comes
// later; the `@fig` marker is inert until then. Grounded in the
// real room names (the Library, the Workbench, the Press) and
// src/formats/agnai/ (structured persona, voice, sprite, image
// prompt, response schema, embedded memory book).
// ─────────────────────────────────────────────────────────────

export const figures = {
  agnai: {
    journey: {
      type: "flow",
      fig: "fig·01",
      title: "a card, from drop to export",
      caption:
        "An Agnai character comes in through the Library, gets edited on the Workbench, and goes back out through the Press. Nothing is lost on the way in: the whole original card is kept, so an export back to Agnai returns everything. An export to a different app carries the shared character and leaves Agnai's own extras behind where the other app has no slot for them.",
      steps: [
        { label: "Drop on the Library", sub: ".json character, no PNG option", color: "teal" },
        { label: "Kept in full", sub: "original card held intact", color: "sage" },
        { label: "Edit on the Workbench", sub: "structured persona, voice, sprite, image prompt", color: "ochre" },
        { label: "Stage for the Press", sub: "pick a target format", color: "clay" },
        { label: "Export a card", sub: "back to Agnai, or another app", color: "plum" },
      ],
    },
  },
};
